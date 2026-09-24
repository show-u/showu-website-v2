
const API='https://api.finmindtrade.com/api/v4/data';
const START='2018-01-01', END='2026-09-22';
const START_TS=Math.floor(new Date('2018-01-01T00:00:00Z').getTime()/1000);
const END_TS=Math.floor(new Date('2026-09-23T00:00:00Z').getTime()/1000);
const SEED=20261016, TARGET=90, H=84;

// Exclude every stock used in all previous research rounds.
const EX=new Set([
'2330','2454','2409','2881','1301','2434','1454','3419','4938','8499','4581','6525','6831','2009','8473','1437','6164','5264','6965','9942','2437','6153','5471','9938','5285','6541','4441','1262','4989','1618','6281','7765','6202','6919','7795','4566','1721','6230',
'8464','1512','3026','3593','2385','3168','3494','4169','2340','1101','3266','2316','3296','3346','4137','1465','2362','2033','2017','1475','1216','1220','1477','2321','3257','3596','3356','2328','1102','4164','2387','2236','3376','3532','3711','8021','2072','2630','6206','1605',
'2312','2443','3652','2497','2402','4915','3030','6438','1723','3563','6176','3583','9919','2485','2543','8110','2606','2480','2547','9935','3645','6906','2509','2498','2607','3686','8462','3543','2603','4763','2404','2530','2504','8443','6005','8438','3673','2495','4771','6592',
'4564','6213','6589','3706','6405','9937','6719','1722','6278','6443','6257','6183','8261','6152','9917','6531','6243','1707','1608','6272','1434','9902','6282','1453','1714','8466','6285','6689','6239','6177','1612','2816','6271','8131','2393','4414','3708','6796','6657','1110',
'2923','3380','1210','1304','2022','3164','2062','1808','3209','2365','3515','2233','2109','3406','2317','1529','2324','2373','1526','1905','1537','2354','1449','4562','2114','5521','2101','2305','4439','5258','4935','6117','3311','5007','1521','3557','6142','6136','2426','2484','2419','2323','4104','2540','4930','2453','5469','5538','2476','1103',
'3054','6550','3682','2867','2358','1701','2601','1441','8480','1589','2888','6806','3454','2809',
'1104','1203','1225','1231','1234','1256','1307','1321','1341','1413','1414','1416','1417','1443','1466','1471','1531','1583','1590','1597','1614','2208','2228','2243','2247','2302','2303','2327','2332','2356','2368','2374','2383','2408','2417','2428','2466','2534','2613','2614','2633','2727','3518','3679','3701','4532','4583','5906','6416','6431','6581','6691','6706','8249','8454','8940','9136','9912','9926','9930',
'1456','1504','1524','1584','1586','1784','1786','2064','2106','2221','2231','2308','2342','2352','2405','2412','2421','2429','2460','2643','2701','2726','2736','2754','2812','2910','2924','3081','3171','3219','3434','3483','3498','3558','3577','4168','4401','4406','4506','4572','4702','4907','5220','5340','5347','5353','5388','5484','5490','5512','5536','5607','6026','6113','6118','6134','6143','6158','6161','6165','6235','6275','6462','6625','6637','6732','8011','8024','8044','8048','8059','8071','8076','8077','8080','8114','8210','8222','8426','9907',
'1439','1455','1515','1516','1536','1708','1730','1810','1815','1903','2065','2364','2471','2849','2880','3432','3580','4131','4157','4502','4523','4934','5291','5355','5483','5488','5520','5604','6109','6122','6128','6151','6168','6171','6179','6186','6212','6223','6226','6261','6264','6269','6279','6412','6506','8043','8074','8083','8105','8933',
'1264','1325','1326','1336','1436','1438','1444','1446','1611','1734','1735','1762','1805','1813','1817','1909','2010','2031','2038','2059','2070','2102','2436','2718','3005','3622','3630','3675','3687','3694','3702','3704','3709','4107','4108','4419','5009','5013','5474','5523','5530','6023','6115','6116','6129','6191','6556','6590','6664','6671','6693','6703','6712','6716','6728','6752','8039','8171','8234','9918',
'1452','1472','1532','1593','2204','2235','2377','2414','2423','2425','2442','2489','2537','2608','2615','2634','2641','2724','2731','2801','3029','3031','3032','3036','3085','3094','3227','3260','3276','3285','3289','3317','3324','3325','3354','3363','3441','3450','3465','4142','4190','4306','4413','4545','4558','4609','4768','4905','4960','4974','5284','5457','5516','6016','6114','6163','6197','6204','6233','6415','6504','6584','6613','8066','8081','8086','8088','8101','8284','8354'
]);

