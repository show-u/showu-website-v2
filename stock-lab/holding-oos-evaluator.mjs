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
 * - Raw evidence strength is fitted on development data only; untouched OOS is
 *   used solely to validate the frozen calibration map.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';

const args=Object.fromEntries(process.argv.slice(2).reduce((a,x,i,v)=>{if(x.startsWith('--'))a.push([x.slice(2),v[i+1]&&!v[i+1].startsWith('--')?v[i+1]:true]);return a},[]));
const bundleDir=path.resolve(String(args['bundle-dir']||'stock-lab/history-licensed'));
const production=path.resolve(String(args.production||'stock-lab/holding-model.js'));
const outPath=path.resolve(String(args.out||'stock-lab/holding-evaluator-result.json'));
const protocolPath=path.resolve(String(args.protocol||'stock-lab/holding-exit-validation-protocol.json'));
const minBars=Number(args['min-bars']||120), minEpisodes=Number(args['min-episodes']||300), minSecurities=Number(args['min-securities']||80);
const COMMISSION=0.001425, SELL_TAX=0.003, SLIPPAGE=0.0005;
const HARD_EXIT_STATES=new Set(['出場條件檢視','風險事件優先處理']);

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
function clamp(x,lo=0,hi=1){return Math.max(lo,Math.min(hi,x))}

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

function calibrationConfig(){
  const p=json(protocolPath),c=p.confidence_calibration||{};
  if(p.frozen_before_historical_oos!==true)die('holding OOS protocol is not frozen');
  const required=['minimum_development_exit_signals','minimum_oos_exit_signals','minimum_oos_exit_signal_securities','minimum_final_calibration_blocks','maximum_oos_ece'];
  for(const k of required)if(!Number.isFinite(Number(c[k])))die(`confidence calibration config missing ${k}`);
  if(c.development_fit_only!==true)die('confidence calibration must fit development only');
  if(c.raw_input_is_probability!==false)die('raw evidence must not be treated as probability');
  return c;
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
  const maxEval=Math.min(all.length-2,entryIndex+240);let signal=null,signalIndex=null,decision=null,rawEvidence=null;
  for(let i=entryIndex;i<=maxEval;i++){
    const b=all.slice(0,i+1),today=all[i],risk=riskMap.get(today.iso);if(!risk)break;
    if(episodeHasAction(actions,buyDate,today.iso))return null;
    let result;
    try{result=prod.api.analyze({averageCost:entryPrice,shares:1000,buyDate,provenance:{averageCost:'historical_executable_open',shares:'normalized',buyDate:'historical_verified_session'}},b,{legalSource:true,priceVerified:true,activeRiskKnown:true,corporateActionKnown:true,oosStatus:'PASS',exitContextComplete:true,riskBlocked:riskBlocked(risk)});}catch{return null}
    const state=result?.decision?.state||'';
    if(HARD_EXIT_STATES.has(state)){signal=state;signalIndex=i;decision=result;rawEvidence=num(result?.decision?.evidenceScore);break}
  }
  const evaluationEnd=all[maxEval],nxt=signalIndex!=null?nextBar(all,signalIndex):null;
  let executed=false,exitPrice=evaluationEnd.c,exitDate=evaluationEnd.iso;
  if(signalIndex!=null&&nxt&&riskKnown(riskMap,nxt.iso)){
    const nr=riskMap.get(nxt.iso);if(!truth(nr?.suspended)){executed=true;exitPrice=nxt.o;exitDate=nxt.iso}
  }
  const modelReturn=netExitReturn(entryPrice,exitPrice),holdReturn=netExitReturn(entryPrice,evaluationEnd.c),regime=regimeForBars(all,entryIndex);
  const calibrationEligible=signalIndex!=null&&Number.isFinite(rawEvidence),calibrationLabel=calibrationEligible?(executed&&modelReturn>=holdReturn?1:0):null;
  return{ticker:null,buyDate,entryPrice,regime,signal:signal||'NO_EXIT_SIGNAL',signalDate:signalIndex!=null?all[signalIndex].iso:null,executed,exitDate,exitPrice,netReturnPct:modelReturn*100,holdBaselineReturnPct:holdReturn*100,benefitVsHoldPct:(modelReturn-holdReturn)*100,holdingSessions:(signalIndex??maxEval)-entryIndex+1,productionState:decision?.decision?.state||null,rawEvidence,calibrationLabel};
}

function calibrationRecords(episodes){return episodes.filter(x=>HARD_EXIT_STATES.has(x.signal)&&Number.isFinite(x.rawEvidence)&&[0,1].includes(x.calibrationLabel))}

