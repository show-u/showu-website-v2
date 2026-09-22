
const API='https://api.finmindtrade.com/api/v4/data';
const START='2021-01-01',END='2026-09-22',SEED=20260926,NSTOCK=40,H=63;
const EX=new Set([
'2330','2454','2409','2881','1301','2434','1454','3419',
'4938','8499','4581','6525','6831','2009','8473','1437','6164','5264','6965','9942','2437','6153','5471','9938','5285','6541','4441','1262','4989','1618','6281','7765','6202','6919','7795','4566','1721','6230'
]);
const USED=['2024-08-21','2025-08-21','2026-08-21','2023-05-16','2023-08-23','2023-11-13','2024-01-16','2024-03-25','2024-06-03','2024-10-23','2025-03-20','2025-07-03','2025-09-30','2026-01-08','2026-06-15'];
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
async function fm(dataset,id,start=START,end=END){
 const u=new URL(API);u.searchParams.set('dataset',dataset);if(id)u.searchParams.set('data_id',id);u.searchParams.set('start_date',start);u.searchParams.set('end_date',end);
 const r=await fetch(u);if(!r.ok)throw Error(dataset+' '+(id||'')+' HTTP '+r.status);const j=await r.json();return j.data||[];
}
function P(raw){return raw.map(r=>({date:r.date,close:+r.close})).filter(x=>Number.isFinite(x.close)&&x.close>0).sort((a,b)=>a.date.localeCompare(b.date))}
function dateAdd(d,days){return new Date(new Date(d+'T00:00:00Z').getTime()+days*86400000).toISOString().slice(0,10)}
function latest(rows,type,date,lag=70){
 const cutoff=dateAdd(date,-lag);let best=null;
 for(const r of rows)if(r.type===type&&r.date<=cutoff&&(!best||r.date>best.date))best=r;
 return best?+best.value:null;
}
function latestShares(rows,date){
 let best=null;for(const r of rows)if(r.date<=date&&(!best||r.date>best.date)){const v=+r.NumberOfSharesIssued;if(Number.isFinite(v)&&v>0)best={date:r.date,v}}
 return best?.v??null;
}
function revenueInfo(rev,date){
 let ref=date,cut=date.slice(0,7)+'-11';
 if(date<cut){const d=new Date(date+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);ref=d.toISOString().slice(0,10)}
 let y=+ref.slice(0,4),m=+ref.slice(5,7);m--;if(m===0){m=12;y--}
 const get=(yy,mm)=>rev.find(x=>+x.revenue_year===yy&&+x.revenue_month===mm);
 const cur=get(y,m),py=get(y-1,m);if(!cur||!py||+py.revenue<=0)return null;
 let pm=m-1,pyy=y;if(pm===0){pm=12;pyy--}
 const prev=get(pyy,pm),prevpy=get(pyy-1,pm);
 const yoy=+cur.revenue/+py.revenue-1;
 const prevYoy=(prev&&prevpy&&+prevpy.revenue>0)?+prev.revenue/+prevpy.revenue-1:null;
 return {yoy,accel:prevYoy==null?null:yoy-prevYoy};
}
function qg(d,date){
 const op=latest(d.fin,'OperatingIncome',date),ni=latest(d.fin,'IncomeAfterTaxes',date);
 let ocf=latest(d.cf,'CashFlowsFromOperatingActivities',date);if(ocf==null)ocf=latest(d.cf,'NetCashInflowFromOperatingActivities',date);
 const rev=revenueInfo(d.rev,date);
 if(op==null||ni==null||ocf==null||!rev||rev.accel==null)return null;
 const quality=((op>0)+(ni>0)+(ocf>0))/3;
 const growth=((rev.yoy>0)+(rev.accel>0))/2;
 return {quality,growth,qg:(quality*3+growth*2)/5,yoy:rev.yoy,accel:rev.accel};
}
function outcome(p,date,h=H){
 const i=p.findIndex(x=>x.date===date);if(i<0||!p[i+h])return null;
 let peak=p[i].close,dd=0;
 for(let j=i+1;j<=i+h;j++){peak=Math.max(peak,p[j].close);dd=Math.min(dd,p[j].close/peak-1)}
 return {ret:p[i+h].close/p[i].close-1,dd};
}
function snapshotDates(calendar){
 const pos=new Map(calendar.map((d,i)=>[d,i])),blocked=new Set();
 for(const d of USED){const k=pos.get(d);if(k==null)continue;for(let j=Math.max(0,k-20);j<=Math.min(calendar.length-1,k+20);j++)blocked.add(calendar[j])}
 const by=new Map();
 for(const d of calendar){
   if(d<'2023-01-01'||d>'2026-06-30'||blocked.has(d)||+d.slice(8,10)<15)continue;
   const ym=d.slice(0,7);if(!by.has(ym))by.set(ym,d);
 }
 // fresh-date spacing: at least 40 TAIEX trading days between snapshots
 const candidates=[...by.values()],chosen=[];
 for(const d of candidates){const k=pos.get(d);if(chosen.every(x=>Math.abs(pos.get(x)-k)>=40))chosen.push(d)}
 return chosen;
}
function buildSizeNeutral(rows){
 const s=rows.filter(x=>Number.isFinite(x.cap)).sort((a,b)=>a.cap-b.cap);
 if(s.length<18)return null;
 const cuts=[0,Math.floor(s.length/3),Math.floor(2*s.length/3),s.length],top=[],bottom=[];
 for(let z=0;z<3;z++){
   const b=s.slice(cuts[z],cuts[z+1]).sort((a,b)=>b.qg-a.qg);
   const k=Math.max(2,Math.floor(b.length*.25));
   top.push(...b.slice(0,k));bottom.push(...b.slice(-k));
 }
 return {top,bottom};
}
function plain(rows){
 const x=[...rows].sort((a,b)=>b.qg-a.qg),k=Math.max(3,Math.floor(x.length*.2));
 return {top:x.slice(0,k),bottom:x.slice(-k)};
}
function stat(a){return {n:a.length,mean:mean(a),median:median(a),positive:a.filter(x=>x>0).length/a.length,q25:q(a,.25),q75:q(a,.75)}}
function signPerm(diffs,B=20000){const obs=mean(diffs),r=rng(772211);let e=0;for(let b=0;b<B;b++){const v=mean(diffs.map(x=>r()<.5?x:-x));if(v>=obs)e++}return (e+1)/(B+1)}
function bootCI(diffs,B=10000){const r=rng(883311),vals=[];for(let b=0;b<B;b++){const a=[];for(let i=0;i<diffs.length;i++)a.push(diffs[Math.floor(r()*diffs.length)]);vals.push(mean(a))}return [q(vals,.025),q(vals,.975)]}
function placebo(records,B=10000){
 const r=rng(665544);const obs=mean(records.map(x=>x.snSpread));let e=0,sum=0;
 for(let b=0;b<B;b++){
   const ds=[];
   for(const rec of records){
     const rows=rec.rows,sorted=[...rows].sort((a,b)=>a.cap-b.cap),cuts=[0,Math.floor(sorted.length/3),Math.floor(2*sorted.length/3),sorted.length];
     const T=[],D=[];
     for(let z=0;z<3;z++){
       const bucket=sorted.slice(cuts[z],cuts[z+1]),k=Math.max(2,Math.floor(bucket.length*.25)),sh=[...bucket].sort(()=>r()-.5);
       T.push(...sh.slice(0,k));D.push(...sh.slice(k,2*k));
     }
     ds.push(mean(T.map(x=>x.ret))-mean(D.map(x=>x.ret)));
   }
   const v=mean(ds);sum+=v;if(v>=obs)e++;
 }
 return {observed:obs,placeboMean:sum/B,p:(e+1)/(B+1)};
}
(async()=>{
 const info=await fm('TaiwanStockInfo','', '2026-01-01','2026-09-22');
 const latestInfo=new Map();
 for(const x of info){
   if(x.type!=='twse'||!/^[0-9]{4}$/.test(x.stock_id)||EX.has(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;
   const old=latestInfo.get(x.stock_id);if(!old||x.date>old.date)latestInfo.set(x.stock_id,x);
 }
 const rsel=rng(SEED),candidates=[...latestInfo.values()].sort(()=>rsel()-.5);
 const chosen=[];
 for(const s of candidates){
   if(chosen.length>=NSTOCK)break;
   const pr=await fm('TaiwanStockPrice',s.stock_id);
   const p=P(pr);
   if(p.length<700||p[0].date>'2023-01-15')continue;
   chosen.push({...s,p});
 }
 console.log('LOCKED_STOCKS',JSON.stringify({seed:SEED,n:chosen.length,stocks:chosen.map(x=>({code:x.stock_id,name:x.stock_name,industry:x.industry_category}))}));
 const data={};
 for(const s of chosen){
   const [rev,fin,cf,sh]=await Promise.all([
     fm('TaiwanStockMonthRevenue',s.stock_id),fm('TaiwanStockFinancialStatements',s.stock_id),
     fm('TaiwanStockCashFlowsStatement',s.stock_id),fm('TaiwanStockShareholding',s.stock_id)
   ]);
   data[s.stock_id]={code:s.stock_id,name:s.stock_name,industry:s.industry_category,p:s.p,rev,fin,cf,sh};
 }
 const index=await fm('TaiwanStockTotalReturnIndex','TAIEX'),calendar=index.map(x=>x.date).sort(),dates=snapshotDates(calendar);
 console.log('LOCKED_DATES',JSON.stringify({n:dates.length,dates}));
 const records=[];
 for(const date of dates){
   const rows=[];
   for(const s of chosen){
     const d=data[s.stock_id],f=qg(d,date);if(!f)continue;
     const o=outcome(d.p,date);if(!o)continue;
     const i=d.p.findIndex(x=>x.date===date),sh=latestShares(d.sh,date);if(i<0||!sh)continue;
     rows.push({code:d.code,name:d.name,industry:d.industry,qg:f.qg,quality:f.quality,growth:f.growth,ret:o.ret,dd:o.dd,cap:d.p[i].close*sh});
   }
   if(rows.length<18)continue;
   const sn=buildSizeNeutral(rows),pl=plain(rows);if(!sn)continue;
   records.push({
     date,n:rows.length,
     snTop:mean(sn.top.map(x=>x.ret)),snBottom:mean(sn.bottom.map(x=>x.ret)),snSpread:mean(sn.top.map(x=>x.ret))-mean(sn.bottom.map(x=>x.ret)),
     snTopDD:mean(sn.top.map(x=>x.dd)),snBottomDD:mean(sn.bottom.map(x=>x.dd)),
     plainTop:mean(pl.top.map(x=>x.ret)),plainBottom:mean(pl.bottom.map(x=>x.ret)),plainSpread:mean(pl.top.map(x=>x.ret))-mean(pl.bottom.map(x=>x.ret)),
     topNames:sn.top.map(x=>x.code),bottomNames:sn.bottom.map(x=>x.code),rows
   });
 }
 const d=records.map(x=>x.snSpread),pd=records.map(x=>x.plainSpread);
 const out={
   snapshots:records.length,
   sizeNeutral:{
     top:stat(records.map(x=>x.snTop)),bottom:stat(records.map(x=>x.snBottom)),
     spread:stat(d),positiveSpread:d.filter(x=>x>0).length/d.length,
     permP:signPerm(d),bootstrap95:bootCI(d),
     topDD:stat(records.map(x=>x.snTopDD)),bottomDD:stat(records.map(x=>x.snBottomDD)),
     placebo:placebo(records)
   },
   plain:{
     top:stat(records.map(x=>x.plainTop)),bottom:stat(records.map(x=>x.plainBottom)),
     spread:stat(pd),positiveSpread:pd.filter(x=>x>0).length/pd.length,permP:signPerm(pd),bootstrap95:bootCI(pd)
   },
   byDate:records.map(x=>({date:x.date,n:x.n,snTop:x.snTop,snBottom:x.snBottom,snSpread:x.snSpread,topNames:x.topNames,bottomNames:x.bottomNames}))
 };
 console.log('RESULT',JSON.stringify(out));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
