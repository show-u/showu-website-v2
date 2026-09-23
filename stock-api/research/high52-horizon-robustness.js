
const START_TS=Math.floor(new Date('2020-01-01T00:00:00Z').getTime()/1000);
const END_TS=Math.floor(new Date('2026-09-23T00:00:00Z').getTime()/1000);
const STOCKS=["1104","1203","1225","1231","1234","1256","1307","1321","1341","1413","1414","1416","1417","1443","1466","1471","1531","1583","1590","1597","1614","2208","2228","2243","2247","2302","2303","2327","2332","2356","2368","2374","2383","2408","2417","2428","2466","2534","2613","2614","2633","2727","3518","3679","3701","4532","4583","5906","6416","6431","6581","6691","6706","8249","8454","8940","9136","9912","9926","9930"];
const DATES=["2021-03-19","2021-08-23","2022-01-10","2024-06-20","2026-01-23"];
const H=[21,42,63,84,126];
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
function rank(vals){const idx=vals.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),r=new Array(vals.length);let k=0;while(k<idx.length){let j=k;while(j+1<idx.length&&idx[j+1][0]===idx[k][0])j++;const rr=(k+j)/2+1;for(let z=k;z<=j;z++)r[idx[z][1]]=rr;k=j+1}return r}
function corr(a,b){if(a.length<3)return null;const ma=mean(a),mb=mean(b),sa=Math.sqrt(a.reduce((s,x)=>s+(x-ma)**2,0)),sb=Math.sqrt(b.reduce((s,x)=>s+(x-mb)**2,0));if(!sa||!sb)return null;return a.reduce((s,x,i)=>s+(x-ma)*(b[i]-mb),0)/(sa*sb)}
function winsor(a,p=.1){const lo=q(a,p),hi=q(a,1-p);return a.map(x=>Math.max(lo,Math.min(hi,x)))}
function perm(vals,B=20000){let seed=20261006;const r=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};const obs=mean(vals);let e=0;for(let b=0;b<B;b++)if(mean(vals.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function boot(vals,B=10000){let seed=20261007;const r=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};const v=[];for(let b=0;b<B;b++){const a=[];for(let i=0;i<vals.length;i++)a.push(vals[Math.floor(r()*vals.length)]);v.push(mean(a))}return[q(v,.025),q(v,.975)]}
async function yahoo(code){
 const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+'.TW?period1='+START_TS+'&period2='+END_TS+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';
 const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(!r.ok)throw Error(code+' '+r.status);
 const j=await r.json(),x=j?.chart?.result?.[0];if(!x)return [];
 const t=x.timestamp||[],adj=x.indicators?.adjclose?.[0]?.adjclose||[],cl=x.indicators?.quote?.[0]?.close||[],a=[];
 for(let i=0;i<t.length;i++){const v=Number.isFinite(adj[i])?adj[i]:cl[i];if(Number.isFinite(v)&&v>0)a.push({date:new Date(t[i]*1000).toISOString().slice(0,10),close:v})}
 return a;
}
function high52(p,i){if(i<251)return null;return p[i].close/Math.max(...p.slice(i-251,i+1).map(x=>x.close))}
(async()=>{
 console.log('PROTOCOL',JSON.stringify({sample:'locked fresh 60-stock confirmatory universe',dates:DATES,horizons:H,primaryQuestion:'whether HIGH52 effect persists across nearby holding horizons rather than only 63d',rule:'report all horizons; no winner-only conclusion; Holm-adjust permutation p across 5 horizons'}));
 const data={};for(const code of STOCKS){try{const p=await yahoo(code);data[code]={p,map:new Map(p.map((x,i)=>[x.date,i]))}}catch(e){} await new Promise(r=>setTimeout(r,80))}
 const res={};
 const pvals=[];
 for(const hzn of H){
   const rec=[];
   for(const date of DATES){
     const rows=[];
     for(const [code,d] of Object.entries(data)){
       const i=d.map.get(date);if(i==null||i<251||!d.p[i+hzn])continue;
       const h=high52(d.p,i),ret=d.p[i+hzn].close/d.p[i].close-1;if([h,ret].every(Number.isFinite))rows.push({code,h,ret});
     }
     if(rows.length<40)continue;
     const x=[...rows].sort((a,b)=>a.h-b.h),n=x.length,k=Math.floor(n/5),bot=x.slice(0,k),top=x.slice(n-k),tr=top.map(x=>x.ret),br=bot.map(x=>x.ret);
     rec.push({date,n,spread:mean(tr)-mean(br),medianSpread:median(tr)-median(br),winsor:mean(winsor(tr))-mean(winsor(br)),rmBest:mean([...tr].sort((a,b)=>a-b).slice(0,-1))-mean(br),ic:corr(rank(rows.map(x=>x.h)),rank(rows.map(x=>x.ret)))});
   }
   const S=rec.map(x=>x.spread),MS=rec.map(x=>x.medianSpread),W=rec.map(x=>x.winsor),RB=rec.map(x=>x.rmBest),IC=rec.map(x=>x.ic);
   const p=perm(S);pvals.push([hzn,p]);
   res[hzn]={n:rec.length,spread:{mean:mean(S),median:median(S),positive:S.filter(x=>x>0).length/S.length,p,ci:boot(S)},medianSpread:{mean:mean(MS),p:perm(MS),ci:boot(MS)},winsor:{mean:mean(W),p:perm(W),ci:boot(W)},removeBest:{mean:mean(RB),p:perm(RB),ci:boot(RB)},IC:{mean:mean(IC),positive:IC.filter(x=>x>0).length/IC.length,ci:boot(IC)},byDate:rec};
 }
 // Holm adjustment
 const ord=[...pvals].sort((a,b)=>a[1]-b[1]);let prev=0;
 for(let i=0;i<ord.length;i++){const [h,p]=ord[i],adj=Math.max(prev,Math.min(1,p*(ord.length-i)));res[h].holmP=adj;prev=adj}
 console.log('RESULT',JSON.stringify(res));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
