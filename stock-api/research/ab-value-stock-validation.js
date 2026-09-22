
const STOCKS=[
 {code:'2434',name:'統懋'},{code:'1454',name:'台富'},{code:'3419',name:'譁裕'}
];
const START='2021-01-01',END='2026-09-22',SEED=20260924;
const USED=['2024-08-21','2025-08-21','2026-08-21','2023-05-16','2023-08-23','2023-11-13','2024-01-16','2024-03-25','2024-06-03','2024-10-23','2025-03-20','2025-07-03','2025-09-30','2026-01-08','2026-06-15'];
const API='https://api.finmindtrade.com/api/v4/data';
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const pct=(a,x)=>a.length?a.filter(v=>v<=x).length/a.length:null;
const std=a=>{const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)))||1};
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
async function fm(dataset,id){
 const u=new URL(API);u.searchParams.set('dataset',dataset);if(id)u.searchParams.set('data_id',id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);
 const r=await fetch(u);if(!r.ok)throw Error(dataset+' '+id+' HTTP '+r.status);const j=await r.json();return j.data||[];
}
function P(raw){return raw.map(r=>({date:r.date,open:+r.open,high:+r.max,low:+r.min,close:+r.close,vol:+r.Trading_Volume})).filter(x=>[x.open,x.high,x.low,x.close].every(Number.isFinite)).sort((a,b)=>a.date.localeCompare(b.date))}
function I(raw){return raw.map(r=>({date:r.date,close:+r.price})).filter(x=>Number.isFinite(x.close)).sort((a,b)=>a.date.localeCompare(b.date))}
function ma(p,i,n){if(i<n-1)return null;return mean(p.slice(i-n+1,i+1).map(x=>x.close))}
function ret(p,i,n){return i>=n?p[i].close/p[i-n].close-1:null}
function dateAdd(d,days){return new Date(new Date(d+'T00:00:00Z').getTime()+days*86400000).toISOString().slice(0,10)}
function valAt(rows,type,date,lag=60){
 const cutoff=dateAdd(date,-lag); let best=null;
 for(const r of rows)if(r.type===type&&r.date<=cutoff&&(!best||r.date>best.date))best=r;
 return best?+best.value:null;
}
function latestRevInfo(rev,date){
 const cutoff=date.slice(0,7)+'-11';
 if(date<cutoff){
   const d=new Date(date+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);
   date=d.toISOString().slice(0,10);
 }
 const yr=+date.slice(0,4),mo=+date.slice(5,7);
 // On/after month M 11th, month M-1 revenue should be available.
 let rm=mo-1,ry=yr;if(rm===0){rm=12;ry--}
 const key=(y,m)=>rev.find(x=>+x.revenue_year===y&&+x.revenue_month===m);
 const cur=key(ry,rm),prev=key(ry-1,rm);
 let prm=rm-1,pry=ry;if(prm===0){prm=12;pry--}
 const curPrev=key(pry,prm),prevPrev=key(pry-1,prm);
 if(!cur||!prev||+prev.revenue<=0)return null;
 return {yoy:+cur.revenue/+prev.revenue-1,prevYoy:(curPrev&&prevPrev&&+prevPrev.revenue>0)?+curPrev.revenue/+prevPrev.revenue-1:null};
}
function perInfo(per,date){
 const rows=per.filter(x=>x.date<=date&&+x.PER>0&&+x.PBR>0).sort((a,b)=>a.date.localeCompare(b.date));
 if(!rows.length)return null;const cur=rows[rows.length-1],hist=rows.slice(Math.max(0,rows.length-252),-1);
 if(hist.length<120)return null;
 return {per:+cur.PER,pbr:+cur.PBR,perPct:pct(hist.map(x=>+x.PER),+cur.PER),pbrPct:pct(hist.map(x=>+x.PBR),+cur.PBR)};
}
function fundamentals(d,date){
 const r=latestRevInfo(d.rev,date),v=perInfo(d.per,date);
 const op=valAt(d.fin,'OperatingIncome',date),ni=valAt(d.fin,'IncomeAfterTaxes',date);
 let ocf=valAt(d.cf,'CashFlowsFromOperatingActivities',date);
 if(ocf==null)ocf=valAt(d.cf,'NetCashInflowFromOperatingActivities',date);
 const assets=valAt(d.bs,'TotalAssets',date),liab=valAt(d.bs,'TotalLiabilities',date);
 const comps=[];
 if(op!=null)comps.push({k:'opProfit',ok:op>0});
 if(ni!=null)comps.push({k:'netProfit',ok:ni>0});
 if(ocf!=null)comps.push({k:'ocf',ok:ocf>0});
 if(r){comps.push({k:'revGrowth',ok:r.yoy>0});if(r.prevYoy!=null)comps.push({k:'revAccel',ok:r.yoy>r.prevYoy})}
 if(v){comps.push({k:'perValue',ok:v.perPct<=.5});comps.push({k:'pbrValue',ok:v.pbrPct<=.5})}
 if(assets>0&&liab!=null)comps.push({k:'debtSafe',ok:liab/assets<=.6});
 if(comps.length<6)return null;
 return {score:comps.filter(x=>x.ok).length/comps.length,passed:comps.filter(x=>x.ok).map(x=>x.k),available:comps.length,rev:r,val:v};
}
function outcome(p,i,h){
 if(i<0||!p[i+h])return null;const entry=p[i].close,seg=p.slice(i+1,i+h+1);
 return {ret:p[i+h].close/entry-1,mfe:Math.max(...seg.map(x=>x.high))/entry-1,mae:Math.min(...seg.map(x=>x.low))/entry-1};
}
function maxDD(p,i,h){
 if(!p[i+h])return null;let peak=p[i].close,dd=0;
 for(let j=i+1;j<=i+h;j++){peak=Math.max(peak,p[j].close);dd=Math.min(dd,p[j].close/peak-1)}return dd;
}
function excludeSet(common){
 const pos=new Map(common.map((d,i)=>[d,i])),ex=new Set();
 for(const d of USED){const k=pos.get(d);if(k==null)continue;for(let j=Math.max(0,k-20);j<=Math.min(common.length-1,k+20);j++)ex.add(common[j])}
 return ex;
}
function monthlySnapshots(common,ex){
 const by=new Map();
 for(const d of common){
   if(d<'2023-01-01'||d>'2025-08-31'||ex.has(d))continue;
   const ym=d.slice(0,7);if(+d.slice(8,10)<15)continue;
   if(!by.has(ym))by.set(ym,d);
 }
 return [...by.values()];
}
function nearestIndex(p,date){const i=p.findIndex(x=>x.date===date);return i}
function bAnalogs(d,idx,index,indexMap){
 const p=d.p,date=p[idx].date,ii=indexMap.get(date);if(idx<80||ii==null||ii<80)return null;
 const feat=(j,k)=> {
   const ij=indexMap.get(p[j].date);if(ij==null||j<60||ij<60)return null;
   const r20=ret(p,j,20),ma60=ma(p,j,60),iv=[];
   for(let z=j-19;z<=j;z++)iv.push(Math.log(p[z].close/p[z-1].close));
   const vol=Math.sqrt(mean(iv.map(x=>x*x)))*Math.sqrt(252);
   const ir20=index[ij].close/index[ij-20].close-1;
   return [r20,p[j].close/ma60-1,vol,r20-ir20];
 };
 const target=feat(idx);if(!target)return null;
 const c=[];
 for(let j=80;j<=idx-40;j++){
   const f=feat(j);if(!f||!p[j+20])continue;c.push({j,f});
 }
 if(c.length<40)return null;
 const sds=[0,1,2,3].map(k=>std(c.map(x=>x.f[k])));
 for(const x of c)x.d=Math.sqrt(x.f.reduce((s,v,k)=>s+((v-target[k])/sds[k])**2,0));
 c.sort((a,b)=>a.d-b.d);
 const sel=[];
 for(const x of c){if(sel.every(y=>Math.abs(x.j-y.j)>=20)){sel.push(x);if(sel.length===20)break}}
 if(sel.length<10)return null;
 const outs=sel.map(x=>outcome(p,x.j,20)).filter(Boolean);
 const mr=median(outs.map(x=>x.ret)),mmfe=median(outs.map(x=>x.mfe)),mmae=median(outs.map(x=>x.mae));
 return {predRet:mr,predMFE:mmfe,predMAE:mmae,predRR:mmfe/Math.max(.0001,Math.abs(mmae)),favorable:mr>0&&mmfe/Math.max(.0001,Math.abs(mmae))>1};
}
function summarize(arr,field){
 const x=arr.map(z=>z[field]).filter(Number.isFinite);return {n:x.length,mean:mean(x),median:median(x),q25:q(x,.25),q75:q(x,.75),positive:x.filter(v=>v>0).length/x.length};
}
function placeboTop(records,B=5000){
 const r=rng(555555),obs={63:mean(records.map(x=>x.top63)),126:mean(records.map(x=>x.top126)),252:mean(records.map(x=>x.top252))},res={};
 for(const h of [63,126,252]){
   let ext=0,sum=0;
   for(let b=0;b<B;b++){let s=0,n=0;for(const rec of records){const vals=rec['all'+h];if(vals.length){s+=vals[Math.floor(r()*vals.length)];n++}}const v=s/n;sum+=v;if(v>=obs[h])ext++}
   res[h]={observed:obs[h],placeboMean:sum/B,p:(ext+1)/(B+1)};
 }
 return res;
}
(async()=>{
 console.log('AB_LOCK',JSON.stringify({
  stocks:STOCKS,seed:SEED,
  A:'Fundamental value score only, equal-weight available binary tests: positive operating profit/net profit/OCF, revenue YoY positive and accelerating, PER/PBR <= own trailing-252 median, liabilities/assets <=60% when available. Quarterly data conservatively lagged 60 calendar days. Monthly revenue usable from calendar 11th. On each fresh monthly snapshot choose highest score; ties lower PER percentile.',
  B:'For A-selected stock only, estimate 20d path from up to 20 same-stock pre-snapshot analogues using 20d return, distance to MA60, realized vol, and 20d relative strength vs TAIEX. Analogue outcomes must be fully known before snapshot. Favorable iff historical median 20d return >0 AND median MFE/abs(MAE)>1.',
  validation:'Exclude every prior validation date +/-20 common trading days. Monthly snapshots are fixed before outcome reading. A compared with bottom stock/equal-weight/random placebo. B favorable vs unfavorable realized MFE/MAE/return.'
 },null,2));
 const idx=I(await fm('TaiwanStockTotalReturnIndex','')),indexMap=new Map(idx.map((x,i)=>[x.date,i]));
 const data={},sets=[];
 for(const s of STOCKS){
  const [pr,rev,per,fin,bs,cf]=await Promise.all([
   fm('TaiwanStockPrice',s.code),fm('TaiwanStockMonthRevenue',s.code),fm('TaiwanStockPER',s.code),
   fm('TaiwanStockFinancialStatements',s.code),fm('TaiwanStockBalanceSheet',s.code),fm('TaiwanStockCashFlowsStatement',s.code)
  ]);
  data[s.code]={...s,p:P(pr),rev,per,fin,bs,cf};sets.push(new Set(data[s.code].p.map(x=>x.date)));
 }
 const common=[...sets[0]].filter(d=>sets.every(s=>s.has(d))).sort(),ex=excludeSet(common),snaps=monthlySnapshots(common,ex);
 const A=[],B=[];
 for(const date of snaps){
   const rows=[];
   for(const s of STOCKS){
     const d=data[s.code],i=nearestIndex(d.p,date);if(i<0||!d.p[i+252])continue;
     const f=fundamentals(d,date);if(!f)continue;
     const o63=outcome(d.p,i,63),o126=outcome(d.p,i,126),o252=outcome(d.p,i,252);
     if(!o63||!o126||!o252)continue;
     rows.push({code:s.code,name:s.name,date,score:f.score,perPct:f.val?.perPct??9,passed:f.passed,r63:o63.ret,r126:o126.ret,r252:o252.ret,dd252:maxDD(d.p,i,252),i});
   }
   if(rows.length<3)continue;
   rows.sort((a,b)=>b.score-a.score||a.perPct-b.perPct);
   const top=rows[0],bottom=rows[rows.length-1];
   A.push({date,top:top.code,topScore:top.score,bottom:bottom.code,bottomScore:bottom.score,top63:top.r63,top126:top.r126,top252:top.r252,bottom63:bottom.r63,bottom126:bottom.r126,bottom252:bottom.r252,
     all63:rows.map(x=>x.r63),all126:rows.map(x=>x.r126),all252:rows.map(x=>x.r252),eq63:mean(rows.map(x=>x.r63)),eq126:mean(rows.map(x=>x.r126)),eq252:mean(rows.map(x=>x.r252)),topDD252:top.dd252,bottomDD252:bottom.dd252});
   const d=data[top.code],b=bAnalogs(d,top.i,idx,indexMap),act=outcome(d.p,top.i,20);
   if(b&&act)B.push({date,code:top.code,...b,actualRet:act.ret,actualMFE:act.mfe,actualMAE:act.mae,actualRR:act.mfe/Math.max(.0001,Math.abs(act.mae))});
 }
 console.log('A_SNAPSHOTS',JSON.stringify({n:A.length,first:A[0]?.date,last:A[A.length-1]?.date,records:A.map(x=>({date:x.date,top:x.top,score:x.topScore,bottom:x.bottom}))}));
 const ares={n:A.length};
 for(const h of [63,126,252]){
   ares[h]={top:summarize(A,'top'+h),bottom:summarize(A,'bottom'+h),equal:summarize(A,'eq'+h),upliftVsBottom:mean(A.map(x=>x['top'+h]-x['bottom'+h])),upliftVsEqual:mean(A.map(x=>x['top'+h]-x['eq'+h]))};
 }
 ares.dd252={top:summarize(A,'topDD252'),bottom:summarize(A,'bottomDD252')};
 ares.placebo=placeboTop(A);
 console.log('A_RESULT',JSON.stringify(ares));
 console.log('B_CASES',JSON.stringify({n:B.length,records:B}));
 const fav=B.filter(x=>x.favorable),unfav=B.filter(x=>!x.favorable);
 console.log('B_RESULT',JSON.stringify({
   n:B.length,favorableN:fav.length,unfavorableN:unfav.length,
   favorable:{ret:summarize(fav,'actualRet'),mfe:summarize(fav,'actualMFE'),mae:summarize(fav,'actualMAE'),rr:summarize(fav,'actualRR')},
   unfavorable:{ret:summarize(unfav,'actualRet'),mfe:summarize(unfav,'actualMFE'),mae:summarize(unfav,'actualMAE'),rr:summarize(unfav,'actualRR')},
   uplift:{ret:mean(fav.map(x=>x.actualRet))-mean(unfav.map(x=>x.actualRet)),mfe:mean(fav.map(x=>x.actualMFE))-mean(unfav.map(x=>x.actualMFE)),mae:mean(fav.map(x=>x.actualMAE))-mean(unfav.map(x=>x.actualMAE))}
 }));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
