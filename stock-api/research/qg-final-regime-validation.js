
const API='https://api.finmindtrade.com/api/v4/data';
const START='2019-01-01',END='2026-09-22',SEED=20260929,NSTOCK=50,H=63;
const EX=new Set([
'2330','2454','2409','2881','1301','2434','1454','3419',
'4938','8499','4581','6525','6831','2009','8473','1437','6164','5264','6965','9942','2437','6153','5471','9938','5285','6541','4441','1262','4989','1618','6281','7765','6202','6919','7795','4566','1721','6230',
'8464','1512','3026','3593','2385','3168','3494','4169','2340','1101','3266','2316','3296','3346','4137','1465','2362','2033','2017','1475','1216','1220','1477','2321','3257','3596','3356','2328','1102','4164','2387','2236','3376','3532','3711','8021','2072','2630','6206','1605',
'2312','2443','3652','2497','2402','4915','3030','6438','1723','3563','6176','3583','9919','2485','2543','8110','2606','2480','2547','9935','3645','6906','2509','2498','2607','3686','8462','3543','2603','4763','2404','2530','2504','8443','6005','8438','3673','2495','4771','6592',
'4564','6213','6589','3706','6405','9937','6719','1722','6278','6443','6257','6183','8261','6152','9917','6531','6243','1707','1608','6272','1434','9902','6282','1453','1714','8466','6285','6689','6239','6177','1612','2816','6271','8131','2393','4414','3708','6796','6657','1110'
]);
const OLD_DATES=[
'2024-08-21','2025-08-21','2026-08-21','2023-05-16','2023-08-23','2023-11-13','2024-01-16','2024-03-25','2024-06-03','2024-10-23','2025-03-20','2025-07-03','2025-09-30','2026-01-08','2026-06-15',
'2023-01-16','2023-06-15','2023-09-21','2023-12-15','2024-04-25','2024-07-15','2024-11-22','2025-02-17','2025-04-22','2025-11-17','2026-02-23','2026-05-15',
'2023-03-15','2023-07-18','2024-12-23','2025-05-22','2026-04-15',
'2022-02-15','2022-04-15','2022-06-15','2022-08-15','2022-10-17','2022-12-15'
];
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
async function fm(dataset,id,start=START,end=END){
 const u=new URL(API);u.searchParams.set('dataset',dataset);if(id)u.searchParams.set('data_id',id);u.searchParams.set('start_date',start);u.searchParams.set('end_date',end);
 const r=await fetch(u);if(!r.ok)throw Error(dataset+' '+(id||'')+' HTTP '+r.status);const j=await r.json();return j.data||[];
}
function P(raw){return raw.map(r=>({date:r.date,open:+r.open,high:+r.max,low:+r.min,close:+r.close,vol:+r.Trading_Volume})).filter(x=>[x.open,x.high,x.low,x.close].every(v=>Number.isFinite(v)&&v>0)).sort((a,b)=>a.date.localeCompare(b.date))}
function dateAdd(d,days){return new Date(new Date(d+'T00:00:00Z').getTime()+days*86400000).toISOString().slice(0,10)}
function latest(rows,type,date,lag=70){const cutoff=dateAdd(date,-lag);let best=null;for(const r of rows)if(r.type===type&&r.date<=cutoff&&(!best||r.date>best.date))best=r;return best?+best.value:null}
function latestShares(rows,date){let best=null;for(const r of rows)if(r.date<=date&&(!best||r.date>best.date)){const v=+r.NumberOfSharesIssued;if(Number.isFinite(v)&&v>0)best={date:r.date,v}}return best?.v??null}
function revenueInfo(rev,date){
 let ref=date,cut=date.slice(0,7)+'-11';if(date<cut){const d=new Date(date+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);ref=d.toISOString().slice(0,10)}
 let y=+ref.slice(0,4),m=+ref.slice(5,7);m--;if(m===0){m=12;y--}
 const get=(yy,mm)=>rev.find(x=>+x.revenue_year===yy&&+x.revenue_month===mm);
 const cur=get(y,m),py=get(y-1,m);if(!cur||!py||+py.revenue<=0)return null;
 let pm=m-1,pyy=y;if(pm===0){pm=12;pyy--}
 const prev=get(pyy,pm),prevpy=get(pyy-1,pm),yoy=+cur.revenue/+py.revenue-1;
 const prevYoy=(prev&&prevpy&&+prevpy.revenue>0)?+prev.revenue/+prevpy.revenue-1:null;
 return {yoy,accel:prevYoy==null?null:yoy-prevYoy};
}
function qg(d,date){
 const op=latest(d.fin,'OperatingIncome',date),ni=latest(d.fin,'IncomeAfterTaxes',date);
 let ocf=latest(d.cf,'CashFlowsFromOperatingActivities',date);if(ocf==null)ocf=latest(d.cf,'NetCashInflowFromOperatingActivities',date);
 const rev=revenueInfo(d.rev,date);if(op==null||ni==null||ocf==null||!rev||rev.accel==null)return null;
 const quality=((op>0)+(ni>0)+(ocf>0))/3,growth=((rev.yoy>0)+(rev.accel>0))/2;
 return {quality,growth,qg:(quality*3+growth*2)/5};
}
function outcome(p,date,h=H){const i=p.findIndex(x=>x.date===date);if(i<0||!p[i+h])return null;let peak=p[i].close,dd=0;for(let j=i+1;j<=i+h;j++){peak=Math.max(peak,p[j].close);dd=Math.min(dd,p[j].close/peak-1)}return {ret:p[i+h].close/p[i].close-1,dd}}
function ret(a,i,n){return i>=n?a[i].close/a[i-n].close-1:null}
function rv(a,i,n=20){if(i<n)return null;const rs=[];for(let j=i-n+1;j<=i;j++)rs.push(Math.log(a[j].close/a[j-1].close));const m=mean(rs);return Math.sqrt(mean(rs.map(x=>(x-m)**2)))*Math.sqrt(252)}
function marketFeatures(idx,i){
 if(i<252)return null;
 const ma120=mean(idx.slice(i-119,i+1).map(x=>x.close)),max120=Math.max(...idx.slice(i-119,i+1).map(x=>x.close));
 const vol=rv(idx,i,20),vh=[];for(let j=i-119;j<i;j++){const z=rv(idx,j,20);if(Number.isFinite(z))vh.push(z)}
 const m20=ret(idx,i,20),m60=ret(idx,i,60);
 return {trend:idx[i].close/ma120-1,drawdown:idx[i].close/max120-1,volPct:vh.length?vh.filter(x=>x<=vol).length/vh.length:null,m20,m60};
}
function chooseFreshDates(calendar){
 const pos=new Map(calendar.map((d,i)=>[d,i])),blocked=new Set();
 for(const d of OLD_DATES){const k=pos.get(d);if(k==null)continue;for(let j=Math.max(0,k-15);j<=Math.min(calendar.length-1,k+15);j++)blocked.add(calendar[j])}
 const candidates=[];
 for(let i=0;i<calendar.length;i++){
   const d=calendar[i];if(d<'2021-01-01'||d>'2026-06-15'||blocked.has(d))continue;
   if(+d.slice(8,10)<10||+d.slice(8,10)>25)continue;
   candidates.push(d);
 }
 const r=rng(SEED),sh=[...candidates].sort(()=>r()-.5),chosen=[];
 for(const d of sh){const k=pos.get(d);if(chosen.every(x=>Math.abs(pos.get(x)-k)>=63)){chosen.push(d);if(chosen.length>=20)break}}
 return chosen.sort();
}
function sizeNeutral(rows){
 const s=rows.filter(x=>Number.isFinite(x.cap)).sort((a,b)=>a.cap-b.cap);if(s.length<24)return null;
 const cuts=[0,Math.floor(s.length/3),Math.floor(2*s.length/3),s.length],top=[],bottom=[];
 for(let z=0;z<3;z++){const b=s.slice(cuts[z],cuts[z+1]).sort((a,b)=>b.qg-a.qg),k=Math.max(2,Math.floor(b.length*.25));top.push(...b.slice(0,k));bottom.push(...b.slice(-k))}
 return {top,bottom};
}
function stat(a){return {n:a.length,mean:mean(a),median:median(a),positive:a.length?a.filter(x=>x>0).length/a.length:null,q25:q(a,.25),q75:q(a,.75)}}
function signPerm(diffs,B=20000){if(!diffs.length)return null;const obs=mean(diffs),r=rng(445566);let e=0;for(let b=0;b<B;b++){const v=mean(diffs.map(x=>r()<.5?x:-x));if(v>=obs)e++}return (e+1)/(B+1)}
function bootCI(diffs,B=10000){if(!diffs.length)return [null,null];const r=rng(778899),v=[];for(let b=0;b<B;b++){const a=[];for(let i=0;i<diffs.length;i++)a.push(diffs[Math.floor(r()*diffs.length)]);v.push(mean(a))}return[q(v,.025),q(v,.975)]}
function summarize(arr){const d=arr.map(x=>x.spread);return {n:arr.length,spread:stat(d),permP:signPerm(d),bootstrap95:bootCI(d),top:stat(arr.map(x=>x.topMean)),bottom:stat(arr.map(x=>x.bottomMean)),topDD:stat(arr.map(x=>x.topDD)),bottomDD:stat(arr.map(x=>x.bottomDD))}}
(async()=>{
 const info=await fm('TaiwanStockInfo','', '2026-01-01','2026-09-22'),latestInfo=new Map();
 for(const x of info){if(x.type!=='twse'||!/^[0-9]{4}$/.test(x.stock_id)||EX.has(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;const old=latestInfo.get(x.stock_id);if(!old||x.date>old.date)latestInfo.set(x.stock_id,x)}
 const rs=rng(SEED),cand=[...latestInfo.values()].sort(()=>rs()-.5),chosen=[];
 for(const s of cand){if(chosen.length>=NSTOCK)break;const p=P(await fm('TaiwanStockPrice',s.stock_id));if(p.length<1200||p[0].date>'2021-01-15')continue;chosen.push({...s,p})}
 console.log('LOCKED_STOCKS',JSON.stringify({seed:SEED,n:chosen.length,stocks:chosen.map(x=>({code:x.stock_id,name:x.stock_name,industry:x.industry_category}))}));
 const data={};
 for(const s of chosen){const [rev,fin,cf,sh]=await Promise.all([fm('TaiwanStockMonthRevenue',s.stock_id),fm('TaiwanStockFinancialStatements',s.stock_id),fm('TaiwanStockCashFlowsStatement',s.stock_id),fm('TaiwanStockShareholding',s.stock_id)]);data[s.stock_id]={code:s.stock_id,p:s.p,rev,fin,cf,sh}}
 const idxRaw=await fm('TaiwanStockTotalReturnIndex','TAIEX'),idx=idxRaw.map(x=>({date:x.date,close:+x.price})).filter(x=>Number.isFinite(x.close)).sort((a,b)=>a.date.localeCompare(b.date)),imap=new Map(idx.map((x,i)=>[x.date,i]));
 const dates=chooseFreshDates(idx.map(x=>x.date));console.log('LOCKED_DATES',JSON.stringify({n:dates.length,dates}));
 const rec=[];
 for(const date of dates){
   const ii=imap.get(date),mf=marketFeatures(idx,ii);if(!mf)continue;
   const rows=[];
   for(const s of chosen){const d=data[s.stock_id],f=qg(d,date),o=outcome(d.p,date);if(!f||!o)continue;const i=d.p.findIndex(x=>x.date===date),sh=latestShares(d.sh,date);if(i<0||!sh)continue;rows.push({code:d.code,qg:f.qg,ret:o.ret,dd:o.dd,cap:d.p[i].close*sh})}
   const g=sizeNeutral(rows);if(!g)continue;
   const topMean=mean(g.top.map(x=>x.ret)),bottomMean=mean(g.bottom.map(x=>x.ret)),spread=topMean-bottomMean;
   rec.push({date,n:rows.length,spread,topMean,bottomMean,topDD:mean(g.top.map(x=>x.dd)),bottomDD:mean(g.bottom.map(x=>x.dd)),...mf});
 }
 // pre-specified regime definitions only: trend sign, vol half, drawdown threshold, and combinations.
 const regimes={
   ALL:x=>true,
   TREND_UP:x=>x.trend>0,
   TREND_DOWN:x=>x.trend<=0,
   VOL_LOW:x=>x.volPct<.5,
   VOL_HIGH:x=>x.volPct>=.5,
   DD_SHALLOW:x=>x.drawdown>-0.10,
   DD_DEEP:x=>x.drawdown<=-0.10,
   UP_LOWVOL:x=>x.trend>0&&x.volPct<.5,
   UP_HIGHVOL:x=>x.trend>0&&x.volPct>=.5,
   DOWN_LOWVOL:x=>x.trend<=0&&x.volPct<.5,
   DOWN_HIGHVOL:x=>x.trend<=0&&x.volPct>=.5
 };
 const summaries={};
 for(const [k,fn] of Object.entries(regimes))summaries[k]=summarize(rec.filter(fn));
 // Discovery/replication split fixed by time, not tuned: <=2023 discovery, >=2024 replication.
 const split={discovery:{},replication:{}};
 for(const [k,fn] of Object.entries(regimes)){
   split.discovery[k]=summarize(rec.filter(x=>x.date<'2024-01-01'&&fn(x)));
   split.replication[k]=summarize(rec.filter(x=>x.date>='2024-01-01'&&fn(x)));
 }
 console.log('RESULT',JSON.stringify({n:rec.length,all:summaries.ALL,regimes:summaries,split,byDate:rec}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