const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);if(!r.ok)throw Error('info '+r.status);return (await r.json()).data||[]}
async function fm(dataset,id){for(let a=0;a<3;a++){const u=new URL(API);u.searchParams.set('dataset',dataset);u.searchParams.set('data_id',id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);const r=await fetch(u);if(r.ok)return (await r.json()).data||[];if(a===2)throw Error(dataset+' '+id+' '+r.status);await sleep(350*(a+1))}}
async function yahoo(code,sfx){
 const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+sfx+'?period1='+START_TS+'&period2='+END_TS+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';
 const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(!r.ok)throw Error(code+' '+r.status);
 const j=await r.json(),x=j?.chart?.result?.[0];if(!x)return [];
 const t=x.timestamp||[],adj=x.indicators?.adjclose?.[0]?.adjclose||[],cl=x.indicators?.quote?.[0]?.close||[],vol=x.indicators?.quote?.[0]?.volume||[],a=[];
 for(let i=0;i<t.length;i++){const v=Number.isFinite(adj[i])?adj[i]:cl[i];if(Number.isFinite(v)&&v>0)a.push({date:new Date(t[i]*1000).toISOString().slice(0,10),close:v,vol:Number.isFinite(vol[i])?vol[i]:null})}
 return a;
}
function dateAdd(d,days){return new Date(new Date(d+'T00:00:00Z').getTime()+days*86400000).toISOString().slice(0,10)}
function high52(p,i){if(i<251)return null;return p[i].close/Math.max(...p.slice(i-251,i+1).map(x=>x.close))}
function retN(p,i,n,b=0){if(i-n<0||i-b<0)return null;return p[i-b].close/p[i-n].close-1}
function vol60(p,i){if(i<60)return null;const rs=[];for(let j=i-59;j<=i;j++)rs.push(Math.log(p[j].close/p[j-1].close));const m=mean(rs);return Math.sqrt(mean(rs.map(x=>(x-m)**2)))*Math.sqrt(252)}
function volumeAccel(p,i){if(i<40)return null;const a=mean(p.slice(i-19,i+1).map(x=>x.vol).filter(Number.isFinite)),b=mean(p.slice(i-39,i-19).map(x=>x.vol).filter(Number.isFinite));return a>0&&b>0?Math.log(a/b):null}
function fwd(p,i){return p[i+H]?p[i+H].close/p[i].close-1:null}
function sue(fin,date){
 const cutoff=dateAdd(date,-70);
 const xs=fin.filter(x=>x.type==='IncomeAfterTaxes'&&x.date<=cutoff&&Number.isFinite(+x.value)).map(x=>({d:x.date,v:+x.value})).sort((a,b)=>a.d.localeCompare(b.d));
 if(xs.length<9)return null;const dif=[];for(let i=4;i<xs.length;i++)dif.push(xs[i].v-xs[i-4].v);if(dif.length<5)return null;
 const cur=dif[dif.length-1],hist=dif.slice(Math.max(0,dif.length-9),-1);const mu=mean(hist),s=Math.sqrt(mean(hist.map(x=>(x-mu)**2)));return s>0?(cur-mu)/s:null;
}
function revenueSurprise(rev,date){
 const y=+date.slice(0,4),m=+date.slice(5,7),day=+date.slice(8,10);let yy=y,mm=m-1;if(day<11)mm--;while(mm<=0){mm+=12;yy--}
 const rows=rev.map(x=>({y:+x.revenue_year,m:+x.revenue_month,v:+x.revenue})).filter(x=>x.v>0);const get=(Y,M)=>rows.find(x=>x.y===Y&&x.m===M)?.v??null;
 const cur=get(yy,mm),py=get(yy-1,mm);if(!(cur>0&&py>0))return null;const yoy=cur/py-1,h=[];
 for(let k=1;k<=12;k++){let M=mm-k,Y=yy;while(M<=0){M+=12;Y--}const a=get(Y,M),b=get(Y-1,M);if(a>0&&b>0)h.push(a/b-1)}
 return h.length>=6?yoy-median(h):null;
}
function rank(vals){const idx=vals.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),r=new Array(vals.length);let k=0;while(k<idx.length){let j=k;while(j+1<idx.length&&idx[j+1][0]===idx[k][0])j++;const rr=(k+j)/2+1;for(let z=k;z<=j;z++)r[idx[z][1]]=rr;k=j+1}return r}
function pct(vals){const r=rank(vals);return r.map(x=>(x-1)/(vals.length-1||1))}
function perm(vals,B=20000){let seed=918273;const r=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};const obs=mean(vals);let e=0;for(let b=0;b<B;b++)if(mean(vals.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function boot(vals,B=10000){let seed=827364;const r=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};const v=[];for(let b=0;b<B;b++){const a=[];for(let i=0;i<vals.length;i++)a.push(vals[Math.floor(r()*vals.length)]);v.push(mean(a))}return[q(v,.025),q(v,.975)]}

// candidate scoring rules are predeclared before any test-period outcome is inspected.
const RULES=[
 {name:'HIGH52',features:[['HIGH52',1]]},
 {name:'PEAD',features:[['PEAD',1]]},
 {name:'REV',features:[['REV',1]]},
 {name:'MOM6',features:[['MOM6',1]]},
 {name:'VOLACC',features:[['VOLACC',1]]},
 {name:'HIGH52_PEAD',features:[['HIGH52',1],['PEAD',1]]},
 {name:'HIGH52_REV',features:[['HIGH52',1],['REV',1]]},
 {name:'HIGH52_MOM6',features:[['HIGH52',1],['MOM6',1]]},
 {name:'PEAD_REV',features:[['PEAD',1],['REV',1]]},
 {name:'HIGH52_PEAD_REV',features:[['HIGH52',1],['PEAD',1],['REV',1]]},
 {name:'HIGH52_PEAD_MOM6',features:[['HIGH52',1],['PEAD',1],['MOM6',1]]},
 {name:'RIGHTTAIL_5',features:[['HIGH52',1],['PEAD',1],['REV',1],['MOM6',1],['VOLACC',1]]}
];

(async()=>{
 console.log('PROTOCOL',JSON.stringify({
  objective:'Find a robust way to raise the probability of catching right-tail winners rather than maximize average return',
  target:'future 84-trading-day return >= +20%',
  sample:'fourth independent fresh universe; every previously used stock excluded',
  trainTest:'2021-2023 training only selects one predeclared score; 2024-2026 is locked untouched test',
  rules:RULES.map(x=>x.name),
  selectionMetric:'training top-quintile winner-rate lift vs universe; tie-break by precision then mean return',
  finalMetrics:['test winner-rate lift','precision','recall of all winners','mean return','median return','bootstrap CI','permutation p'],
  noRetuning:'rule definitions and 20% threshold fixed before locked test'
 }));
 const raw=await info(),latest=new Map();
 for(const x of raw){if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||EX.has(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x)}
 const rd=rng(SEED),cand=[...latest.values()].sort(()=>rd()-.5),data={};
 for(const s of cand){
  if(Object.keys(data).length>=TARGET)break;
  try{
   const p=await yahoo(s.stock_id,s.type==='tpex'?'.TWO':'.TW');if(p.length<1200||p[0].date>'2019-07-01')continue;
   const [fin,rev]=await Promise.all([fm('TaiwanStockFinancialStatements',s.stock_id),fm('TaiwanStockMonthRevenue',s.stock_id)]);if(fin.length<20||rev.length<36)continue;
   data[s.stock_id]={p,map:new Map(p.map((x,i)=>[x.date,i])),fin,rev,name:s.stock_name,type:s.type};
  }catch(e){continue}
  await sleep(90);
 }
 console.log('LOCKED_STOCKS',JSON.stringify(Object.keys(data)));
 const base=data[Object.keys(data)[0]]?.p;if(!base)throw Error('no stocks');
 const dates=[];for(let i=252;i<base.length-H;i+=63){const d=base[i].date;if(d>='2021-01-01'&&d<='2026-04-30')dates.push(d)}
 console.log('LOCKED_DATES',JSON.stringify(dates));

 const snapshots=[];
 for(const date of dates){
  const rows=[];
  for(const [code,d] of Object.entries(data)){
   const i=d.map.get(date);if(i==null||i<252)continue;const ret=fwd(d.p,i);if(!Number.isFinite(ret))continue;
   const row={code,ret,winner:ret>=.20?1:0,
    HIGH52:high52(d.p,i),PEAD:sue(d.fin,date),REV:revenueSurprise(d.rev,date),MOM6:retN(d.p,i,126,21),VOLACC:volumeAccel(d.p,i),LOWVOL:(()=>{const v=vol60(d.p,i);return v==null?null:-v})()
   };rows.push(row);
  }
  if(rows.length<45)continue;
  // rank-normalize each feature cross-sectionally
  for(const f of ['HIGH52','PEAD','REV','MOM6','VOLACC','LOWVOL']){
   const valid=rows.filter(x=>Number.isFinite(x[f]));const pr=pct(valid.map(x=>x[f]));valid.forEach((x,i)=>x[f+'_R']=pr[i]);
  }
  for(const rule of RULES){
   for(const x of rows){const vals=rule.features.map(([f,w])=>Number.isFinite(x[f+'_R'])?w*x[f+'_R']:null);x[rule.name+'_S']=vals.every(Number.isFinite)?mean(vals):null}
  }
  snapshots.push({date,rows});
 }

 function evalRule(rule, snaps){
  const per=[];let totalW=0,caught=0,totalSel=0,totalSelW=0,allRet=[],selRet=[];
  for(const s of snaps){
   const r=s.rows.filter(x=>Number.isFinite(x[rule.name+'_S']));if(r.length<40)continue;
   const k=Math.max(5,Math.floor(r.length*.2)),sel=[...r].sort((a,b)=>b[rule.name+'_S']-a[rule.name+'_S']).slice(0,k),baseRate=mean(r.map(x=>x.winner)),prec=mean(sel.map(x=>x.winner)),lift=prec-baseRate;
   const winners=r.filter(x=>x.winner).length;totalW+=winners;caught+=sel.filter(x=>x.winner).length;totalSel+=sel.length;totalSelW+=sel.filter(x=>x.winner).length;allRet.push(...r.map(x=>x.ret));selRet.push(...sel.map(x=>x.ret));
   per.push({date:s.date,n:r.length,baseRate,precision:prec,lift,meanRet:mean(sel.map(x=>x.ret)),medianRet:median(sel.map(x=>x.ret))});
  }
  const lifts=per.map(x=>x.lift),means=per.map(x=>x.meanRet);
  return {nDates:per.length,avgBaseRate:mean(per.map(x=>x.baseRate)),avgPrecision:mean(per.map(x=>x.precision)),winnerLift:mean(lifts),winnerLiftPositive:lifts.filter(x=>x>0).length/lifts.length,permP:perm(lifts),ci:boot(lifts),recall:totalW?caught/totalW:null,pooledPrecision:totalSel?totalSelW/totalSel:null,meanSelectedReturn:mean(means),medianSelectedReturn:median(selRet),perDate:per};
 }
 const train=snapshots.filter(x=>x.date<'2024-01-01'),test=snapshots.filter(x=>x.date>='2024-01-01');
 const trainRes={};for(const r of RULES)trainRes[r.name]=evalRule(r,train);
 const chosen=[...RULES].sort((a,b)=>{
   const A=trainRes[a.name],B=trainRes[b.name];
   if(B.winnerLift!==A.winnerLift)return B.winnerLift-A.winnerLift;
   if(B.avgPrecision!==A.avgPrecision)return B.avgPrecision-A.avgPrecision;
   return B.meanSelectedReturn-A.meanSelectedReturn;
 })[0];
 console.log('CHOSEN',JSON.stringify({name:chosen.name,train:trainRes[chosen.name]}));
 const testAll={};for(const r of RULES)testAll[r.name]=evalRule(r,test);
 const final=testAll[chosen.name];

 // Stability stress: top decile and top 30% for chosen score, reported only as sensitivity, not model selection.
 function evalCut(frac){
  const per=[];for(const s of test){const r=s.rows.filter(x=>Number.isFinite(x[chosen.name+'_S']));if(r.length<40)continue;const k=Math.max(3,Math.floor(r.length*frac)),sel=[...r].sort((a,b)=>b[chosen.name+'_S']-a[chosen.name+'_S']).slice(0,k);per.push(mean(sel.map(x=>x.winner))-mean(r.map(x=>x.winner)))}
  return {frac,meanLift:mean(per),positive:per.filter(x=>x>0).length/per.length,p:perm(per),ci:boot(per)};
 }
 console.log('RESULT',JSON.stringify({
   nStocks:Object.keys(data).length,nDates:snapshots.length,trainDates:train.length,testDates:test.length,
   chosenRule:chosen.name,train:trainRes[chosen.name],lockedTest:final,
   sensitivity:[evalCut(.10),evalCut(.30)],
   allLockedTestRules:testAll
 }));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