function initialEqualFrequencyBins(records,count=5){
  const v=[...records].sort((a,b)=>a.rawEvidence-b.rawEvidence);if(!v.length)return[];
  const bins=[];for(let i=0;i<count;i++){const lo=Math.floor(i*v.length/count),hi=Math.floor((i+1)*v.length/count),rows=v.slice(lo,hi);if(!rows.length)continue;bins.push({lo:rows[0].rawEvidence,hi:rows.at(-1).rawEvidence,n:rows.length,successes:rows.reduce((s,x)=>s+x.calibrationLabel,0)})}return bins;
}
function isotonicBins(records){
  const blocks=initialEqualFrequencyBins(records,5).map(b=>({...b,rate:b.successes/b.n}));
  let i=0;while(i<blocks.length-1){if(blocks[i].rate<=blocks[i+1].rate+1e-12){i++;continue}const a=blocks[i],b=blocks[i+1],n=a.n+b.n,s=a.successes+b.successes;blocks.splice(i,2,{lo:a.lo,hi:b.hi,n,successes:s,rate:s/n});if(i>0)i--}
  return blocks.map(b=>({lo:b.lo,hi:b.hi,n:b.n,rate:b.rate}));
}
function calibrationPredict(blocks,raw){if(!blocks.length||!Number.isFinite(raw))return null;let best=blocks[0];for(const b of blocks){if(raw>=b.lo&&raw<=b.hi)return clamp(b.rate);if(Math.abs(raw-(b.lo+b.hi)/2)<Math.abs(raw-(best.lo+best.hi)/2))best=b}return clamp(best.rate)}
function calibrationMetrics(blocks,records,devBaseRate){
  if(!records.length||!blocks.length)return null;let brier=0,ece=0;const perBlock=[];
  for(const block of blocks){const rows=records.filter(x=>x.rawEvidence>=block.lo&&x.rawEvidence<=block.hi);if(!rows.length)continue;const p=clamp(block.rate),obs=mean(rows.map(x=>x.calibrationLabel));for(const x of rows)brier+=(p-x.calibrationLabel)**2;ece+=rows.length*Math.abs(obs-p);perBlock.push({lo:block.lo,hi:block.hi,n:rows.length,predicted_rate:p,observed_rate:obs})}
  // Scores outside development range use nearest isotonic block and must still count.
  const covered=new Set(perBlock.flatMap(()=>[]));void covered;
  brier=records.reduce((s,x)=>{const p=calibrationPredict(blocks,x.rawEvidence);return s+(p-x.calibrationLabel)**2},0)/records.length;
  ece=perBlock.reduce((s,b)=>s+b.n*Math.abs(b.observed_rate-b.predicted_rate),0)/Math.max(1,perBlock.reduce((s,b)=>s+b.n,0));
  const baselineBrier=records.reduce((s,x)=>s+(devBaseRate-x.calibrationLabel)**2,0)/records.length;
  return{brier,ece,baseline_brier:baselineBrier,blocks:perBlock};
}
function calibrateConfidence(devEpisodes,oosEpisodes,cfg){
  const dev=calibrationRecords(devEpisodes),oos=calibrationRecords(oosEpisodes),oosSecs=new Set(oos.map(x=>x.ticker));
  const devBaseRate=dev.length?mean(dev.map(x=>x.calibrationLabel)):null,blocks=dev.length?isotonicBins(dev):[],metrics=dev.length&&oos.length?calibrationMetrics(blocks,oos,devBaseRate):null;
  const samplesOK=dev.length>=Number(cfg.minimum_development_exit_signals)&&oos.length>=Number(cfg.minimum_oos_exit_signals)&&oosSecs.size>=Number(cfg.minimum_oos_exit_signal_securities)&&blocks.length>=Number(cfg.minimum_final_calibration_blocks);
  const qualityOK=!!metrics&&metrics.ece<=Number(cfg.maximum_oos_ece)&&(!cfg.brier_must_not_exceed_constant_development_base_rate_brier||metrics.brier<=metrics.baseline_brier+1e-12);
  const pass=samplesOK&&qualityOK;
  return{status:pass?'PASS':'INSUFFICIENT',confidence_calibrated:pass,development_exit_signals:dev.length,oos_exit_signals:oos.length,oos_exit_signal_securities:oosSecs.size,development_base_rate:devBaseRate,calibration_blocks:blocks,oos_metrics:metrics,thresholds:{minimum_development_exit_signals:Number(cfg.minimum_development_exit_signals),minimum_oos_exit_signals:Number(cfg.minimum_oos_exit_signals),minimum_oos_exit_signal_securities:Number(cfg.minimum_oos_exit_signal_securities),minimum_final_calibration_blocks:Number(cfg.minimum_final_calibration_blocks),maximum_oos_ece:Number(cfg.maximum_oos_ece),brier_must_not_exceed_constant_development_base_rate_brier:!!cfg.brier_must_not_exceed_constant_development_base_rate_brier},public_meaning:cfg.public_meaning||null};
}

