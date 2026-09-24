
const API='https://api.finmindtrade.com/api/v4/data';
const START='2019-01-01',END='2026-09-22';
const START_TS=Math.floor(new Date('2019-01-01T00:00:00Z').getTime()/1000);
const END_TS=Math.floor(new Date('2026-09-23T00:00:00Z').getTime()/1000);
const SEED=20261013,TARGET=70,H=84;

// Exclude every stock used in prior rounds including both fresh comparison samples.
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
'1264','1325','1326','1336','1436','1438','1444','1446','1611','1734','1735','1762','1805','1813','1817','1909','2010','2031','2038','2059','2070','2102','2436','2718','3005','3622','3630','3675','3687','3694','3702','3704','3709','4107','4108','4419','5009','5013','5474','5523','5530','6023','6115','6116','6129','6191','6556','6590','6664','6671','6693','6703','6712','6716','6728','6752','8039','8171','8234','9918'
]);

const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function fm(dataset,id){
 for(let a=0;a<3;a++){
  const u=new URL(API);u.searchParams.set('dataset',dataset);if(id)u.searchParams.set('data_id',id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);
  const r=await fetch(u);if(r.ok){const j=await r.json();return j.data||[]}
  if(a===2)throw Error(dataset+' '+(id||'')+' '+r.status);await sleep(350*(a+1));
 }
}
async function info(){
 const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');
 const r=await fetch(u);if(!r.ok)throw Error('info '+r.status);return (await r.json()).data||[];
}
async function yahoo(code,sfx){
 const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+sfx+'?period1='+START_TS+'&period2='+END_TS+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';
 const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(!r.ok)throw Error(code+' '+r.status);
 const j=await r.json(),x=j?.chart?.result?.[0];if(!x)return [];
 const t=x.timestamp||[],adj=x.indicators?.adjclose?.[0]?.adjclose||[],cl=x.indicators?.quote?.[0]?.close||[],a=[];
 for(let i=0;i<t.length;i++){const v=Number.isFinite(adj[i])?adj[i]:cl[i];if(Number.isFinite(v)&&v>0)a.push({date:new Date(t[i]*1000).toISOString().slice(0,10),close:v})}
 return a;
}
function dateAdd(d,days){return new Date(new Date(d+'T00:00:00Z').getTime()+days*86400000).toISOString().slice(0,10)}
function high52(p,i){if(i<251)return null;return p[i].close/Math.max(...p.slice(i-251,i+1).map(x=>x.close))}
function fwd(p,i){return p[i+H]?p[i+H].close/p[i].close-1:null}
function sue(fin,date){
 const cutoff=dateAdd(date,-70);
 const xs=fin.filter(x=>x.type==='IncomeAfterTaxes'&&x.date<=cutoff&&Number.isFinite(+x.value)).map(x=>({d:x.date,v:+x.value})).sort((a,b)=>a.d.localeCompare(b.d));
 if(xs.length<9)return null;
 const diffs=[];for(let i=4;i<xs.length;i++)diffs.push({d:xs[i].d,v:xs[i].v-xs[i-4].v});
 if(diffs.length<5)return null;
 const cur=diffs[diffs.length-1],hist=diffs.slice(Math.max(0,diffs.length-9),-1).map(x=>x.v);if(hist.length<4)return null;
 const mu=mean(hist),s=Math.sqrt(mean(hist.map(x=>(x-mu)**2)));return s>0?(cur.v-mu)/s:null;
}
function rank(vals){const idx=vals.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),r=new Array(vals.length);let k=0;while(k<idx.length){let j=k;while(j+1<idx.length&&idx[j+1][0]===idx[k][0])j++;const rr=(k+j)/2+1;for(let z=k;z<=j;z++)r[idx[z][1]]=rr;k=j+1}return r}
function corr(a,b){if(a.length<3)return null;const ma=mean(a),mb=mean(b),sa=Math.sqrt(a.reduce((s,x)=>s+(x-ma)**2,0)),sb=Math.sqrt(b.reduce((s,x)=>s+(x-mb)**2,0));if(!sa||!sb)return null;return a.reduce((s,x,i)=>s+(x-ma)*(b[i]-mb),0)/(sa*sb)}
function perm(vals,B=20000){let seed=20261014;const r=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};const obs=mean(vals);let e=0;for(let b=0;b<B;b++)if(mean(vals.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function boot(vals,B=10000){let seed=20261015;const r=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};const v=[];for(let b=0;b<B;b++){const a=[];for(let i=0;i<vals.length;i++)a.push(vals[Math.floor(r()*vals.length)]);v.push(mean(a))}return[q(v,.025),q(v,.975)]}

(async()=>{
 console.log('PROTOCOL',JSON.stringify({
  objective:'Test whether HIGH52 and PEAD are complementary and whether their intersection improves robustness',
  sample:'third independent fresh TWSE/TPEx stock universe; every prior stock excluded',
  horizon:'84 trading days',
  rules:{
   HIGH52:'top quintile of price / trailing 252-day high',
   PEAD:'top quintile of standardized seasonal earnings surprise',
   INTERSECTION:'stocks simultaneously in HIGH52 top quintile and PEAD top quintile',
   BASELINE:'all stocks in same cross-section'
  },
  metrics:['future84 mean return','hit rate >0','hit rate >=20%','excess vs universe','excess vs HIGH52 alone','remove-best robustness','permutation/bootstrap across dates'],
  noTuning:'all cutoffs fixed ex ante at top 20%'
 }));
 const raw=await info(),latest=new Map();
 for(const x of raw){
  if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||EX.has(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;
  const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x);
 }
 const rr=rng(SEED),cand=[...latest.values()].sort(()=>rr()-.5),data={};
 for(const s of cand){
  if(Object.keys(data).length>=TARGET)break;
  try{
   const p=await yahoo(s.stock_id,s.type==='tpex'?'.TWO':'.TW');
   if(p.length<1100||p[0].date>'2020-01-15')continue;
   const fin=await fm('TaiwanStockFinancialStatements',s.stock_id);
   if(fin.length<20)continue;
   data[s.stock_id]={p,map:new Map(p.map((x,i)=>[x.date,i])),fin,name:s.stock_name,type:s.type};
  }catch(e){continue}
  await sleep(90);
 }
 console.log('LOCKED_STOCKS',JSON.stringify(Object.entries(data).map(([code,d])=>({code,name:d.name,type:d.type}))));
 const base=data[Object.keys(data)[0]]?.p;if(!base)throw Error('no stocks');
 const dates=[];for(let i=252;i<base.length-H;i+=84){const d=base[i].date;if(d>='2021-01-01'&&d<='2026-04-30')dates.push(d)}
 console.log('LOCKED_DATES',JSON.stringify(dates));
 const by=[];
 for(const date of dates){
  const rows=[];
  for(const [code,d] of Object.entries(data)){
   const i=d.map.get(date);if(i==null||i<252)continue;const ret=fwd(d.p,i),h=high52(d.p,i),e=sue(d.fin,date);
   if([ret,h,e].every(Number.isFinite))rows.push({code,ret,h,e});
  }
  if(rows.length<40)continue;
  const n=rows.length,k=Math.max(5,Math.floor(n*.2));
  const topH=new Set([...rows].sort((a,b)=>b.h-a.h).slice(0,k).map(x=>x.code));
  const topE=new Set([...rows].sort((a,b)=>b.e-a.e).slice(0,k).map(x=>x.code));
  const h=rows.filter(x=>topH.has(x.code)),e=rows.filter(x=>topE.has(x.code)),ix=rows.filter(x=>topH.has(x.code)&&topE.has(x.code));
  const all=rows;
  const stats=a=>({n:a.length,mean:mean(a.map(x=>x.ret)),median:median(a.map(x=>x.ret)),positive:a.filter(x=>x.ret>0).length/a.length,hit20:a.filter(x=>x.ret>=.20).length/a.length,
    rmBest:a.length>1?mean([...a].sort((x,y)=>x.ret-y.ret).slice(0,-1).map(x=>x.ret)):null});
  by.push({date,all:stats(all),HIGH52:stats(h),PEAD:stats(e),INTERSECTION:stats(ix)});
 }
 function series(group,metric,baseGroup='all'){
  return by.filter(x=>Number.isFinite(x[group]?.[metric])&&Number.isFinite(x[baseGroup]?.[metric])).map(x=>x[group][metric]-x[baseGroup][metric]);
 }
 const out={byDate:by,groups:{}};
 for(const g of ['HIGH52','PEAD','INTERSECTION']){
  const excess=series(g,'mean'),hit=series(g,'hit20'),pos=series(g,'positive'),rb=series(g,'rmBest');
  out.groups[g]={nDates:excess.length,
   excessVsUniverse:{mean:mean(excess),positive:excess.filter(x=>x>0).length/excess.length,p:perm(excess),ci:boot(excess)},
   hit20Uplift:{mean:mean(hit),positive:hit.filter(x=>x>0).length/hit.length,ci:boot(hit)},
   positiveRateUplift:{mean:mean(pos),ci:boot(pos)},
   removeBestExcess:{mean:mean(rb),p:perm(rb),ci:boot(rb)}
  };
 }
 const ixVsH=by.filter(x=>x.INTERSECTION.n>=2).map(x=>x.INTERSECTION.mean-x.HIGH52.mean);
 const ixVsE=by.filter(x=>x.INTERSECTION.n>=2).map(x=>x.INTERSECTION.mean-x.PEAD.mean);
 out.headToHead={
  intersectionVsHIGH52:{n:ixVsH.length,mean:mean(ixVsH),positive:ixVsH.filter(x=>x>0).length/ixVsH.length,p:perm(ixVsH),ci:boot(ixVsH)},
  intersectionVsPEAD:{n:ixVsE.length,mean:mean(ixVsE),positive:ixVsE.filter(x=>x>0).length/ixVsE.length,p:perm(ixVsE),ci:boot(ixVsE)}
 };
 console.log('RESULT',JSON.stringify({nStocks:Object.keys(data).length,nDates:by.length,...out}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
