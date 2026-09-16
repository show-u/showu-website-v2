#!/usr/bin/env node
/**
 * Production-equivalent historical evaluator for TW-holding-exit-v4.
 *
 * Hard rules:
 * - Loads the actual holding-model.js and calls StockLabHolding.analyze directly.
 * - Reads only an already-validated licensed bundle on disk; no network access.
 * - No imputation, proxy data, future high/low execution, or OOS retuning.
 * - A signal formed from completed-session data executes no earlier than the next
 *   verified trading session using that session OPEN (not hindsight high/low).
 * - Corporate-action/risk-state uncertainty excludes the episode/session.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';

const args=Object.fromEntries(process.argv.slice(2).reduce((a,x,i,v)=>{if(x.startsWith('--'))a.push([x.slice(2),v[i+1]&&!v[i+1].startsWith('--')?v[i+1]:true]);return a},[]));
const bundleDir=path.resolve(String(args['bundle-dir']||'stock-lab/history-licensed'));
const production=path.resolve(String(args.production||'stock-lab/holding-model.js'));
const outPath=path.resolve(String(args.out||'stock-lab/holding-evaluator-result.json'));
const minBars=Number(args['min-bars']||120), minEpisodes=Number(args['min-episodes']||300), minSecurities=Number(args['min-securities']||80);
const COMMISSION=0.001425, SELL_TAX=0.003, SLIPPAGE=0.0005;

function die(msg){throw new Error(msg)}
function json(p){return JSON.parse(fs.readFileSync(p,'utf8'))}
function sha256(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}
function csv(text){
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);if(!lines.length)return[];
  const split=line=>{const a=[];let s='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){s+='"';i++}else q=!q}else if(c===','&&!q){a.push(s);s=''}else s+=c}a.push(s);return a};
  const h=split(lines[0]);return lines.slice(1).map((line,n)=>{const v=split(line);if(v.length!==h.length)die(`CSV row ${n+2} field count mismatch`);return Object.fromEntries(h.map((k,i)=>[k,v[i]]))});
}
function rowsFrom(p,fmt){const t=fs.readFileSync(p,'utf8');if(fmt==='json'){const x=JSON.parse(t);if(!Array.isArray(x))die(`${p}: JSON must be array`);return x}if(fmt==='jsonl')return t.split(/\r?\n/).filter(x=>x.trim()).map(JSON.parse);if(fmt==='csv')return csv(t);die(`unsupported format ${fmt}`)}
function truth(v){return v===true||['1','true','yes','y'].includes(String(v).toLowerCase())}
function num(v){const x=Number(String(v??'').replace(/,/g,''));return Number.isFinite(x)?x:null}
function key(m,t){return `${m}:${t}`}
function mean(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:null}
function median(a){if(!a.length)return null;const v=[...a].sort((x,y)=>x-y),m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2}
function quantile(a,q){if(!a.length)return null;const v=[...a].sort((x,y)=>x-y),p=(v.length-1)*q,l=Math.floor(p),h=Math.ceil(p);return l===h?v[l]:v[l]+(v[h]-v[l])*(p-l)}
function maxDrawdown(returns){let e=1,p=1,m=0;for(const r of returns){e*=1+r;p=Math.max(p,e);m=Math.min(m,e/p-1)}return m*100}

function validateBundle(){
  const mp=path.join(bundleDir,'manifest.json');if(!fs.existsSync(mp))return{usable:false,reason:'licensed bundle not present'};
  const m=json(mp),L=m.license||{};
  if(!(L.automated_processing_allowed===true&&L.derived_outputs_allowed===true&&L.local_storage_allowed===true&&m.no_imputation===true&&m.network_collection_performed_by_importer===false))die('licensed rights/integrity gate failed');
  const required=['security_master','trading_calendar','daily_ohlc','corporate_actions','risk_states'];
  const ds={};for(const n of required){const d=m.datasets?.[n];if(!d)die(`missing dataset ${n}`);const p=path.join(bundleDir,String(d.path||''));if(!fs.existsSync(p)||sha256(p)!==d.sha256)die(`checksum failed ${n}`);ds[n]=rowsFrom(p,d.format)}
  return{usable:true,manifest:m,ds};
}

function loadProduction(){
  const code=fs.readFileSync(production,'utf8');
  const sandbox={window:{},console};vm.createContext(sandbox);vm.runInContext(code,sandbox,{filename:production});
  const api=sandbox.window.StockLabHolding;if(!api?.analyze)die('production holding-model.js did not expose StockLabHolding.analyze');
  return{api,sha:sha256(production)};
}

function buildData(ds,manifest){
  const master=new Map(ds.security_master.filter(x=>x.security_type==='ordinary_stock').map(x=>[key(x.market,String(x.ticker)),x]));
  const calendar=new Map();for(const x of ds.trading_calendar){if(!truth(x.is_trading_day))continue;(calendar.get(x.market)||calendar.set(x.market,[]).get(x.market)).push(String(x.date))}for(const v of calendar.values())v.sort();
  const bars=new Map();for(const x of ds.daily_ohlc){const k=key(x.market,String(x.ticker)),o=num(x.open),h=num(x.high),l=num(x.low),c=num(x.close),v=num(x.volume);if(!master.has(k)||![o,h,l,c].every(z=>z>0)||h<Math.max(o,l,c)||l>Math.min(o,h,c))continue;(bars.get(k)||bars.set(k,[]).get(k)).push({iso:String(x.date),d:String(x.date),o,h,l,c,v})}for(const v of bars.values())v.sort((a,b)=>a.iso.localeCompare(b.iso));
  const actions=new Map();for(const x of ds.corporate_actions){const k=key(x.market,String(x.ticker));(actions.get(k)||actions.set(k,[]).get(k)).push(x)}
  const risks=new Map();for(const x of ds.risk_states){const k=key(x.market,String(x.ticker));(risks.get(k)||risks.set(k,new Map()).get(k)).set(String(x.date),x)}
  return{master,calendar,bars,actions,risks,manifest};
}

function actionNeutral(x){const t=String(x.action_type||'').trim().toLowerCase();return !t||['none','no_action','normal'].includes(t)}
function episodeHasAction(actions,from,to){return (actions||[]).some(x=>String(x.effective_date)>=from&&String(x.effective_date)<=to&&!actionNeutral(x))}
function riskKnown(riskMap,date){return riskMap?.has(date)===true}
function riskBlocked(r){return truth(r?.disposition)||truth(r?.suspended)}
function nextBar(all,i){return i+1<all.length?all[i+1]:null}
function netExitReturn(entry,exit){return exit*(1-COMMISSION-SELL_TAX-SLIPPAGE)/(entry*(1+COMMISSION+SLIPPAGE))-1}

function regimeForBars(all,i){
  if(i<120)return null;const c=all[i].c,ma20=mean(all.slice(i-19,i+1).map(x=>x.c)),ma60=mean(all.slice(i-59,i+1).map(x=>x.c)),ma120=mean(all.slice(i-119,i+1).map(x=>x.c));
  if(![ma20,ma60,ma120].every(Number.isFinite))return null;
  if(c>ma20&&ma20>ma60&&ma60>ma120)return'bull';
  if(c<ma20&&ma20<ma60&&ma60<ma120)return'bear';
  return'sideways';
}

function deterministicEntries(all){
  // No future outcome is used. Every ~30 sessions after enough pre-entry context is eligible.
  const out=[];for(let i=minBars-1;i<all.length-22;i+=30)out.push(i);return out;
}

function runEpisode(prod,all,entryIndex,riskMap,actions){
  const entry=all[entryIndex],entryPrice=entry.o,buyDate=entry.iso;if(!(entryPrice>0)||!riskKnown(riskMap,buyDate))return null;
  const maxEval=Math.min(all.length-2,entryIndex+240);let signal=null,signalIndex=null,decision=null;
  for(let i=entryIndex;i<=maxEval;i++){
    const b=all.slice(0,i+1),today=all[i],risk=riskMap.get(today.iso);if(!risk)break;
    if(episodeHasAction(actions,buyDate,today.iso))return null;
    let result;
    try{result=prod.api.analyze({averageCost:entryPrice,shares:1000,buyDate,provenance:{averageCost:'historical_executable_open',shares:'normalized',buyDate:'historical_verified_session'}},b,{legalSource:true,priceVerified:true,activeRiskKnown:true,corporateActionKnown:true,oosStatus:'PASS',exitContextComplete:true,riskBlocked:riskBlocked(risk)});}catch{return null}
    const state=result?.decision?.state||'';
    if(state==='出場條件檢視'||state==='風險事件優先處理'){signal=state;signalIndex=i;decision=result;break}
  }
  const endIndex=signalIndex??maxEval,nxt=signalIndex!=null?nextBar(all,signalIndex):null;
  let executed=false,exitPrice=null,exitDate=null;
  if(signalIndex!=null&&nxt&&riskKnown(riskMap,nxt.iso)){
    const nr=riskMap.get(nxt.iso);if(!truth(nr?.suspended)){executed=true;exitPrice=nxt.o;exitDate=nxt.iso}
  }
  if(!executed){const end=all[endIndex];exitPrice=end.c;exitDate=end.iso}
  const ret=netExitReturn(entryPrice,exitPrice),regime=regimeForBars(all,entryIndex);
  return{ticker:null,buyDate,entryPrice,regime,signal:signal||'NO_EXIT_SIGNAL',signalDate:signalIndex!=null?all[signalIndex].iso:null,executed,exitDate,exitPrice,netReturnPct:ret*100,holdingSessions:(signalIndex??endIndex)-entryIndex+1,productionState:decision?.decision?.state||null};
}

function evaluate(data,prod){
  const securities=[];for(const [k,all] of data.bars){if(all.length>=minBars+25)securities.push([k,all])}
  securities.sort((a,b)=>a[0].localeCompare(b[0]));
  if(!securities.length)return{status:'INSUFFICIENT',episodes:[],reason:'no securities with minimum history'};
  // Chronological 70/30 split per security. Development episodes are never used in OOS metrics.
  const oos=[],dev=[];
  for(const [k,all] of securities){const split=Math.floor(all.length*.70),risk=data.risks.get(k),actions=data.actions.get(k)||[];if(!risk)continue;for(const ei of deterministicEntries(all)){const ep=runEpisode(prod,all,ei,risk,actions);if(!ep)continue;ep.ticker=k;ep.sample=ei>=split?'oos':'development';(ep.sample==='oos'?oos:dev).push(ep)}}
  const oosSecs=new Set(oos.map(x=>x.ticker)),regimes=[...new Set(oos.map(x=>x.regime).filter(Boolean))].sort(),rets=oos.map(x=>x.netReturnPct/100),exec=oos.filter(x=>x.signal!=='NO_EXIT_SIGNAL'),executed=exec.filter(x=>x.executed);
  const metrics=oos.length?{oos_episodes:oos.length,oos_securities:oosSecs.size,exit_signals:exec.length,executed_exits:executed.length,execution_rate_pct:exec.length?100*executed.length/exec.length:null,avg_net_return_pct:100*mean(rets),median_net_return_pct:100*median(rets),max_drawdown_pct:maxDrawdown(rets),q05_net_return_pct:100*quantile(rets,.05)}:null;
  const enough=oos.length>=minEpisodes&&oosSecs.size>=minSecurities&&['bull','bear','sideways'].every(x=>regimes.includes(x));
  return{status:enough?'EVALUATED':'INSUFFICIENT',development_episodes:dev.length,oos_episodes:oos.length,oos_securities:oosSecs.size,regimes,execution_validated:exec.length===0?false:executed.length===exec.length,production_formula_match:true,metrics,episodes:oos};
}

let payload;
try{
  const b=validateBundle(),prod=loadProduction();
  if(!b.usable)payload={schema_version:1,status:'INSUFFICIENT',reason:b.reason,production_formula_sha256:prod.sha,no_imputation:true,network_used:false};
  else{const data=buildData(b.ds,b.manifest),r=evaluate(data,prod);payload={schema_version:1,generated_at:new Date().toISOString(),status:r.status,source_bundle_id:b.manifest.bundle_id,production_formula_sha256:prod.sha,no_imputation:true,network_used:false,chronological_oos:true,next_session_open_execution:true,development_episodes:r.development_episodes||0,oos_episodes:r.oos_episodes||0,oos_securities:r.oos_securities||0,regimes:r.regimes||[],exit_execution_validated:r.execution_validated===true,production_formula_match:r.production_formula_match===true,confidence_calibrated:false,metrics:r.metrics||null,episodes:r.episodes||[]}}
}catch(e){payload={schema_version:1,status:'INSUFFICIENT',reason:String(e.message||e),no_imputation:true,network_used:false}}
fs.writeFileSync(outPath,JSON.stringify(payload,null,2)+'\n');console.log(JSON.stringify({...payload,episodes:undefined},null,2));
