
const API='https://api.finmindtrade.com/api/v4/data';
const START='2019-01-01',END='2026-09-22';
const START_TS=Math.floor(new Date('2019-01-01T00:00:00Z').getTime()/1000);
const END_TS=Math.floor(new Date('2026-09-23T00:00:00Z').getTime()/1000);
const SEED=20261012,TARGET=60,H=84;

// Exclude all previously used research stocks to create a fresh confirmatory cross-section.
const EX=new Set([
'2330','2454','2409','2881','1301','2434','1454','3419','4938','8499','4581','6525','6831','2009','8473','1437','6164','5264','6965','9942','2437','6153','5471','9938','5285','6541','4441','1262','4989','1618','6281','7765','6202','6919','7795','4566','1721','6230',
'8464','1512','3026','3593','2385','3168','3494','4169','2340','1101','3266','2316','3296','3346','4137','1465','2362','2033','2017','1475','1216','1220','1477','2321','3257','3596','3356','2328','1102','4164','2387','2236','3376','3532','3711','8021','2072','2630','6206','1605',
'2312','2443','3652','2497','2402','4915','3030','6438','1723','3563','6176','3583','9919','2485','2543','8110','2606','2480','2547','9935','3645','6906','2509','2498','2607','3686','8462','3543','2603','4763','2404','2530','2504','8443','6005','8438','3673','2495','4771','6592',
'4564','6213','6589','3706','6405','9937','6719','1722','6278','6443','6257','6183','8261','6152','9917','6531','6243','1707','1608','6272','1434','9902','6282','1453','1714','8466','6285','6689','6239','6177','1612','2816','6271','8131','2393','4414','3708','6796','6657','1110',
'2923','3380','1210','1304','2022','3164','2062','1808','3209','2365','3515','2233','2109','3406','2317','1529','2324','2373','1526','1905','1537','2354','1449','4562','2114','5521','2101','2305','4439','5258','4935','6117','3311','5007','1521','3557','6142','6136','2426','2484','2419','2323','4104','2540','4930','2453','5469','5538','2476','1103',
'3054','6550','3682','2867','2358','1701','2601','1441','8480','1589','2888','6806','3454','2809',
'1104','1203','1225','1231','1234','1256','1307','1321','1341','1413','1414','1416','1417','1443','1466','1471','1531','1583','1590','1597','1614','2208','2228','2243','2247','2302','2303','2327','2332','2356','2368','2374','2383','2408','2417','2428','2466','2534','2613','2614','2633','2727','3518','3679','3701','4532','4583','5906','6416','6431','6581','6691','6706','8249','8454','8940','9136','9912','9926','9930',
'1456','1504','1524','1584','1586','1784','1786','2064','2106','2221','2231','2308','2342','2352','2405','2412','2421','2429','2460','2643','2701','2726','2736','2754','2812','2910','2924','3081','3171','3219','3434','3483','3498','3558','3577','4168','4401','4406','4506','4572','4702','4907','5220','5340','5347','5353','5388','5484','5490','5512','5536','5607','6026','6113','6118','6134','6143','6158','6161','6165','6235','6275','6462','6625','6637','6732','8011','8024','8044','8048','8059','8071','8076','8077','8080','8114','8210','8222','8426','9907'
,'1439','1455','1515','1516','1536','1708','1730','1810','1815','1903','2065','2364','2471','2849','2880','3432','3580','4131','4157','4502','4523','4934','5291','5355','5483','5488','5520','5604','6109','6122','6128','6151','6168','6171','6179','6186','6212','6223','6226','6261','6264','6269','6279','6412','6506','8043','8074','8083','8105','8933'
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
  if(a===2)throw Error(dataset+' '+(id||'')+' '+r.status);await sleep(400*(a+1));
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
function mom61(p,i){if(i<126)return null;return p[i-21].close/p[i-126].close-1}
function lowvol(p,i){if(i<60)return null;const rs=[];for(let j=i-59;j<=i;j++)rs.push(Math.log(p[j].close/p[j-1].close));const m=mean(rs);return -Math.sqrt(mean(rs.map(x=>(x-m)**2)))*Math.sqrt(252)}
function fwd(p,i){return p[i+H]?p[i+H].close/p[i].close-1:null}
function rank(vals){const idx=vals.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),r=new Array(vals.length);let k=0;while(k<idx.length){let j=k;while(j+1<idx.length&&idx[j+1][0]===idx[k][0])j++;const rr=(k+j)/2+1;for(let z=k;z<=j;z++)r[idx[z][1]]=rr;k=j+1}return r}
function pctRank(vals){const r=rank(vals);return r.map(x=>(x-1)/(vals.length-1||1))}
function corr(a,b){if(a.length<3)return null;const ma=mean(a),mb=mean(b),sa=Math.sqrt(a.reduce((s,x)=>s+(x-ma)**2,0)),sb=Math.sqrt(b.reduce((s,x)=>s+(x-mb)**2,0));if(!sa||!sb)return null;return a.reduce((s,x,i)=>s+(x-ma)*(b[i]-mb),0)/(sa*sb)}
function perm(vals,B=20000){let seed=20261010;const r=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};const obs=mean(vals);let e=0;for(let b=0;b<B;b++)if(mean(vals.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function boot(vals,B=10000){let seed=20261011;const r=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};const v=[];for(let b=0;b<B;b++){const a=[];for(let i=0;i<vals.length;i++)a.push(vals[Math.floor(r()*vals.length)]);v.push(mean(a))}return[q(v,.025),q(v,.975)]}
function longShort(rows,field){
 const r=rows.filter(x=>Number.isFinite(x[field])).sort((a,b)=>b[field]-a[field]);if(r.length<30)return null;
 const k=Math.max(5,Math.floor(r.length*.2)),top=r.slice(0,k),bot=r.slice(-k);
 return {spread:mean(top.map(x=>x.ret))-mean(bot.map(x=>x.ret)),top:mean(top.map(x=>x.ret)),bottom:mean(bot.map(x=>x.ret)),rmBest:mean([...top].sort((a,b)=>a.ret-b.ret).slice(0,-1).map(x=>x.ret))-mean(bot.map(x=>x.ret))};
}
// Monthly revenue surprise proxy: latest available YoY minus company's trailing 12-month median YoY.
function revenueSurprise(rev,date){
 let avail=date;
 const y=+date.slice(0,4),m=+date.slice(5,7),day=+date.slice(8,10);
 let yy=y,mm=m-1;if(day<11)mm--;while(mm<=0){mm+=12;yy--}
 const rows=rev.map(x=>({y:+x.revenue_year,m:+x.revenue_month,v:+x.revenue})).filter(x=>x.v>0);
 const get=(Y,M)=>rows.find(x=>x.y===Y&&x.m===M)?.v??null;
 const cur=get(yy,mm),py=get(yy-1,mm);if(!(cur>0&&py>0))return null;
 const yoy=cur/py-1,hist=[];
 for(let k=1;k<=12;k++){let M=mm-k,Y=yy;while(M<=0){M+=12;Y--}const a=get(Y,M),b=get(Y-1,M);if(a>0&&b>0)hist.push(a/b-1)}
 if(hist.length<6)return null;return yoy-median(hist);
}
// PEAD proxy: standardized unexpected earnings using seasonal change in quarterly after-tax income.
// Statement dates are conservatively lagged 70 calendar days to approximate public availability.
function sue(fin,date){
 const cutoff=dateAdd(date,-70);
 const xs=fin.filter(x=>x.type==='IncomeAfterTaxes'&&x.date<=cutoff&&Number.isFinite(+x.value)).map(x=>({d:x.date,v:+x.value})).sort((a,b)=>a.d.localeCompare(b.d));
 if(xs.length<9)return null;
 const diffs=[];for(let i=4;i<xs.length;i++)diffs.push({d:xs[i].d,v:xs[i].v-xs[i-4].v});
 if(diffs.length<5)return null;
 const cur=diffs[diffs.length-1],hist=diffs.slice(Math.max(0,diffs.length-9),-1).map(x=>x.v);if(hist.length<4)return null;
 const mu=mean(hist),s=Math.sqrt(mean(hist.map(x=>(x-mu)**2)));return s>0?(cur.v-mu)/s:null;
}
(async()=>{
 console.log('PROTOCOL',JSON.stringify({
  horizon:'84 trading days',
  methods:{
   REV_SURPRISE:'latest published monthly revenue YoY minus trailing 12-month median YoY',
   PEAD_SUE:'seasonal quarterly net-income surprise standardized by prior seasonal changes; 70-calendar-day availability lag',
   MULTIFACTOR:'equal-weight cross-sectional percentile ranks of REV_SURPRISE, SUE, 6-to-1 momentum, and low volatility; HIGH52 excluded',
   HIGH52:'price / trailing 252-trading-day high'
  },
  sample:'second independent fresh TWSE/TPEx stock universe; all prior research stocks including first 50-stock multifactor sample excluded',
  dates:'non-overlapping 84-trading-day snapshots',
  metrics:['top20-bottom20 spread','Spearman IC','bootstrap CI','permutation p','remove-best-top robustness'],
  comparison:'same stocks, same dates, same 84d forward returns'
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
   const [rev,fin]=await Promise.all([fm('TaiwanStockMonthRevenue',s.stock_id),fm('TaiwanStockFinancialStatements',s.stock_id)]);
   if(rev.length<36||fin.length<20)continue;
   data[s.stock_id]={p,map:new Map(p.map((x,i)=>[x.date,i])),rev,fin,name:s.stock_name,type:s.type};
  }catch(e){continue}
  await sleep(120);
 }
 console.log('LOCKED_STOCKS',JSON.stringify(Object.entries(data).map(([code,d])=>({code,name:d.name,type:d.type}))));
 const base=data[Object.keys(data)[0]]?.p;if(!base)throw Error('no usable stocks');
 const calendar=base.map(x=>x.date),pos=new Map(calendar.map((d,i)=>[d,i])),blocked=new Set();
 const oldDates=["2021-01-28","2021-06-11","2021-10-13","2022-02-18","2022-06-23","2022-10-21","2023-03-03","2023-07-07","2023-11-08","2024-03-18","2024-07-18","2024-11-22","2025-04-02","2025-08-05","2025-12-05","2026-04-20","2021-03-19","2021-08-23","2022-01-10","2024-06-20","2026-01-23","2021-01-13","2021-04-27","2021-07-27","2021-10-27","2022-01-25","2022-05-09","2022-08-05","2022-11-04","2023-02-14","2023-05-22","2023-08-22","2023-11-22","2024-03-01","2024-06-03","2024-09-03","2024-12-06","2025-03-18","2025-06-19","2025-09-17","2025-12-19"];
 for(const d of oldDates){const k=pos.get(d);if(k==null)continue;for(let j=Math.max(0,k-10);j<=Math.min(calendar.length-1,k+10);j++)blocked.add(calendar[j])}
 const candDates=[];for(let i=252;i<calendar.length-H;i++){const d=calendar[i];if(d<'2021-01-01'||d>'2026-04-30'||blocked.has(d)||+d.slice(8,10)<10||+d.slice(8,10)>25)continue;candDates.push(d)}
 const rd=rng(SEED+1),shDates=[...candDates].sort(()=>rd()-.5),dates=[];
 for(const d of shDates){const k=pos.get(d);if(dates.every(x=>Math.abs(pos.get(x)-k)>=84)){dates.push(d);if(dates.length>=12)break}}dates.sort()
 console.log('LOCKED_DATES',JSON.stringify(dates));
 const rec=[];
 for(const date of dates){
  const rows=[];
  for(const [code,d] of Object.entries(data)){
   const i=d.map.get(date);if(i==null||i<252)continue;const ret=fwd(d.p,i);if(!Number.isFinite(ret))continue;
   const row={code,ret,HIGH52:high52(d.p,i),REV_SURPRISE:revenueSurprise(d.rev,date),PEAD_SUE:sue(d.fin,date),MOM61:mom61(d.p,i),LOWVOL:lowvol(d.p,i)};
   rows.push(row);
  }
  // Multifactor score is computed only on rows with all four inputs.
  const mf=rows.filter(x=>['REV_SURPRISE','PEAD_SUE','MOM61','LOWVOL'].every(k=>Number.isFinite(x[k])));
  if(mf.length>=30){
   const keys=['REV_SURPRISE','PEAD_SUE','MOM61','LOWVOL'],prs={};for(const k of keys)prs[k]=pctRank(mf.map(x=>x[k]));
   mf.forEach((x,i)=>x.MULTIFACTOR=mean(keys.map(k=>prs[k][i])));
  }
  const methods={};
  for(const m of ['REV_SURPRISE','PEAD_SUE','MULTIFACTOR','HIGH52']){
   const src=m==='MULTIFACTOR'?mf:rows.filter(x=>Number.isFinite(x[m]));
   const ls=longShort(src,m);if(!ls||src.length<30)continue;
   methods[m]={n:src.length,spread:ls.spread,rmBest:ls.rmBest,ic:corr(rank(src.map(x=>x[m])),rank(src.map(x=>x.ret)))};
  }
  rec.push({date,methods});
 }
 const result={};
 for(const m of ['REV_SURPRISE','PEAD_SUE','MULTIFACTOR','HIGH52']){
  const a=rec.filter(x=>x.methods[m]).map(x=>({date:x.date,...x.methods[m]})),S=a.map(x=>x.spread),IC=a.map(x=>x.ic).filter(Number.isFinite),RB=a.map(x=>x.rmBest);
  result[m]={n:a.length,spread:{mean:mean(S),median:median(S),positive:S.filter(x=>x>0).length/S.length,p:perm(S),ci:boot(S)},IC:{mean:mean(IC),positive:IC.filter(x=>x>0).length/IC.length,ci:boot(IC)},removeBest:{mean:mean(RB),p:perm(RB),ci:boot(RB)},byDate:a};
 }
 // Pairwise head-to-head spread advantage vs HIGH52 on common dates.
 const versus={};
 for(const m of ['REV_SURPRISE','PEAD_SUE','MULTIFACTOR']){
  const dif=[];for(const r of rec){if(r.methods[m]&&r.methods.HIGH52)dif.push(r.methods[m].spread-r.methods.HIGH52.spread)}
  versus[m]={n:dif.length,meanSpreadAdvantage:mean(dif),positive:dif.length?dif.filter(x=>x>0).length/dif.length:null,p:perm(dif),ci:boot(dif)};
 }
 const late={};for(const m of ['REV_SURPRISE','PEAD_SUE','MULTIFACTOR','HIGH52']){
 const a=rec.filter(x=>x.date>='2024-01-01'&&x.methods[m]).map(x=>x.methods[m].spread);
 late[m]={n:a.length,mean:mean(a),positive:a.length?a.filter(x=>x>0).length/a.length:null,p:a.length?perm(a):null,ci:a.length?boot(a):[null,null]};
}
console.log('RESULT',JSON.stringify({nStocks:Object.keys(data).length,nDates:dates.length,result,versusHIGH52:versus,replication2024plus:late}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
