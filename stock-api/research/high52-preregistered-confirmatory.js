
const API='https://api.finmindtrade.com/api/v4/data';
const START_TS=Math.floor(new Date('2020-01-01T00:00:00Z').getTime()/1000);
const END_TS=Math.floor(new Date('2026-09-23T00:00:00Z').getTime()/1000);
const SEED=20261005, TARGET_STOCKS=60, H=63;

// All stocks previously used in research are excluded from this confirmatory sample.
const EX=new Set([
'2330','2454','2409','2881','1301','2434','1454','3419','4938','8499','4581','6525','6831','2009','8473','1437','6164','5264','6965','9942','2437','6153','5471','9938','5285','6541','4441','1262','4989','1618','6281','7765','6202','6919','7795','4566','1721','6230',
'8464','1512','3026','3593','2385','3168','3494','4169','2340','1101','3266','2316','3296','3346','4137','1465','2362','2033','2017','1475','1216','1220','1477','2321','3257','3596','3356','2328','1102','4164','2387','2236','3376','3532','3711','8021','2072','2630','6206','1605',
'2312','2443','3652','2497','2402','4915','3030','6438','1723','3563','6176','3583','9919','2485','2543','8110','2606','2480','2547','9935','3645','6906','2509','2498','2607','3686','8462','3543','2603','4763','2404','2530','2504','8443','6005','8438','3673','2495','4771','6592',
'4564','6213','6589','3706','6405','9937','6719','1722','6278','6443','6257','6183','8261','6152','9917','6531','6243','1707','1608','6272','1434','9902','6282','1453','1714','8466','6285','6689','6239','6177','1612','2816','6271','8131','2393','4414','3708','6796','6657','1110',
'2923','3380','1210','1304','2022','3164','2062','1808','3209','2365','3515','2233','2109','3406','2317','1529','2324','2373','1526','1905','1537','2354','1449','4562','2114','5521','2101','2305','4439','5258','4935','6117','3311','5007','1521','3557','6142','6136','2426','2484','2419','2323','4104','2540','4930','2453','5469','5538','2476','1103',
'3054','6550','3682','2867','2358','1701','2601','1441','8480','1589','2888','6806','3454','2809'
]);

const OLD_DATES=new Set([
'2024-08-21','2025-08-21','2026-08-21','2023-05-16','2023-08-23','2023-11-13','2024-01-16','2024-03-25','2024-06-03','2024-10-23','2025-03-20','2025-07-03','2025-09-30','2026-01-08','2026-06-15',
'2023-01-16','2023-06-15','2023-09-21','2023-12-15','2024-04-25','2024-07-15','2024-11-22','2025-02-17','2025-04-22','2025-11-17','2026-02-23','2026-05-15',
'2023-03-15','2023-07-18','2024-12-23','2025-05-22','2026-04-15','2022-02-15','2022-04-15','2022-06-15','2022-08-15','2022-10-17','2022-12-15',
'2021-01-12','2021-06-15','2021-09-16','2021-12-17','2022-05-13','2022-09-20','2023-04-11','2023-10-19','2024-02-20','2024-09-12','2025-01-15','2025-07-25','2025-12-10',
'2021-02-23','2021-07-21','2021-11-12','2022-03-11','2022-07-14','2022-11-22','2024-05-14','2025-06-11','2025-10-23','2026-03-17',
'2021-01-13','2021-04-27','2021-07-27','2021-10-27','2022-01-25','2022-05-09','2022-08-05','2022-11-04','2023-02-14','2023-05-22','2023-08-22','2023-11-22','2024-03-01','2024-06-03','2024-09-03','2024-12-06','2025-03-18','2025-06-19','2025-09-17','2025-12-19'
]);

