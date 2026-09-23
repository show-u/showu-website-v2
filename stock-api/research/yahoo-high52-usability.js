
const START=Math.floor(new Date('2020-01-01T00:00:00Z').getTime()/1000);
const END=Math.floor(new Date('2026-09-23T00:00:00Z').getTime()/1000);
const HORIZONS=[21,63,126];
const STOCKS=[...new Set([
'2330','2454','2317','1301','1216','1101','1102','2409','2881','2888','2809','2603','2609','2614','2605',
'4938','2385','3596','3356','2328','3376','3532','3711','8021','6206','1605','6176','3583','3030','2404',
'1723','2543','2480','2606','8462','6005','8438','2495','6278','6257','8261','6531','1707','1608','6282',
'6285','6239','8131','2393','3708','1210','1304','2022','2062','1808','3209','2365','3515','2233','2109',
'3406','2324','1526','1905','1537','2354','2114','5521','2101','5258','4935','6117','5007','3557','6142',
'2426','2484','2419','2323','4104','2453','5469','5538','2476','3054','1701','2601','1441','1589','3454'
])];
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const sd=a=>{if(a.length<2)return null;const m=mean(a);return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1))}
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
async function yahoo(code){
 const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+'.TW?period1='+START+'&period2='+END+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';
 const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
 if(!r.ok)throw Error(code+' '+r.status);
 const j=await r.json(),x=j?.chart?.result?.[0];if(!x)throw Error(code+' noresult');
 const t=x.timestamp||[],adj=x.indicators?.adjclose?.[0]?.adjclose||[],cl=x.indicators?.quote?.[0]?.close||[];
 const a=[];for(let i=0;i<t.length;i++){const v=Number.isFinite(adj[i])?adj[i]:cl[i];if(Number.isFinite(v)&&v>0)a.push({date:new Date(t[i]*1000).toISOString().slice(0,10),close:v})}
 return a;
}
function idxByDate(p){return new Map(p.map((x,i)=>[x.date,i]))}
function high52(p,i){if(i<251)return null;return p[i].close/Math.max(...p.slice(i-251,i+1).map(x=>x.close))}
function mom6(p,i){if(i<126||i<21)return null;return p[i-21].close/p[i-126].close-1}
function ret(p,i,h){return p[i+h]?p[i+h].close/p[i].close-1:null}
function rank(vals){const idx=vals.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),r=new Array(vals.length);let k=0;while(k<idx.length){let j=k;while(j+1<idx.length&&idx[j+1][0]===idx[k][0])j++;const rr=(k+j)/2+1;for(let z=k;z<=j;z++)r[idx[z][1]]=rr;k=j+1}return r}
function corr(a,b){if(a.length<3)return null;const ma=mean(a),mb=mean(b),sa=Math.sqrt(a.reduce((s,x)=>s+(x-ma)**2,0)),sb=Math.sqrt(b.reduce((s,x)=>s+(x-mb)**2,0));if(!sa||!sb)return null;return a.reduce((s,x,i)=>s+(x-ma)*(b[i]-mb),0)/(sa*sb)}
function z(a){const m=mean(a),s=sd(a);return s?a.map(x=>(x-m)/s):a.map(()=>0)}
function residualBeta(rows){
 const H=z(rows.map(x=>x.h)),M=z(rows.map(x=>x.m)),Y=rows.map(x=>x.ret),b=corr(H,M),R=H.map((x,i)=>x-b*M[i]),mr=mean(R),my=mean(Y),den=R.reduce((s,x)=>s+(x-mr)**2,0),num=R.reduce((s,x,i)=>s+(x-mr)*(Y[i]-my),0);return den?num/den:null;
}
function ls(rows){
 const x=[...rows].sort((a,b)=>b.h-a.h),k=Math.max(5,Math.floor(x.length*.2)),T=x.slice(0,k),B=x.slice(-k),tr=T.map(x=>x.ret),br=B.map(x=>x.ret);
 return {spread:mean(tr)-mean(br),top:mean(tr),bottom:mean(br),tr,br};
}
function winsor(a,p=.1){const lo=q(a,p),hi=q(a,1-p);return a.map(x=>Math.max(lo,Math.min(hi,x)))}
function perm(vals,B=20000){let seed=20261005;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};const obs=mean(vals);let e=0;for(let b=0;b<B;b++)if(mean(vals.map(x=>rnd()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function boot(vals,B=10000){let seed=20261006;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};const v=[];for(let b=0;b<B;b++){const a=[];for(let i=0;i<vals.length;i++)a.push(vals[Math.floor(rnd()*vals.length)]);v.push(mean(a))}return[q(v,.025),q(v,.975)]}
(async()=>{
 const data={};
 for(const code of STOCKS){try{const p=await yahoo(code);if(p.length>700)data[code]={p,map:idxByDate(p)}}catch(e){console.log('SKIP',e.message)}await new Promise(r=>setTimeout(r,120))}
 const base=data['2330']?.p||Object.values(data)[0].p;
 const dates=[];for(let i=252;i<base.length-126;i+=63){const d=base[i].date;if(d>='2021-01-01'&&d<='2026-05-31')dates.push(d)}
 console.log('LOCK',JSON.stringify({nStocks:Object.keys(data).length,nDates:dates.length,dates}));
 const out={};
 for(const hzn of HORIZONS){
   const rec=[];
   for(const date of dates){const rows=[];for(const [code,d] of Object.entries(data)){const i=d.map.get(date);if(i==null)continue;const h=high52(d.p,i),m=mom6(d.p,i),r=ret(d.p,i,hzn);if([h,m,r].every(Number.isFinite))rows.push({code,h,m,ret:r})}if(rows.length<40)continue;const l=ls(rows);rec.push({date,n:rows.length,spread:l.spread,ic:corr(rank(rows.map(x=>x.h)),rank(rows.map(x=>x.ret))),resid:residualBeta(rows),w:mean(winsor(l.tr))-mean(winsor(l.br)),rmBest:mean([...l.tr].sort((a,b)=>a-b).slice(0,-1))-mean(l.br)})}
   const S=rec.map(x=>x.spread),IC=rec.map(x=>x.ic),R=rec.map(x=>x.resid),W=rec.map(x=>x.w),C=rec.map(x=>x.rmBest);
   const early=rec.filter(x=>x.date<'2024-01-01').map(x=>x.spread),late=rec.filter(x=>x.date>='2024-01-01').map(x=>x.spread);
   out[hzn]={n:rec.length,spread:{mean:mean(S),median:median(S),positive:S.filter(x=>x>0).length/S.length,p:perm(S),ci:boot(S)},IC:{mean:mean(IC),positive:IC.filter(x=>x>0).length/IC.length,ci:boot(IC)},residualVsMom6:{mean:mean(R),positive:R.filter(x=>x>0).length/R.length,ci:boot(R)},winsor:{mean:mean(W),p:perm(W),ci:boot(W)},removeBest:{mean:mean(C),p:perm(C),ci:boot(C)},early:{n:early.length,mean:mean(early),positive:early.filter(x=>x>0).length/early.length,ci:boot(early)},late:{n:late.length,mean:mean(late),positive:late.filter(x=>x>0).length/late.length,ci:boot(late)},byDate:rec}
 }
 
 // Detailed 63-day usability diagnostics: quintile monotonicity, top vs universe, tail sensitivity, leave-one-year-out.
 const hzn=63, rec=[];
 for(const date of dates){
   const rows=[];for(const [code,d] of Object.entries(data)){const i=d.map.get(date);if(i==null)continue;const h=high52(d.p,i),r=ret(d.p,i,hzn);if([h,r].every(Number.isFinite))rows.push({code,h,ret:r})}
   if(rows.length<40)continue;
   const x=[...rows].sort((a,b)=>a.h-b.h),n=x.length,qs=[];
   for(let k=0;k<5;k++){const a=Math.floor(k*n/5),b=Math.floor((k+1)*n/5);qs.push(mean(x.slice(a,b).map(z=>z.ret)))}
   const top=x.slice(Math.floor(4*n/5)),bot=x.slice(0,Math.floor(n/5)),univ=mean(x.map(z=>z.ret));
   const tr=top.map(z=>z.ret),br=bot.map(z=>z.ret);
   const cap=(arr,m)=>arr.map(v=>Math.max(-m,Math.min(m,v)));
   rec.push({date,qs,top:mean(tr),bottom:mean(br),univ,topVsUniv:mean(tr)-univ,medianSpread:median(tr)-median(br),
     cap30:mean(cap(tr,.30))-mean(cap(br,.30)),cap50:mean(cap(tr,.50))-mean(cap(br,.50)),
     rm1:mean([...tr].sort((a,b)=>a-b).slice(0,-1))-mean(br),rm2:mean([...tr].sort((a,b)=>a-b).slice(0,-2))-mean(br)});
 }
 const qavg=[0,1,2,3,4].map(k=>mean(rec.map(x=>x.qs[k]))),tv=rec.map(x=>x.topVsUniv),ms=rec.map(x=>x.medianSpread),c30=rec.map(x=>x.cap30),c50=rec.map(x=>x.cap50),r1=rec.map(x=>x.rm1),r2=rec.map(x=>x.rm2);
 const loo={};for(const y of ['2021','2022','2023','2024','2025']){const a=rec.filter(x=>!x.date.startsWith(y)).map(x=>x.top-x.bottom);loo[y]={n:a.length,mean:mean(a),positive:a.filter(v=>v>0).length/a.length,ci:boot(a)}}
 out.usability63={quintileMeans:qavg,monotone:qavg.every((v,i)=>i===0||v>=qavg[i-1]),topVsUniverse:{mean:mean(tv),positive:tv.filter(v=>v>0).length/tv.length,p:perm(tv),ci:boot(tv),after1pctCost:mean(tv)-.01},medianSpread:{mean:mean(ms),p:perm(ms),ci:boot(ms)},cap30:{mean:mean(c30),p:perm(c30),ci:boot(c30)},cap50:{mean:mean(c50),p:perm(c50),ci:boot(c50)},removeBest1:{mean:mean(r1),p:perm(r1),ci:boot(r1)},removeBest2:{mean:mean(r2),p:perm(r2),ci:boot(r2)},leaveOneYearOut:loo};
 console.log('RESULT',JSON.stringify(out));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
