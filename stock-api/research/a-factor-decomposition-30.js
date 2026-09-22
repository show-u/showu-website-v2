
const API='https://api.finmindtrade.com/api/v4/data';
const START='2021-01-01',END='2026-09-22',SEED=20260925,NSTOCK=30;
const EX=new Set(['2330','2454','2409','2881','1301','2434','1454','3419']);
const USED=['2024-08-21','2025-08-21','2026-08-21','2023-05-16','2023-08-23','2023-11-13','2024-01-16','2024-03-25','2024-06-03','2024-10-23','2025-03-20','2025-07-03','2025-09-30','2026-01-08','2026-06-15'];
const H=[63,126,252];
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const pct=(a,x)=>a.length?a.filter(v=>v<=x).length/a.length:null;
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
 let best=null;
 for(const r of rows)if(r.date<=date&&(!best||r.date>best.date)){const v=+r.NumberOfSharesIssued;if(Number.isFinite(v)&&v>0)best={date:r.date,v}}
 return best?.v??null;
}
function revenueInfo(rev,date){
 const availCut=date.slice(0,7)+'-11';
 let ref=date;if(date<availCut){const d=new Date(date+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);ref=d.toISOString().slice(0,10)}
 let y=+ref.slice(0,4),m=+ref.slice(5,7);m--;if(m===0){m=12;y--}
 const get=(yy,mm)=>rev.find(x=>+x.revenue_year===yy&&+x.revenue_month===mm);
 const cur=get(y,m),py=get(y-1,m);if(!cur||!py||+py.revenue<=0)return null;
 let pm=m-1,pyy=y;if(pm===0){pm=12;pyy--}
 const prev=get(pyy,pm),prevpy=get(pyy-1,pm);
 return {yoy:+cur.revenue/+py.revenue-1, accel:(prev&&prevpy&&+prevpy.revenue>0)?(+cur.revenue/+py.revenue-1)-(+prev.revenue/+prevpy.revenue-1):null};
}
function valuation(per,date){
 const rows=per.filter(x=>x.date<=date&&+x.PER>0&&+x.PBR>0).sort((a,b)=>a.date.localeCompare(b.date));
 if(rows.length<121)return null;const cur=rows[rows.length-1],hist=rows.slice(Math.max(0,rows.length-253),-1);
 return {per:+cur.PER,pbr:+cur.PBR,perPct:pct(hist.map(x=>+x.PER),+cur.PER),pbrPct:pct(hist.map(x=>+x.PBR),+cur.PBR)};
}
function features(d,date){
 const op=latest(d.fin,'OperatingIncome',date),ni=latest(d.fin,'IncomeAfterTaxes',date);
 let ocf=latest(d.cf,'CashFlowsFromOperatingActivities',date);if(ocf==null)ocf=latest(d.cf,'NetCashInflowFromOperatingActivities',date);
 const assets=latest(d.bs,'TotalAssets',date),liab=latest(d.bs,'TotalLiabilities',date);
 const rev=revenueInfo(d.rev,date),val=valuation(d.per,date);
 if([op,ni,ocf,assets,liab].some(v=>v==null)||!rev||!val||assets<=0)return null;
 const quality=(op>0?1:0)+(ni>0?1:0)+(ocf>0?1:0);
 const growth=(rev.yoy>0?1:0)+(rev.accel!=null&&rev.accel>0?1:0);
 const value=(val.perPct<=.5?1:0)+(val.pbrPct<=.5?1:0);
 const safety=(liab/assets<=.6?1:0);
 return {
   quality:quality/3,growth:growth/2,value:value/2,safety,
   full:(quality+growth+value+safety)/8,
   qg:(quality+growth)/5,qv:(quality+value)/5,gv:(growth+value)/4,
   perPct:val.perPct,pbrPct:val.pbrPct,debt:liab/assets,yoy:rev.yoy,accel:rev.accel
 };
}
function outcome(p,date,h){
 const i=p.findIndex(x=>x.date===date);if(i<0||!p[i+h])return null;return p[i+h].close/p[i].close-1;
}
function dd(p,date,h){
 const i=p.findIndex(x=>x.date===date);if(i<0||!p[i+h])return null;let peak=p[i].close,m=0;
 for(let j=i+1;j<=i+h;j++){peak=Math.max(peak,p[j].close);m=Math.min(m,p[j].close/peak-1)}return m;
}
function snapshots(common){
 const pos=new Map(common.map((d,i)=>[d,i])),ex=new Set();
 for(const d of USED){const k=pos.get(d);if(k==null)continue;for(let j=Math.max(0,k-20);j<=Math.min(common.length-1,k+20);j++)ex.add(common[j])}
 const by=new Map();
 for(const d of common){
   if(d<'2023-01-01'||d>'2025-08-31'||ex.has(d)||+d.slice(8,10)<15)continue;
   const ym=d.slice(0,7);if(!by.has(ym))by.set(ym,d);
 }
 return [...by.values()];
}
function topBottom(rows,scoreField){
 const x=rows.filter(r=>Number.isFinite(r.f[scoreField])).sort((a,b)=>b.f[scoreField]-a.f[scoreField]||a.f.perPct-b.f.perPct);
 const k=Math.max(2,Math.floor(x.length*.2));return {top:x.slice(0,k),bottom:x.slice(-k),k};
}
function stat(a){return {n:a.length,mean:mean(a),median:median(a),positive:a.filter(x=>x>0).length/a.length,q25:q(a,.25),q75:q(a,.75)}}
function permP(diffs,B=10000){
 const obs=mean(diffs),r=rng(1234567);let ex=0;
 for(let b=0;b<B;b++){const v=mean(diffs.map(x=>r()<.5?x:-x));if(v>=obs)ex++}
 return (ex+1)/(B+1);
}
(async()=>{
 const info=await fm('TaiwanStockInfo','', '2026-01-01','2026-09-22');
 const universe=info.filter(x=>x.type==='twse'&&/^[0-9]{4}$/.test(x.stock_id)&&!EX.has(x.stock_id));
 const rr=rng(SEED),selected=[...universe].sort(()=>rr()-.5).slice(0,NSTOCK);
 console.log('STOCK_LOCK',JSON.stringify({seed:SEED,stocks:selected.map(x=>({code:x.stock_id,name:x.stock_name,industry:x.industry_category}))}));
 const data={},sets=[];
 for(const s of selected){
   const [pr,rev,per,fin,bs,cf,sh]=await Promise.all([
     fm('TaiwanStockPrice',s.stock_id),fm('TaiwanStockMonthRevenue',s.stock_id),fm('TaiwanStockPER',s.stock_id),
     fm('TaiwanStockFinancialStatements',s.stock_id),fm('TaiwanStockBalanceSheet',s.stock_id),fm('TaiwanStockCashFlowsStatement',s.stock_id),fm('TaiwanStockShareholding',s.stock_id)
   ]);
   const p=P(pr);data[s.stock_id]={code:s.stock_id,name:s.stock_name,industry:s.industry_category,p,rev,per,fin,bs,cf,sh};sets.push(new Set(p.map(x=>x.date)));
 }
 const common=[...sets[0]].filter(d=>sets.every(s=>s.has(d))).sort(),snaps=snapshots(common);
 const models=['quality','growth','value','safety','qg','qv','gv','full'];
 const rec=Object.fromEntries(models.map(m=>[m,[]]));
 const industryRec=[],sizeRec=[];
 for(const date of snaps){
   const rows=[];
   for(const s of selected){
     const d=data[s.stock_id],f=features(d,date);if(!f)continue;
     const r={code:d.code,name:d.name,industry:d.industry,f,marketCap:null,ret:{},dd:{}};
     const i=d.p.findIndex(x=>x.date===date);if(i<0)continue;
     const sh=latestShares(d.sh,date);if(sh)r.marketCap=d.p[i].close*sh;
     let ok=true;for(const h of H){r.ret[h]=outcome(d.p,date,h);r.dd[h]=dd(d.p,date,h);if(r.ret[h]==null)ok=false}if(ok)rows.push(r);
   }
   if(rows.length<15)continue;
   for(const m of models){
     const tb=topBottom(rows,m);
     for(const h of H)rec[m].push({date,h,top:mean(tb.top.map(x=>x.ret[h])),bottom:mean(tb.bottom.map(x=>x.ret[h])),topDD:mean(tb.top.map(x=>x.dd[h])),bottomDD:mean(tb.bottom.map(x=>x.dd[h])),k:tb.k,n:rows.length});
   }
   // industry-neutral: demean full score within sample industry groups with >=2 names
   const groups=new Map();for(const r of rows){if(!groups.has(r.industry))groups.set(r.industry,[]);groups.get(r.industry).push(r)}
   const ir=rows.map(r=>({...r,neutral:r.f.full-(groups.get(r.industry).length>=2?mean(groups.get(r.industry).map(x=>x.f.full)):mean(rows.map(x=>x.f.full)))}));
   const itb=topBottom(ir.map(x=>({...x,f:{...x.f,indNeutral:x.neutral}})),'indNeutral');
   for(const h of H)industryRec.push({date,h,top:mean(itb.top.map(x=>x.ret[h])),bottom:mean(itb.bottom.map(x=>x.ret[h])),k:itb.k});
   // size-neutral: rank full score inside market-cap terciles, then combine top/bottom within tercile
   const sr=rows.filter(x=>Number.isFinite(x.marketCap)).sort((a,b)=>a.marketCap-b.marketCap);
   if(sr.length>=15){
     const buckets=[sr.slice(0,Math.floor(sr.length/3)),sr.slice(Math.floor(sr.length/3),Math.floor(2*sr.length/3)),sr.slice(Math.floor(2*sr.length/3))];
     const tops=[],bots=[];
     for(const b of buckets){const z=[...b].sort((a,b)=>b.f.full-a.f.full);const k=Math.max(1,Math.floor(z.length*.2));tops.push(...z.slice(0,k));bots.push(...z.slice(-k))}
     for(const h of H)sizeRec.push({date,h,top:mean(tops.map(x=>x.ret[h])),bottom:mean(bots.map(x=>x.ret[h])),k:tops.length});
   }
 }
 const out={};
 for(const m of models){
   out[m]={};
   for(const h of H){
     const a=rec[m].filter(x=>x.h===h),diff=a.map(x=>x.top-x.bottom);
     out[m][h]={snapshots:a.length,top:stat(a.map(x=>x.top)),bottom:stat(a.map(x=>x.bottom)),spreadMean:mean(diff),spreadMedian:median(diff),positiveSpread:diff.filter(x=>x>0).length/diff.length,permP:permP(diff),topDD:mean(a.map(x=>x.topDD)),bottomDD:mean(a.map(x=>x.bottomDD))};
   }
 }
 const neutral={industry:{},size:{}};
 for(const h of H){
   for(const [name,arr] of [['industry',industryRec],['size',sizeRec]]){
     const a=arr.filter(x=>x.h===h),d=a.map(x=>x.top-x.bottom);
     neutral[name][h]={snapshots:a.length,topMean:mean(a.map(x=>x.top)),bottomMean:mean(a.map(x=>x.bottom)),spreadMean:mean(d),positiveSpread:d.filter(x=>x>0).length/d.length,permP:permP(d)};
   }
 }
 console.log('MODEL_RESULTS',JSON.stringify(out));
 console.log('NEUTRAL_RESULTS',JSON.stringify(neutral));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
