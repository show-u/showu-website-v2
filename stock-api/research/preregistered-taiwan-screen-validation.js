
const fs=require('fs'),cp=require('child_process');
const API='https://api.finmindtrade.com/api/v4/data';
const START='2020-01-01',END='2026-09-25',H=84;
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function priorCodes(){
 const out=new Set();
 let files=[];
 try{files=cp.execSync("find stock-api/research -type f -name '*.js' ! -name 'preregistered-taiwan-screen-validation.js'",{encoding:'utf8'}).trim().split(/\n+/).filter(Boolean)}catch{}
 for(const f of files){
   const t=fs.readFileSync(f,'utf8');
   for(const m of t.matchAll(/['"\[](\d{4})['"\]]/g)) out.add(m[1]);
 }
 return out;
}
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);if(!r.ok)throw Error('stockinfo '+r.status);return (await r.json()).data||[]}
async function fm(ds,id,start='2019-01-01',end=END){
 for(let a=0;a<4;a++){
  const u=new URL(API);u.searchParams.set('dataset',ds);u.searchParams.set('data_id',id);u.searchParams.set('start_date',start);u.searchParams.set('end_date',end);
  const r=await fetch(u);if(r.ok)return (await r.json()).data||[];
  await sleep(250*(a+1));
 } return [];
}
async function yahoo(code,type){
 const suf=type==='twse'?'.TW':'.TWO',p1=Math.floor(Date.parse(START+'T00:00:00Z')/1000),p2=Math.floor(Date.parse('2026-09-27T00:00:00Z')/1000);
 const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suf+'?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';
 for(let a=0;a<4;a++){
  const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
  if(r.ok){const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],qq=x?.indicators?.quote?.[0],adj=x?.indicators?.adjclose?.[0]?.adjclose||qq?.close||[];
   return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),c:+adj[i],raw:+qq.close?.[i]})).filter(z=>z.c>0)}
  await sleep(180*(a+1));
 } return [];
}
async function pool(items,limit,fn){const out=new Array(items.length);let idx=0;async function w(){while(1){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i])}catch(e){out[i]=null}}}await Promise.all(Array.from({length:limit},w));return out}
function percentile(vals){
 const s=vals.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),o=new Array(vals.length);
 for(let k=0;k<s.length;k++)o[s[k][1]]=k/(s.length-1||1);return o;
}
function revFeat(rows,date){
 const a=rows.filter(x=>(x.create_time||x.date)<=date&&+x.revenue>0).map(x=>({y:+x.revenue_year,m:+x.revenue_month,v:+x.revenue,ct:x.create_time||x.date})).sort((x,z)=>x.ct.localeCompare(z.ct));
 if(a.length<16)return null;
 const cur=a.at(-1),get=(Y,M)=>a.find(x=>x.y===Y&&x.m===M)?.v??null,ys=[];
 for(let k=0;k<15;k++){let M=cur.m-k,Y=cur.y;while(M<=0){M+=12;Y--}const v=get(Y,M),py=get(Y-1,M);if(!(v>0&&py>0))return null;ys.push(v/py-1)}
 const latest=ys[0],prior12=ys.slice(1,13);
 return {revYoY:latest,revSurprise:latest-mean(prior12),revPersist:Math.min(...ys.slice(0,3)),revMonth:cur.y+'-'+String(cur.m).padStart(2,'0')};
}
function perm(v,B=30000){if(!v.length)return null;let z=713579;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const obs=mean(v);let e=0;for(let b=0;b<B;b++)if(mean(v.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function boot(v,B=15000){if(!v.length)return null;let z=975317;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const a=[];for(let b=0;b<B;b++){const t=[];for(let i=0;i<v.length;i++)t.push(v[Math.floor(r()*v.length)]);a.push(mean(t))}return[q(a,.025),q(a,.975)]}
function stats(perDate,key,baseKey){
 const del=[],prec=[],ret=[],med=[],ns=[];
 for(const d of perDate){const g=d[key],b=d[baseKey];if(!g||!b||g.n<1)continue;del.push(g.prec-b.prec);prec.push(g.prec);ret.push(g.meanRet);med.push(g.medRet);ns.push(g.n)}
 return {nDates:del.length,avgN:mean(ns),precision:mean(prec),meanReturn:mean(ret),medianReturn:mean(med),liftVsBase:mean(del),positiveDates:del.filter(x=>x>0).length+'/'+del.length,p:perm(del),ci:boot(del)};
}
function group(rows,frac,scoreKey){
 const sorted=[...rows].sort((a,b)=>b[scoreKey]-a[scoreKey]),n=Math.max(1,Math.ceil(rows.length*frac));return sorted.slice(0,n);
}
function met(g,thr=.2){const w=g.map(x=>x.ret>=thr?1:0);return{n:g.length,prec:mean(w),meanRet:mean(g.map(x=>x.ret)),medRet:median(g.map(x=>x.ret))}}
(async()=>{
 console.log('PREREG',JSON.stringify({
  objective:'Taiwan stock screening with fixed, falsifiable two-stage method',
  evidenceBasis:'price momentum + unexpected monthly revenue + revenue persistence',
  outcomePrimary:'future 84 trading-day return >=20%',
  dates:'non-overlapping 84-trading-day cohorts',
  stage1:'average percentile of MOM6 and revenueSurprise; take top 2.5%',
  stage2:'average percentile of MOM6, revenueSurprise, revenuePersistence; take top 0.5%',
  successStage1:'lift vs universe >0, permutation p<0.05, bootstrap 95% CI lower>0',
  successStage2:'lift vs stage1 >0, permutation p<0.05, bootstrap 95% CI lower>0',
  noPostHocTuning:true
 }));
 const used=priorCodes();
 const raw=await info(),latest=new Map();
 for(const x of raw){
  if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||used.has(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;
  const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x);
 }
 const eligible=[...latest.values()];
 console.log('EXCLUSION',JSON.stringify({priorCodes:used.size,currentEligibleAfterExclusion:eligible.length}));
 const fetched=(await pool(eligible,18,async s=>{
  const p=await yahoo(s.stock_id,s.type);if(p.length<900)return null;
  const rev=await fm('TaiwanStockMonthRevenue',s.stock_id);if(rev.length<40)return null;
  return{s,p,map:new Map(p.map((x,i)=>[x.date,i])),rev};
 })).filter(Boolean);
 const overlap=fetched.filter(x=>used.has(x.s.stock_id)).map(x=>x.s.stock_id);
 console.log('LOCK',JSON.stringify({freshN:fetched.length,overlapWithPrior:overlap.length,overlapCodes:overlap,codes:fetched.map(x=>x.s.stock_id)}));
 if(fetched.length<250)throw Error('fresh sample too small');
 const cal=fetched[0].p.map(x=>x.date),dates=[];for(let i=300;i<cal.length-H;i+=84){const d=cal[i];if(d>='2021-08-01'&&d<='2026-01-31')dates.push(d)}
 console.log('DATES',JSON.stringify(dates));
 const perDate=[];
 for(const date of dates){
  const rows=[];
  for(const d of fetched){
   const i=d.map.get(date);if(i==null||i<126||!d.p[i+H])continue;
   const rf=revFeat(d.rev,date);if(!rf)continue;
   rows.push({code:d.s.stock_id,name:d.s.stock_name,industry:d.s.industry_category,mom6:d.p[i-21].c/d.p[i-126].c-1,ret:d.p[i+H].c/d.p[i].c-1,...rf});
  }
  if(rows.length<200)continue;
  const pm=percentile(rows.map(x=>x.mom6)),pr=percentile(rows.map(x=>x.revSurprise)),pp=percentile(rows.map(x=>x.revPersist));
  rows.forEach((x,i)=>{x.momPct=pm[i];x.revSPct=pr[i];x.persistPct=pp[i];x.stage1=(pm[i]+pr[i])/2;x.stage2=(pm[i]+pr[i]+pp[i])/3});
  const universe=rows,mom20=group(rows,.20,'momPct'),stage1=group(rows,.025,'stage1'),stage2=group(rows,.005,'stage2');
  perDate.push({date,n:rows.length,universe:met(universe),mom20:met(mom20),stage1:met(stage1),stage2:met(stage2),
    stage1_30:met(stage1,.3),stage2_30:met(stage2,.3),stage1_50:met(stage1,.5),stage2_50:met(stage2,.5)});
 }
 const result={
  sample:{freshN:fetched.length,overlapWithPrior:overlap.length,dates:perDate.map(x=>x.date)},
  primary:{
   mom20_vs_universe:stats(perDate,'mom20','universe'),
   stage1_vs_universe:stats(perDate,'stage1','universe'),
   stage2_vs_stage1:stats(perDate,'stage2','stage1')
  },
  sensitivity:{
   stage1_30_vs_universe:stats(perDate,'stage1_30','universe'),
   stage2_30_vs_stage1:stats(perDate,'stage2_30','stage1_30'),
   stage1_50_vs_universe:stats(perDate,'stage1_50','universe'),
   stage2_50_vs_stage1:stats(perDate,'stage2_50','stage1_50')
  },
  perDate
 };
 result.pass={
  stage1:result.primary.stage1_vs_universe.liftVsBase>0&&result.primary.stage1_vs_universe.p<.05&&result.primary.stage1_vs_universe.ci[0]>0,
  stage2:result.primary.stage2_vs_stage1.liftVsBase>0&&result.primary.stage2_vs_stage1.p<.05&&result.primary.stage2_vs_stage1.ci[0]>0
 };
 console.log('RESULT',JSON.stringify(result));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