const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
const sd=a=>{if(a.length<2)return null;const m=mean(a);return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1))};
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
async function info(){
 const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');
 const r=await fetch(u);if(!r.ok)throw Error('info '+r.status);return (await r.json()).data||[];
}
async function yahoo(code){
 const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+'.TW?period1='+START_TS+'&period2='+END_TS+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';
 const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(!r.ok)throw Error(code+' '+r.status);
 const j=await r.json(),x=j?.chart?.result?.[0];if(!x)return [];
 const t=x.timestamp||[],adj=x.indicators?.adjclose?.[0]?.adjclose||[],cl=x.indicators?.quote?.[0]?.close||[],a=[];
 for(let i=0;i<t.length;i++){const v=Number.isFinite(adj[i])?adj[i]:cl[i];if(Number.isFinite(v)&&v>0)a.push({date:new Date(t[i]*1000).toISOString().slice(0,10),close:v})}
 return a;
}
function high52(p,i){if(i<251)return null;return p[i].close/Math.max(...p.slice(i-251,i+1).map(x=>x.close))}
function mom6(p,i){if(i<126)return null;return p[i-21].close/p[i-126].close-1}
function fwd(p,i){return p[i+H]?p[i+H].close/p[i].close-1:null}
function rank(vals){const idx=vals.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),r=new Array(vals.length);let k=0;while(k<idx.length){let j=k;while(j+1<idx.length&&idx[j+1][0]===idx[k][0])j++;const rr=(k+j)/2+1;for(let z=k;z<=j;z++)r[idx[z][1]]=rr;k=j+1}return r}
function corr(a,b){if(a.length<3)return null;const ma=mean(a),mb=mean(b),sa=Math.sqrt(a.reduce((s,x)=>s+(x-ma)**2,0)),sb=Math.sqrt(b.reduce((s,x)=>s+(x-mb)**2,0));if(!sa||!sb)return null;return a.reduce((s,x,i)=>s+(x-ma)*(b[i]-mb),0)/(sa*sb)}
function z(a){const m=mean(a),s=sd(a);return s?a.map(x=>(x-m)/s):a.map(()=>0)}
function residualBeta(rows){
 const H=z(rows.map(x=>x.h)),M=z(rows.map(x=>x.m)),Y=rows.map(x=>x.ret),b=corr(H,M),R=H.map((x,i)=>x-b*M[i]),mr=mean(R),my=mean(Y);
 const den=R.reduce((s,x)=>s+(x-mr)**2,0),num=R.reduce((s,x,i)=>s+(x-mr)*(Y[i]-my),0);return den?num/den:null;
}
function perm(vals,B=20000){let seed=91633;const r=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};const obs=mean(vals);let e=0;for(let b=0;b<B;b++)if(mean(vals.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function boot(vals,B=10000){let seed=77311;const r=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};const v=[];for(let b=0;b<B;b++){const a=[];for(let i=0;i<vals.length;i++)a.push(vals[Math.floor(r()*vals.length)]);v.push(mean(a))}return[q(v,.025),q(v,.975)]}
function winsor(a,p=.1){const lo=q(a,p),hi=q(a,1-p);return a.map(x=>Math.max(lo,Math.min(hi,x)))}

(async()=>{
 console.log('PROTOCOL',JSON.stringify({
   primary:'HIGH52 top quintile minus bottom quintile, 63 trading days',
   universe:'fresh TWSE common stocks, all prior research stocks excluded',
   dates:'fresh non-overlapping snapshots, all prior dates excluded ±10 trading days',
   controls:['Spearman IC','residual HIGH52 coefficient controlling MOM6','quintile monotonicity','winsor 10%','median spread','remove best top stock','2024+ replication'],
   passRule:'validated only if overall spread >0, permutation p<0.05, bootstrap lower>0, IC bootstrap lower>0, 2024+ replication mean>0 with >=60% positive periods, and winsor/median both positive'
 }));
 const raw=await info(),latest=new Map();
 for(const x of raw){if(x.type!=='twse'||!/^[0-9]{4}$/.test(x.stock_id)||EX.has(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x)}
 const rsel=rng(SEED),cand=[...latest.values()].sort(()=>rsel()-.5),data={};
 for(const s of cand){if(Object.keys(data).length>=TARGET_STOCKS)break;try{const p=await yahoo(s.stock_id);if(p.length<850||p[0].date>'2021-01-15')continue;data[s.stock_id]={p,map:new Map(p.map((x,i)=>[x.date,i]))}}catch(e){} await new Promise(r=>setTimeout(r,80))}
 console.log('LOCKED_STOCKS',JSON.stringify(Object.keys(data)));
 const base=data[Object.keys(data)[0]].p,calendar=base.map(x=>x.date),pos=new Map(calendar.map((d,i)=>[d,i])),blocked=new Set();
 for(const d of OLD_DATES){const k=pos.get(d);if(k==null)continue;for(let j=Math.max(0,k-10);j<=Math.min(calendar.length-1,k+10);j++)blocked.add(calendar[j])}
 const possible=[];for(let i=252;i<calendar.length-H;i++){const d=calendar[i];if(d<'2021-01-01'||d>'2026-05-31'||blocked.has(d)||+d.slice(8,10)<10||+d.slice(8,10)>25)continue;possible.push(d)}
 const rd=rng(SEED+1),sh=[...possible].sort(()=>rd()-.5),dates=[];
 for(const d of sh){const k=pos.get(d);if(dates.every(x=>Math.abs(pos.get(x)-k)>=63)){dates.push(d);if(dates.length>=14)break}}
 dates.sort();console.log('LOCKED_DATES',JSON.stringify(dates));
 const rec=[];
 for(const date of dates){
   const rows=[];for(const [code,d] of Object.entries(data)){const i=d.map.get(date);if(i==null)continue;const h=high52(d.p,i),m=mom6(d.p,i),ret=fwd(d.p,i);if([h,m,ret].every(Number.isFinite))rows.push({code,h,m,ret})}
   if(rows.length<40)continue;const x=[...rows].sort((a,b)=>a.h-b.h),n=x.length,k=Math.floor(n/5),bot=x.slice(0,k),top=x.slice(n-k),tr=top.map(x=>x.ret),br=bot.map(x=>x.ret);
   const quint=[];for(let j=0;j<5;j++){const a=Math.floor(j*n/5),b=Math.floor((j+1)*n/5);quint.push(mean(x.slice(a,b).map(z=>z.ret)))}
   rec.push({date,n,spread:mean(tr)-mean(br),medianSpread:median(tr)-median(br),winsor:mean(winsor(tr))-mean(winsor(br)),rmBest:mean([...tr].sort((a,b)=>a-b).slice(0,-1))-mean(br),ic:corr(rank(rows.map(x=>x.h)),rank(rows.map(x=>x.ret))),resid:residualBeta(rows),quint});
 }
 const S=rec.map(x=>x.spread),IC=rec.map(x=>x.ic),R=rec.map(x=>x.resid),W=rec.map(x=>x.winsor),MS=rec.map(x=>x.medianSpread),RB=rec.map(x=>x.rmBest);
 const late=rec.filter(x=>x.date>='2024-01-01'),LS=late.map(x=>x.spread);
 const qavg=[0,1,2,3,4].map(j=>mean(rec.map(x=>x.quint[j])));
 const metrics={
   nStocks:Object.keys(data).length,nDates:rec.length,
   overall:{mean:mean(S),median:median(S),positive:S.filter(x=>x>0).length/S.length,p:perm(S),ci:boot(S)},
   IC:{mean:mean(IC),positive:IC.filter(x=>x>0).length/IC.length,ci:boot(IC)},
   residualVsMom6:{mean:mean(R),positive:R.filter(x=>x>0).length/R.length,ci:boot(R)},
   winsor:{mean:mean(W),p:perm(W),ci:boot(W)},
   medianSpread:{mean:mean(MS),p:perm(MS),ci:boot(MS)},
   removeBest:{mean:mean(RB),p:perm(RB),ci:boot(RB)},
   quintileMeans:qavg,monotone:qavg.every((v,i)=>i===0||v>=qavg[i-1]),
   replication2024plus:{n:late.length,mean:mean(LS),positive:LS.length?LS.filter(x=>x>0).length/LS.length:null,p:LS.length?perm(LS):null,ci:LS.length?boot(LS):[null,null]},
   byDate:rec
 };
 const pass=metrics.overall.mean>0&&metrics.overall.p<.05&&metrics.overall.ci[0]>0&&metrics.IC.ci[0]>0&&metrics.replication2024plus.mean>0&&metrics.replication2024plus.positive>=.6&&metrics.winsor.mean>0&&metrics.medianSpread.mean>0;
 console.log('RESULT',JSON.stringify({...metrics,pass,status:pass?'VALIDATED':'NOT_VALIDATED'}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
