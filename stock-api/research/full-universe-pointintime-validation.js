
const API='https://api.finmindtrade.com/api/v4/data';
const START='2019-01-01', END='2026-09-24', H=84;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
async function fm(ds,id){
 for(let a=0;a<5;a++){
  const u=new URL(API);u.searchParams.set('dataset',ds);if(id)u.searchParams.set('data_id',id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);
  const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
  if(r.ok){const j=await r.json();return j.data||[]}
  if(r.status===429||r.status>=500){await sleep(800*(a+1));continue}
  return [];
 }return [];
}
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);return (await r.json()).data||[]}
async function pool(items,limit,fn){
 const out=new Array(items.length);let idx=0;
 async function w(){while(1){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i])}catch(e){out[i]=null}await sleep(30)}}
 await Promise.all(Array.from({length:limit},w));return out;
}
function pctRank(rows,key){
 const sorted=[...rows].sort((a,b)=>a[key]-b[key]),m=new Map();
 for(let i=0;i<sorted.length;i++)m.set(sorted[i].code,i/(sorted.length-1||1));
 return m;
}
function revFeat(rows,date){
 const a=rows.filter(x=>(x.create_time||x.date)<=date&&+x.revenue>0)
  .map(x=>({y:+x.revenue_year,m:+x.revenue_month,v:+x.revenue,ct:x.create_time||x.date}))
  .sort((x,z)=>x.ct.localeCompare(z.ct));
 if(!a.length)return null;
 const cur=a.at(-1),get=(Y,M)=>a.find(x=>x.y===Y&&x.m===M)?.v??null,ys=[];
 for(let k=0;k<4;k++){
  let M=cur.m-k,Y=cur.y;while(M<=0){M+=12;Y--}
  const v=get(Y,M),py=get(Y-1,M);if(!(v>0&&py>0))return null;ys.push(v/py-1);
 }
 return {revMonth:cur.y+'-'+String(cur.m).padStart(2,'0'),revYoY:ys[0],revAccel:ys[0]-mean(ys.slice(1))};
}
function nearestIndex(p,date){
 let lo=0,hi=p.length-1,ans=-1;
 while(lo<=hi){const m=(lo+hi)>>1;if(p[m].date<=date){ans=m;lo=m+1}else hi=m-1}
 return ans;
}
function perm(v,B=20000){
 let z=123987;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};
 const obs=mean(v);let e=0;
 for(let b=0;b<B;b++){let s=0;for(const x of v)s+=(r()<.5?x:-x);if(s/v.length>=obs)e++}
 return(e+1)/(B+1);
}
function boot(v,B=10000){
 let z=789321;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296},a=[];
 for(let b=0;b<B;b++){let s=0;for(let i=0;i<v.length;i++)s+=v[Math.floor(r()*v.length)];a.push(s/v.length)}
 return[q(a,.025),q(a,.975)];
}
(async()=>{
 console.log('PROTOCOL',JSON.stringify({
  universe:'all 4-digit TWSE/TPEx ordinary-stock-like codes present in TaiwanStockInfo, excluding ETF/index labels; no random sampling',
  price_source:'FinMind TaiwanStockPrice, per stock',
  revenue_source:'FinMind TaiwanStockMonthRevenue, per stock with create_time point-in-time cutoff',
  period:START+'..'+END,
  dates:'non-overlapping 84-trading-day grid',
  outcome:'future 84-trading-day return >=20%',
  rules:['MOM6 = return from t-126 to t-21','stage1 MOM6 top20%','stage2 revenue acceleration top33% within stage1'],
  no_posthoc_tuning:true
 }));
 const raw=await info(),meta=new Map();
 for(const x of raw){
  if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id))continue;
  const ind=(x.industry_category||'').toLowerCase(),name=x.stock_name||'';
  if(ind.includes('etf')||ind==='index'||name.includes('指數'))continue;
  const o=meta.get(x.stock_id);if(!o||String(x.date)>String(o.date))meta.set(x.stock_id,x);
 }
 const codes=[...meta.keys()].sort();
 console.log('UNIVERSE_META',JSON.stringify({codes:codes.length}));
 const priceRes=await pool(codes,12,async code=>{
  const rows=await fm('TaiwanStockPrice',code);
  const p=rows.map(x=>({date:x.date,c:+x.close})).filter(x=>x.c>0).sort((a,b)=>a.date.localeCompare(b.date));
  return p.length>=260?{code,p}:null;
 });
 const priced=priceRes.filter(Boolean);
 console.log('PRICE_DONE',JSON.stringify({requested:codes.length,valid:priced.length,totalRows:priced.reduce((s,x)=>s+x.p.length,0)}));
 const revRes=await pool(priced,10,async d=>{
  const rev=await fm('TaiwanStockMonthRevenue',d.code);
  return rev.length>=16?{...d,rev}:null;
 });
 const data=revRes.filter(Boolean);
 console.log('REVENUE_DONE',JSON.stringify({valid:data.length,totalRows:data.reduce((s,x)=>s+x.rev.length,0)}));
 const calendar=[...new Set(data.flatMap(d=>d.p.map(x=>x.date)))].sort();
 const dates=[];for(let i=300;i<calendar.length-H;i+=84){const d=calendar[i];if(d>='2020-06-01'&&d<='2026-04-30')dates.push(d)}
 const byDate=[],deltaM=[],deltaR=[],counts=[];
 for(const date of dates){
  const rows=[];
  for(const d of data){
   const i=nearestIndex(d.p,date);if(i<126||!d.p[i+H]||d.p[i].date!==date)continue;
   const mom=d.p[i-21].c/d.p[i-126].c-1,ret=d.p[i+H].c/d.p[i].c-1,rf=revFeat(d.rev,date);
   if(!rf)continue;rows.push({code:d.code,mom,ret,...rf});
  }
  if(rows.length<300)continue;
  const base=mean(rows.map(x=>x.ret>=.2?1:0)),rank=pctRank(rows,'mom');
  const s1=rows.filter(x=>(rank.get(x.code)||0)>=.8),p1=mean(s1.map(x=>x.ret>=.2?1:0));
  const cut=q(s1.map(x=>x.revAccel),.67),s2=s1.filter(x=>x.revAccel>=cut),p2=mean(s2.map(x=>x.ret>=.2?1:0));
  deltaM.push(p1-base);deltaR.push(p2-p1);counts.push({universe:rows.length,s1:s1.length,s2:s2.length});
  byDate.push({date,universeN:rows.length,baseline:base,mom20N:s1.length,mom20Precision:p1,mom20Lift:p1-base,revAccelN:s2.length,revAccelPrecision:p2,revAccelLiftVsMOM:p2-p1});
 }
 const split=byDate.map(x=>({...x,period:x.date<'2023-01-01'?'early':'late'}));
 function summarize(arr,field){
  const v=arr.map(x=>x[field]);return{n:v.length,mean:mean(v),positive:v.filter(x=>x>0).length/(v.length||1),p:perm(v),ci:boot(v)};
 }
 const early=split.filter(x=>x.period==='early'),late=split.filter(x=>x.period==='late');
 const result={
  dates:byDate.length,
  avgUniverse:mean(counts.map(x=>x.universe)),
  avgStage1:mean(counts.map(x=>x.s1)),
  avgStage2:mean(counts.map(x=>x.s2)),
  all:{momLift:summarize(byDate,'mom20Lift'),revLift:summarize(byDate,'revAccelLiftVsMOM')},
  early:{momLift:summarize(early,'mom20Lift'),revLift:summarize(early,'revAccelLiftVsMOM')},
  late:{momLift:summarize(late,'mom20Lift'),revLift:summarize(late,'revAccelLiftVsMOM')},
  byDate
 };
 console.log('RESULT',JSON.stringify(result));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