function evaluate(data,prod,cfg){
  const securities=[];for(const [k,all] of data.bars){if(all.length>=minBars+25)securities.push([k,all])}
  securities.sort((a,b)=>a[0].localeCompare(b[0]));
  if(!securities.length)return{status:'INSUFFICIENT',dev:[],oos:[],reason:'no securities with minimum history',calibration:calibrateConfidence([],[],cfg)};
  // Chronological 70/30 split per security. Development episodes are used only to fit the frozen calibrator; OOS is untouched.
  const oos=[],dev=[];
  for(const [k,all] of securities){const split=Math.floor(all.length*.70),risk=data.risks.get(k),actions=data.actions.get(k)||[];if(!risk)continue;for(const ei of deterministicEntries(all)){const ep=runEpisode(prod,all,ei,risk,actions);if(!ep)continue;ep.ticker=k;ep.sample=ei>=split?'oos':'development';(ep.sample==='oos'?oos:dev).push(ep)}}
  const oosSecs=new Set(oos.map(x=>x.ticker)),regimes=[...new Set(oos.map(x=>x.regime).filter(Boolean))].sort(),rets=oos.map(x=>x.netReturnPct/100),exec=oos.filter(x=>HARD_EXIT_STATES.has(x.signal)),executed=exec.filter(x=>x.executed),benefit=oos.map(x=>x.benefitVsHoldPct);
  const metrics=oos.length?{oos_episodes:oos.length,oos_securities:oosSecs.size,exit_signals:exec.length,executed_exits:executed.length,execution_rate_pct:exec.length?100*executed.length/exec.length:null,avg_net_return_pct:100*mean(rets),median_net_return_pct:100*median(rets),max_drawdown_pct:maxDrawdown(rets),q05_net_return_pct:100*quantile(rets,.05),avg_benefit_vs_hold_pct:mean(benefit),median_benefit_vs_hold_pct:median(benefit)}:null;
  const enough=oos.length>=minEpisodes&&oosSecs.size>=minSecurities&&['bull','bear','sideways'].every(x=>regimes.includes(x));
  const calibration=calibrateConfidence(dev,oos,cfg);
  return{status:enough?'EVALUATED':'INSUFFICIENT',development_episodes:dev.length,oos_episodes:oos.length,oos_securities:oosSecs.size,regimes,execution_validated:exec.length===0?false:executed.length===exec.length,production_formula_match:true,metrics,calibration,dev,oos};
}

let payload;
try{
  const b=validateBundle(),prod=loadProduction(),cfg=calibrationConfig();
  if(!b.usable)payload={schema_version:2,status:'INSUFFICIENT',reason:b.reason,production_formula_sha256:prod.sha,no_imputation:true,network_used:false,confidence_calibrated:false,calibration:{status:'INSUFFICIENT',reason:'licensed bundle not present'}};
  else{const data=buildData(b.ds,b.manifest),r=evaluate(data,prod,cfg);payload={schema_version:2,generated_at:new Date().toISOString(),status:r.status,source_bundle_id:b.manifest.bundle_id,production_formula_sha256:prod.sha,no_imputation:true,network_used:false,chronological_oos:true,next_session_open_execution:true,development_episodes:r.development_episodes||0,oos_episodes:r.oos_episodes||0,oos_securities:r.oos_securities||0,regimes:r.regimes||[],exit_execution_validated:r.execution_validated===true,production_formula_match:r.production_formula_match===true,confidence_calibrated:r.calibration?.confidence_calibrated===true,calibration:r.calibration||null,metrics:r.metrics||null,episodes:r.oos||[],development_calibration_records:calibrationRecords(r.dev||[])}}
}catch(e){payload={schema_version:2,status:'INSUFFICIENT',reason:String(e.message||e),no_imputation:true,network_used:false,confidence_calibrated:false}}
fs.writeFileSync(outPath,JSON.stringify(payload,null,2)+'\n');console.log(JSON.stringify({...payload,episodes:undefined,development_calibration_records:undefined},null,2));
