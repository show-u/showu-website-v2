#!/usr/bin/env node
/**
 * Production-equivalent historical evaluator for TW-holding-exit-v4.
 *
 * Hard rules:
 * - Loads the actual holding-model.js and calls StockLabHolding.analyze directly.
 * - Reads only an already-validated licensed bundle on disk; no network access.
 * - No imputation, proxy data, future high/low execution, or OOS retuning.
 * - A signal formed from completed-session data executes no earlier than the next
 *   verified tradable session using that session OPEN (never hindsight high/low).
 * - Corporate-action/risk-state uncertainty excludes the episode/session.
 * - Bull/bear/sideways labels come only from licensed broad-market index history.
 * - Same-security episodes do not overlap.
 * - Development and untouched OOS are separated before episode generation.
 * - Baselines, uncertainty, walk-forward reporting and calibration gates are frozen
 *   in holding-exit-validation-protocol.json before licensed OOS is viewed.
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
function mean(a){const v=a.filter(Number.isFinite);return v.length?v.reduce((x,y)=>x+y,0)/v.length:null}
function median(a){const v=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!v.length)return null;const m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2}
function quantile(a,q){const v=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!v.length)return null;const p=(v.length-1)*q,l=Math.floor(p),h=Math.ceil(p);return l===h?v[l]:v[l]+(v[h]-v[l])*(p-l)}
function maxDrawdown(returns){let e=1,p=1,m=0;for(const r of returns){if(!Number.isFinite(r))continue;e*=1+r;p=Math.max(p,e);m=Math.min(m,e/p-1)}return m*100}
function clamp(x,lo=0,hi=1){return Math.max(lo,Math.min(hi,x))}
function uniq(a){return[...new Set(a)]}

function validateBundle(){
  const mp=path.join(bundleDir,'manifest.json');if(!fs.existsSync(mp))return{usable:false,reason:'licensed bundle not present'};
  const m=json(mp),L=m.license||{};
  if(!(L.automated_processing_allowed===true&&L.derived_outputs_allowed===true&&L.public_derived_outputs_allowed===true&&L.local_storage_allowed===true&&m.no_imputation===true&&m.network_collection_performed_by_importer===false))die('licensed rights/integrity gate failed');
  const required=['security_master','trading_calendar','daily_ohlc','corporate_actions','risk_states','market_index'];
  const ds={};for(const n of required){const d=m.datasets?.[n];if(!d)die(`missing dataset ${n}`);const p=path.join(bundleDir,String(d.path||''));if(!fs.existsSync(p)||sha256(p)!==d.sha256)die(`checksum failed ${n}`);ds[n]=rowsFrom(p,d.format)}
  return{usable:true,manifest:m,ds};
}

function loadProduction(){
  const code=fs.readFileSync(production,'utf8');
  const sandbox={window:{},console};vm.createContext(sandbox);vm.runInContext(code,sandbox,{filename:production});
  const api=sandbox.window.StockLabHolding;if(!api?.analyze)die('production holding-model.js did not expose StockLabHolding.analyze');
  return{api,sha:sha256(production)};
}

function protocolConfig(){
  const p=json(protocolPath),c=p.confidence_calibration||{},s=p.split_and_statistics||{},m=p.formal_machine_gate||{},e=p.evaluation||{};
  if(p.frozen_before_historical_oos!==true)die('holding OOS protocol is not frozen');
  const requiredCal=['minimum_development_exit_signals','minimum_oos_exit_signals','minimum_oos_exit_signal_securities','minimum_final_calibration_blocks','maximum_oos_ece'];
  for(const k of requiredCal)if(!Number.isFinite(Number(c[k])))die(`confidence calibration config missing ${k}`);
  if(c.development_fit_only!==true||c.raw_input_is_probability!==false)die('confidence calibration contract invalid');
  const requiredMachine=['minimum_avg_benefit_vs_hold_pct','minimum_avg_benefit_vs_ma20_pct','maximum_q05_worsening_vs_hold_pct_points','maximum_q05_worsening_vs_ma20_pct_points','maximum_mdd_worsening_vs_hold_pct_points','maximum_mdd_worsening_vs_ma20_pct_points','minimum_cluster_bootstrap_lower95_avg_benefit_vs_hold_pct','minimum_cluster_bootstrap_lower95_avg_benefit_vs_ma20_pct'];
  for(const k of requiredMachine)if(!Number.isFinite(Number(m[k])))die(`formal machine gate missing ${k}`);
  return{
    protocol:p,calibration:c,machine:m,
    developmentFraction:Number(s.development_fraction||.70),
    minWalkBlocks:Number(s.minimum_walk_forward_blocks||3),
    minEpisodesPerWalkBlock:Number(s.minimum_episodes_per_walk_forward_block||30),
    bootstrapResamples:Number(s.bootstrap_resamples||500),
    evalWindow:Number(e.episode_evaluation_window_sessions||240),
    maBaselinePeriod:Number(e.simple_ma_baseline_period||20),
    requiredRegimes:s.minimum_regime_coverage||['bull','bear','sideways']
  };
}

function validOn(meta,date){const from=String(meta?.valid_from||''),to=String(meta?.valid_to||'');return !!from&&date>=from&&(!to||date<=to)}
function buildData(ds,manifest){
  const master=new Map(ds.security_master.filter(x=>x.security_type==='ordinary_stock').map(x=>[key(x.market,String(x.ticker)),x]));
  const calendar=new Map();for(const x of ds.trading_calendar){if(!truth(x.is_trading_day))continue;(calendar.get(x.market)||calendar.set(x.market,[]).get(x.market)).push(String(x.date))}for(const v of calendar.values())v.sort();
  const bars=new Map();
  for(const x of ds.daily_ohlc){const k=key(x.market,String(x.ticker)),meta=master.get(k),date=String(x.date),o=num(x.open),h=num(x.high),l=num(x.low),c=num(x.close),v=num(x.volume);if(!meta||!validOn(meta,date)||![o,h,l,c].every(z=>z>0)||h<Math.max(o,l,c)||l>Math.min(o,h,c))continue;(bars.get(k)||bars.set(k,[]).get(k)).push({iso:date,d:date,o,h,l,c,v})}
  for(const v of bars.values()){v.sort((a,b)=>a.iso.localeCompare(b.iso));const seen=new Set();for(const x of v){if(seen.has(x.iso))die(`duplicate OHLC session ${x.iso}`);seen.add(x.iso)}}
  const actions=new Map();for(const x of ds.corporate_actions){const k=key(x.market,String(x.ticker));(actions.get(k)||actions.set(k,[]).get(k)).push(x)}
  const risks=new Map();for(const x of ds.risk_states){const k=key(x.market,String(x.ticker));(risks.get(k)||risks.set(k,new Map()).get(k)).set(String(x.date),x)}
  const marketIndex=new Map(),indexCodes=new Map();
  for(const x of ds.market_index){const market=String(x.market),date=String(x.date),code=String(x.index_code||''),close=num(x.close);if(!['TWSE','TPEx'].includes(market)||!code||!(close>0))continue;(indexCodes.get(market)||indexCodes.set(market,new Set()).get(market)).add(code);(marketIndex.get(market)||marketIndex.set(market,[]).get(market)).push({date,close,index_code:code})}
  for(const [market,codes] of indexCodes)if(codes.size!==1)die(`market_index must contain exactly one broad index_code for ${market}; found ${[...codes].join(',')}`);
  for(const [market,v] of marketIndex){v.sort((a,b)=>a.date.localeCompare(b.date));const seen=new Set();for(const z of v){if(seen.has(z.date))die(`market_index duplicate date for ${market}: ${z.date}`);seen.add(z.date)}}
  return{master,calendar,bars,actions,risks,marketIndex,indexCodes,manifest};
}

function actionNeutral(x){const t=String(x.action_type||'').trim().toLowerCase();return !t||['none','no_action','normal'].includes(t)}
function episodeHasAction(actions,from,to){return (actions||[]).some(x=>String(x.effective_date)>=from&&String(x.effective_date)<=to&&!actionNeutral(x))}
function riskKnown(riskMap,date){return riskMap?.has(date)===true}
function riskBlocked(r){return truth(r?.disposition)||truth(r?.suspended)}
function netExitReturn(entry,exit){return exit*(1-COMMISSION-SELL_TAX-SLIPPAGE)/(entry*(1+COMMISSION+SLIPPAGE))-1}

function regimeForMarket(data,market,date){
  const all=data.marketIndex.get(market)||[],i=all.findIndex(x=>x.date===date);if(i<119)return null;
  const c=all[i].close,ma20=mean(all.slice(i-19,i+1).map(x=>x.close)),ma60=mean(all.slice(i-59,i+1).map(x=>x.close)),ma120=mean(all.slice(i-119,i+1).map(x=>x.close));
  if(![c,ma20,ma60,ma120].every(Number.isFinite))return null;
  if(c>ma20&&ma20>ma60&&ma60>ma120)return'bull';
  if(c<ma20&&ma20<ma60&&ma60<ma120)return'bear';
  return'sideways';
}

function nextExecutableOpen(all,signalIndex,maxEval,riskMap){
  let delay=0;
  for(let j=signalIndex+1;j<=maxEval;j++,delay++){
    const x=all[j],risk=riskMap?.get(x.iso);if(!risk)break;
    if(!truth(risk.suspended)&&Number.isFinite(x.o)&&x.o>0)return{executed:true,index:j,price:x.o,date:x.iso,delaySessions:delay};
  }
  return{executed:false,index:null,price:null,date:null,delaySessions:null};
}

function maBaseline(all,entryIndex,maxEval,riskMap,period){
  let signalIndex=null;
  for(let i=Math.max(entryIndex+1,period-1);i<maxEval;i++){
    const w=all.slice(i-period+1,i+1),ma=mean(w.map(x=>x.c));if(!Number.isFinite(ma))continue;
    if(all[i].c<ma){signalIndex=i;break}
  }
  const end=all[maxEval];if(signalIndex==null)return{signalDate:null,executed:false,exitIndex:maxEval,exitDate:end.iso,exitPrice:end.c,delaySessions:null};
  const ex=nextExecutableOpen(all,signalIndex,maxEval,riskMap);
  return ex.executed?{signalDate:all[signalIndex].iso,executed:true,exitIndex:ex.index,exitDate:ex.date,exitPrice:ex.price,delaySessions:ex.delaySessions}:{signalDate:all[signalIndex].iso,executed:false,exitIndex:maxEval,exitDate:end.iso,exitPrice:end.c,delaySessions:null};
}

function runEpisode(prod,data,market,all,entryIndex,riskMap,actions,cfg,limitIndex){
  const entry=all[entryIndex],entryPrice=entry.o,buyDate=entry.iso;if(!(entryPrice>0)||!riskKnown(riskMap,buyDate))return null;
  const regime=regimeForMarket(data,market,buyDate);if(!regime)return null;
  const maxEval=Math.min(limitIndex,all.length-2,entryIndex+cfg.evalWindow);if(maxEval<=entryIndex)return null;
  if(episodeHasAction(actions,buyDate,all[maxEval].iso))return null;
  let signal=null,signalIndex=null,decision=null,rawEvidence=null;
  for(let i=entryIndex;i<=maxEval;i++){
    const b=all.slice(0,i+1),today=all[i],risk=riskMap.get(today.iso);if(!risk)return null;
    let result;
    try{result=prod.api.analyze({averageCost:entryPrice,shares:1000,buyDate,provenance:{averageCost:'historical_executable_open',shares:'normalized',buyDate:'historical_verified_session'}},b,{legalSource:true,priceVerified:true,activeRiskKnown:true,corporateActionKnown:true,oosStatus:'PASS',exitContextComplete:true,riskBlocked:riskBlocked(risk)});}catch{return null}
    const state=result?.decision?.state||'';
    if(HARD_EXIT_STATES.has(state)){signal=state;signalIndex=i;decision=result;rawEvidence=num(result?.decision?.evidenceScore);break}
  }
  const evaluationEnd=all[maxEval];
  const modelExec=signalIndex==null?{executed:false,index:maxEval,price:evaluationEnd.c,date:evaluationEnd.iso,delaySessions:null}:nextExecutableOpen(all,signalIndex,maxEval,riskMap);
  const executed=signalIndex!=null&&modelExec.executed===true,exitPrice=executed?modelExec.price:evaluationEnd.c,exitDate=executed?modelExec.date:evaluationEnd.iso,exitIndex=executed?modelExec.index:maxEval;
  const ma=maBaseline(all,entryIndex,maxEval,riskMap,cfg.maBaselinePeriod);
  const modelReturn=netExitReturn(entryPrice,exitPrice),holdReturn=netExitReturn(entryPrice,evaluationEnd.c),maReturn=netExitReturn(entryPrice,ma.exitPrice);
  const calibrationEligible=signalIndex!=null&&Number.isFinite(rawEvidence),calibrationLabel=calibrationEligible?(executed&&modelReturn>=holdReturn?1:0):null;
  return{
    ticker:null,buyDate,entryPrice,regime,signal:signal||'NO_EXIT_SIGNAL',signalDate:signalIndex!=null?all[signalIndex].iso:null,executed,exitDate,exitPrice,exitDelaySessions:executed?modelExec.delaySessions:null,
    evaluationEndDate:evaluationEnd.iso,evaluationEndIndex:maxEval,netReturnPct:modelReturn*100,holdBaselineReturnPct:holdReturn*100,ma20BaselineReturnPct:maReturn*100,
    benefitVsHoldPct:(modelReturn-holdReturn)*100,benefitVsMA20Pct:(modelReturn-maReturn)*100,holdingSessions:exitIndex-entryIndex+1,episodeSessions:maxEval-entryIndex+1,
    ma20Baseline:{signalDate:ma.signalDate,executed:ma.executed,exitDate:ma.exitDate,exitPrice:ma.exitPrice,delaySessions:ma.delaySessions},
    productionState:decision?.decision?.state||null,rawEvidence,calibrationLabel
  };
}

function sampleNonOverlapping(prod,data,k,all,risk,actions,cfg,start,end,sample){
  const out=[];let i=Math.max(minBars-1,start);
  while(i<end-1){
    const ep=runEpisode(prod,data,k.split(':',1)[0],all,i,risk,actions,cfg,end-1);
    if(ep){ep.ticker=k;ep.sample=sample;out.push(ep);i=ep.evaluationEndIndex+1}else i++;
  }
  return out;
}

function calibrationRecords(episodes){return episodes.filter(x=>HARD_EXIT_STATES.has(x.signal)&&Number.isFinite(x.rawEvidence)&&[0,1].includes(x.calibrationLabel))}
function initialEqualFrequencyBins(records,count=5){const v=[...records].sort((a,b)=>a.rawEvidence-b.rawEvidence);if(!v.length)return[];const bins=[];for(let i=0;i<count;i++){const lo=Math.floor(i*v.length/count),hi=Math.floor((i+1)*v.length/count),rows=v.slice(lo,hi);if(!rows.length)continue;bins.push({lo:rows[0].rawEvidence,hi:rows.at(-1].rawEvidence,n:rows.length,successes:rows.reduce((s,x)=>s+x.calibrationLabel,0)})}return bins}
function isotonicBins(records){const blocks=initialEqualFrequencyBins(records,5).map(b=>({...b,rate:b.successes/b.n}));let i=0;while(i<blocks.length-1){if(blocks[i].rate<=blocks[i+1].rate+1e-12){i++;continue}const a=blocks[i],b=blocks[i+1],n=a.n+b.n,s=a.successes+b.successes;blocks.splice(i,2,{lo:a.lo,hi:b.hi,n,successes:s,rate:s/n});if(i>0)i--}return blocks.map(b=>({lo:b.lo,hi:b.hi,n:b.n,rate:b.rate}))}
function calibrationPredict(blocks,raw){if(!blocks.length||!Number.isFinite(raw))return null;let best=blocks[0];for(const b of blocks){if(raw>=b.lo&&raw<=b.hi)return clamp(b.rate);if(Math.abs(raw-(b.lo+b.hi)/2)<Math.abs(raw-(best.lo+best.hi)/2))best=b}return clamp(best.rate)}
function calibrationMetrics(blocks,records,devBaseRate){
  if(!records.length||!blocks.length)return null;
  const brier=records.reduce((s,x)=>{const p=calibrationPredict(blocks,x.rawEvidence);return s+(p-x.calibrationLabel)**2},0)/records.length;
  const baselineBrier=records.reduce((s,x)=>s+(devBaseRate-x.calibrationLabel)**2,0)/records.length;
  const groups=new Map();for(const x of records){const p=calibrationPredict(blocks,x.rawEvidence),k=p.toFixed(8),g=groups.get(k)||{p,n:0,y:0};g.n++;g.y+=x.calibrationLabel;groups.set(k,g)}
  const perBlock=[...groups.values()].map(g=>({n:g.n,predicted_rate:g.p,observed_rate:g.y/g.n})),ece=perBlock.reduce((s,b)=>s+b.n*Math.abs(b.observed_rate-b.predicted_rate),0)/records.length;
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

function episodeMetrics(rows){
  if(!rows.length)return null;
  const model=rows.map(x=>x.netReturnPct/100),hold=rows.map(x=>x.holdBaselineReturnPct/100),ma=rows.map(x=>x.ma20BaselineReturnPct/100),benefitH=rows.map(x=>x.benefitVsHoldPct),benefitM=rows.map(x=>x.benefitVsMA20Pct);
  const signals=rows.filter(x=>HARD_EXIT_STATES.has(x.signal)),executed=signals.filter(x=>x.executed),delays=executed.map(x=>x.exitDelaySessions).filter(Number.isFinite);
  return{
    episodes:rows.length,securities:new Set(rows.map(x=>x.ticker)).size,exit_signals:signals.length,executed_exits:executed.length,execution_rate_pct:signals.length?100*executed.length/signals.length:null,
    avg_net_return_pct:100*mean(model),median_net_return_pct:100*median(model),model_max_drawdown_pct:maxDrawdown(model),model_q05_net_return_pct:100*quantile(model,.05),
    hold_avg_net_return_pct:100*mean(hold),hold_max_drawdown_pct:maxDrawdown(hold),hold_q05_net_return_pct:100*quantile(hold,.05),
    ma20_avg_net_return_pct:100*mean(ma),ma20_max_drawdown_pct:maxDrawdown(ma),ma20_q05_net_return_pct:100*quantile(ma,.05),
    avg_benefit_vs_hold_pct:mean(benefitH),median_benefit_vs_hold_pct:median(benefitH),avg_benefit_vs_ma20_pct:mean(benefitM),median_benefit_vs_ma20_pct:median(benefitM),
    median_exit_delay_sessions:delays.length?median(delays):null,max_exit_delay_sessions:delays.length?Math.max(...delays):null
  };
}

function walkForward(oos,cfg){
  if(!oos.length)return{verified:false,blocks:[]};
  const v=[...oos].sort((a,b)=>a.buyDate.localeCompare(b.buyDate)||a.ticker.localeCompare(b.ticker)),n=cfg.minWalkBlocks,blocks=[];
  for(let i=0;i<n;i++){const lo=Math.floor(i*v.length/n),hi=Math.floor((i+1)*v.length/n),rows=v.slice(lo,hi);blocks.push({index:i+1,from:rows[0]?.buyDate||null,to:rows.at(-1)?.buyDate||null,n:rows.length,metrics:episodeMetrics(rows)})}
  return{verified:blocks.length>=n&&blocks.every(x=>x.n>=cfg.minEpisodesPerWalkBlock),minimum_blocks:n,minimum_episodes_per_block:cfg.minEpisodesPerWalkBlock,blocks};
}

function seeded(seed=0x5a17c9e3){let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296}}
function clusterBootstrap(oos,resamples){
  const groups=new Map();for(const e of oos)(groups.get(e.ticker)||groups.set(e.ticker,[]).get(e.ticker)).push(e);
  const keys=[...groups.keys()].sort();if(keys.length<2||resamples<100)return{verified:false,resamples:0};
  const rand=seeded(),hold=[],ma=[];
  for(let r=0;r<resamples;r++){
    const rows=[];for(let i=0;i<keys.length;i++){const k=keys[Math.floor(rand()*keys.length)];rows.push(...groups.get(k))}
    hold.push(mean(rows.map(x=>x.benefitVsHoldPct)));ma.push(mean(rows.map(x=>x.benefitVsMA20Pct)));
  }
  return{verified:true,resamples,securities:keys.length,avg_benefit_vs_hold_pct:{lower95:quantile(hold,.025),median:quantile(hold,.5),upper95:quantile(hold,.975)},avg_benefit_vs_ma20_pct:{lower95:quantile(ma,.025),median:quantile(ma,.5),upper95:quantile(ma,.975)}};
}

function noOverlap(episodes){
  const by=new Map();for(const e of episodes)(by.get(e.ticker)||by.set(e.ticker,[]).get(e.ticker)).push(e);
  for(const rows of by.values()){rows.sort((a,b)=>a.buyDate.localeCompare(b.buyDate));for(let i=1;i<rows.length;i++)if(rows[i].buyDate<=rows[i-1].evaluationEndDate)return false}
  return true;
}

function formalPerformanceGate(metrics,boot,cfg){
  if(!metrics||!boot?.verified)return{pass:false,checks:{}};
  const m=cfg.machine,checks={
    avg_vs_hold:metrics.avg_benefit_vs_hold_pct>=Number(m.minimum_avg_benefit_vs_hold_pct),
    avg_vs_ma20:metrics.avg_benefit_vs_ma20_pct>=Number(m.minimum_avg_benefit_vs_ma20_pct),
    q05_vs_hold:metrics.model_q05_net_return_pct>=metrics.hold_q05_net_return_pct-Number(m.maximum_q05_worsening_vs_hold_pct_points),
    q05_vs_ma20:metrics.model_q05_net_return_pct>=metrics.ma20_q05_net_return_pct-Number(m.maximum_q05_worsening_vs_ma20_pct_points),
    mdd_vs_hold:metrics.model_max_drawdown_pct>=metrics.hold_max_drawdown_pct-Number(m.maximum_mdd_worsening_vs_hold_pct_points),
    mdd_vs_ma20:metrics.model_max_drawdown_pct>=metrics.ma20_max_drawdown_pct-Number(m.maximum_mdd_worsening_vs_ma20_pct_points),
    bootstrap_vs_hold:boot.avg_benefit_vs_hold_pct.lower95>=Number(m.minimum_cluster_bootstrap_lower95_avg_benefit_vs_hold_pct),
    bootstrap_vs_ma20:boot.avg_benefit_vs_ma20_pct.lower95>=Number(m.minimum_cluster_bootstrap_lower95_avg_benefit_vs_ma20_pct)
  };
  return{pass:Object.values(checks).every(Boolean),checks,thresholds:m};
}

function evaluate(data,prod,cfg){
  const securities=[];for(const [k,all] of data.bars){if(all.length>=minBars+25)securities.push([k,all])}securities.sort((a,b)=>a[0].localeCompare(b[0]));
  if(!securities.length)return{status:'INSUFFICIENT',dev:[],oos:[],reason:'no securities with minimum history',calibration:calibrateConfidence([],[],cfg.calibration)};
  const oos=[],dev=[];
  for(const [k,all] of securities){
    const split=Math.floor(all.length*cfg.developmentFraction),risk=data.risks.get(k),actions=data.actions.get(k)||[];if(!risk||split<=minBars)continue;
    dev.push(...sampleNonOverlapping(prod,data,k,all,risk,actions,cfg,0,split,'development'));
    oos.push(...sampleNonOverlapping(prod,data,k,all,risk,actions,cfg,split,all.length,'oos'));
  }
  const oosSecs=new Set(oos.map(x=>x.ticker)),regimes=uniq(oos.map(x=>x.regime).filter(Boolean)).sort(),metrics=episodeMetrics(oos),enough=oos.length>=minEpisodes&&oosSecs.size>=minSecurities&&cfg.requiredRegimes.every(x=>regimes.includes(x));
  const calibration=calibrateConfidence(dev,oos,cfg.calibration),overlapOK=noOverlap(oos),walk=walkForward(oos,cfg),boot=clusterBootstrap(oos,cfg.bootstrapResamples),performance=formalPerformanceGate(metrics,boot,cfg);
  const executionValidated=!!metrics&&metrics.exit_signals>0&&metrics.executed_exits===metrics.exit_signals;
  const formalPass=enough&&overlapOK&&walk.verified&&boot.verified&&executionValidated&&calibration.confidence_calibrated===true&&performance.pass;
  return{
    status:formalPass?'PASS':enough?'EVALUATED':'INSUFFICIENT',development_episodes:dev.length,oos_episodes:oos.length,oos_securities:oosSecs.size,regimes,
    execution_validated:executionValidated,production_formula_match:true,non_overlapping_oos_verified:overlapOK,walk_forward_verified:walk.verified,baseline_comparison_verified:!!metrics,
    cluster_uncertainty_verified:boot.verified,formal_performance_gate:performance.pass,metrics,walk_forward:walk,cluster_bootstrap:boot,performance_gate:performance,calibration,dev,oos
  };
}

let payload;
try{
  const b=validateBundle(),prod=loadProduction(),cfg=protocolConfig();
  if(!b.usable)payload={schema_version:3,status:'INSUFFICIENT',reason:b.reason,production_formula_sha256:prod.sha,no_imputation:true,network_used:false,confidence_calibrated:false,market_regime_source:null,formal_performance_gate:false,non_overlapping_oos_verified:false,walk_forward_verified:false,baseline_comparison_verified:false,cluster_uncertainty_verified:false,calibration:{status:'INSUFFICIENT',reason:'licensed bundle not present'}};
  else{
    const data=buildData(b.ds,b.manifest),r=evaluate(data,prod,cfg);
    payload={schema_version:3,generated_at:new Date().toISOString(),status:r.status,source_bundle_id:b.manifest.bundle_id,production_formula_sha256:prod.sha,no_imputation:true,network_used:false,chronological_oos:true,next_session_open_execution:true,development_episodes:r.development_episodes||0,oos_episodes:r.oos_episodes||0,oos_securities:r.oos_securities||0,regimes:r.regimes||[],market_regime_source:'licensed_market_index',exit_execution_validated:r.execution_validated===true,production_formula_match:r.production_formula_match===true,non_overlapping_oos_verified:r.non_overlapping_oos_verified===true,walk_forward_verified:r.walk_forward_verified===true,baseline_comparison_verified:r.baseline_comparison_verified===true,cluster_uncertainty_verified:r.cluster_uncertainty_verified===true,formal_performance_gate:r.formal_performance_gate===true,confidence_calibrated:r.calibration?.confidence_calibrated===true,calibration:r.calibration||null,metrics:r.metrics||null,walk_forward:r.walk_forward||null,cluster_bootstrap:r.cluster_bootstrap||null,performance_gate:r.performance_gate||null,episodes:r.oos||[],development_calibration_records:calibrationRecords(r.dev||[])};
  }
}catch(e){payload={schema_version:3,status:'INSUFFICIENT',reason:String(e.message||e),no_imputation:true,network_used:false,confidence_calibrated:false,market_regime_source:null,formal_performance_gate:false,non_overlapping_oos_verified:false,walk_forward_verified:false,baseline_comparison_verified:false,cluster_uncertainty_verified:false}}
fs.writeFileSync(outPath,JSON.stringify(payload,null,2)+'\n');console.log(JSON.stringify({...payload,episodes:undefined,development_calibration_records:undefined},null,2));
