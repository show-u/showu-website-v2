
const fs=require('fs'),path=require('path'),cp=require('child_process');
const API='https://api.finmindtrade.com/api/v4/data';
const START='2020-01-01',END='2026-09-22',H=84,TARGET=160,SEED=20260927;
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);return (await r.json()).data||[]}
async function fm(ds,id){for(let a=0;a<3;a++){const u=new URL(API);u.searchParams.set('dataset',ds);u.searchParams.set('data_id',id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);const r=await fetch(u);if(r.ok)return (await r.json()).data||[];await sleep(250*(a+1))}return[]}
async function yahoo(code,type){const suf=type==='twse'?'.TW':'.TWO',p1=Math.floor(Date.parse(START+'T00:00:00Z')/1000),p2=Math.floor(Date.parse('2026-09-23T00:00:00Z')/1000);const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suf+'?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';for(let a=0;a<3;a++){const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(r.ok){const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],qq=x?.indicators?.quote?.[0],adj=x?.indicators?.adjclose?.[0]?.adjclose||qq?.close||[];return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),c:+adj[i]})).filter(z=>z.c>0)}await sleep(150*(a+1))}return[]}
async function pool(items,limit,fn){const out=new Array(items.length);let idx=0;async function w(){while(1){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i])}catch{out[i]=null}}}await Promise.all(Array.from({length:limit},w));return out}
function pct(vals){const s=vals.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),o=new Array(vals.length);for(let k=0;k<s.length;k++)o[s[k][1]]=k/(s.length-1||1);return o}
function revFeat(rows,date){const a=rows.filter(x=>(x.create_time||x.date)<=date&&+x.revenue>0).map(x=>({y:+x.revenue_year,m:+x.revenue_month,v:+x.revenue,ct:x.create_time||x.date})).sort((x,z)=>x.ct.localeCompare(z.ct));if(!a.length)return null;const cur=a.at(-1),get=(Y,M)=>a.find(x=>x.y===Y&&x.m===M)?.v??null,ys=[];for(let k=0;k<4;k++){let M=cur.m-k,Y=cur.y;while(M<=0){M+=12;Y--}const v=get(Y,M),py=get(Y-1,M);if(!(v>0&&py>0))return null;ys.push(v/py-1)}return{yoy:ys[0],accel:ys[0]-mean(ys.slice(1))}}
function perm(v,B=20000){let z=864209;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const obs=mean(v);let e=0;for(let b=0;b<B;b++)if(mean(v.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function boot(v,B=10000){let z=420986;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const a=[];for(let b=0;b<B;b++){const t=[];for(let i=0;i<v.length;i++)t.push(v[Math.floor(r()*v.length)]);a.push(mean(t))}return[q(a,.025),q(a,.975)]}
function priorCodes(){
 const set=new Set(), seenFiles=new Set();
 const commits=cp.execSync('git rev-list --all',{encoding:'utf8',maxBuffer:50*1024*1024}).trim().split(/\s+/).filter(Boolean);
 for(const commit of commits){
   let names='';
   try{names=cp.execSync('git ls-tree -r --name-only '+commit+' stock-api/research',{encoding:'utf8',maxBuffer:20*1024*1024})}catch{continue}
   for(const file of names.split(/\n/).filter(x=>x.endsWith('.js')&&!x.endsWith('clean-replication-mom6-revaccel.js'))){
     const key=commit+':'+file;if(seenFiles.has(key))continue;seenFiles.add(key);
     let txt='';try{txt=cp.execSync('git show '+commit+':'+file,{encoding:'utf8',maxBuffer:20*1024*1024})}catch{continue}
     for(const m of txt.matchAll(/["']([0-9]{4})["']/g))set.add(m[1]);
   }
 }
 return {set,commits:commits.length,files:seenFiles.size};
}
(async()=>{
 const hist=priorCodes(), excluded=hist.set;
 console.log('HISTORY_AUDIT',JSON.stringify({commits:hist.commits,historicalResearchFiles:hist.files,excludedCount:excluded.size}));
 console.log('PROTOCOL',JSON.stringify({goal:'clean independent replication',rules:'prelocked MOM6 top20 then revenue-acceleration top33',outcome:'future84 >=20%',dates:'non-overlapping 84 trading days',exclusion:'every 4-digit stock code appearing in any earlier research JS',excludedCount:excluded.size,success:'delta>0, p<0.05, bootstrap lower CI>0'}));
 const raw=await info(),latest=new Map();for(const x of raw){if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||excluded.has(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x)}
 const rr=rng(SEED),cand=[...latest.values()].sort(()=>rr()-.5).slice(0,700);
 const got=(await pool(cand,18,async s=>{const p=await yahoo(s.stock_id,s.type);if(p.length<900)return null;const rev=await fm('TaiwanStockMonthRevenue',s.stock_id);if(rev.length<36)return null;return{s,p,map:new Map(p.map((x,i)=>[x.date,i])),rev}})).filter(Boolean).slice(0,TARGET);
 console.log('LOCK',JSON.stringify({freshN:got.length,codes:got.map(x=>x.s.stock_id),overlap:[...got.map(x=>x.s.stock_id)].filter(x=>excluded.has(x))}));
 if(got.length<100)throw Error('insufficient fresh stocks');
 const cal=got[0].p.map(x=>x.date),dates=[];for(let i=300;i<cal.length-H;i+=84){const d=cal[i];if(d>='2021-08-01'&&d<='2026-01-31')dates.push(d)}console.log('DATES',JSON.stringify(dates));
 const dMom=[],dAccel=[],basePs=[],accPs=[],counts=[];
 const byDate=[];
 for(const date of dates){
   const rows=[];for(const d of got){const i=d.map.get(date);if(i==null||i<126||!d.p[i+H])continue;const rf=revFeat(d.rev,date);if(!rf)continue;rows.push({code:d.s.stock_id,mom:d.p[i-21].c/d.p[i-126].c-1,ret:d.p[i+H].c/d.p[i].c-1,...rf})}
   if(rows.length<90)continue;
   const mp=pct(rows.map(x=>x.mom));rows.forEach((x,i)=>x.mp=mp[i]);const universeP=mean(rows.map(x=>x.ret>=.2?1:0));const mom=rows.filter(x=>x.mp>=.8);if(mom.length<18)continue;
   const momP=mean(mom.map(x=>x.ret>=.2?1:0)),cut=q(mom.map(x=>x.accel),.67),acc=mom.filter(x=>x.accel>=cut),accP=mean(acc.map(x=>x.ret>=.2?1:0));
   dMom.push(momP-universeP);dAccel.push(accP-momP);basePs.push(momP);accPs.push(accP);counts.push(acc.length);
   byDate.push({date,n:rows.length,universePrecision:universeP,momN:mom.length,momPrecision:momP,accN:acc.length,accPrecision:accP,deltaMOMvsUniverse:momP-universeP,deltaAccelVsMOM:momP==null?null:accP-momP});
 }
 const result={
  mom6:{nDates:dMom.length,precision:mean(basePs),deltaVsUniverse:mean(dMom),positive:dMom.filter(x=>x>0).length/dMom.length,p:perm(dMom),ci:boot(dMom)},
  revAccel:{nDates:dAccel.length,avgN:mean(counts),precision:mean(accPs),deltaVsMOM20:mean(dAccel),positive:dAccel.filter(x=>x>0).length/dAccel.length,p:perm(dAccel),ci:boot(dAccel)},
  byDate
 };
 console.log('RESULT',JSON.stringify(result));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
