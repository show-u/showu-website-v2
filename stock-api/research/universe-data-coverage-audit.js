
const API='https://api.finmindtrade.com/api/v4/data';
const START='2026-02-01',END='2026-09-25';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);return (await r.json()).data||[]}
async function fm(ds,id,start='2024-01-01',end=END){for(let a=0;a<3;a++){const u=new URL(API);u.searchParams.set('dataset',ds);u.searchParams.set('data_id',id);u.searchParams.set('start_date',start);u.searchParams.set('end_date',end);const r=await fetch(u);if(r.ok)return (await r.json()).data||[];await sleep(200*(a+1))}return[]}
async function yahoo(code,type){
 const suf=type==='twse'?'.TW':'.TWO',p1=Math.floor(Date.parse(START+'T00:00:00Z')/1000),p2=Math.floor(Date.parse('2026-09-27T00:00:00Z')/1000);
 const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suf+'?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';
 for(let a=0;a<3;a++){const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(r.ok){const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],qq=x?.indicators?.quote?.[0],adj=x?.indicators?.adjclose?.[0]?.adjclose||qq?.close||[];return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),c:+adj[i]})).filter(z=>z.c>0)}await sleep(150*(a+1))}return[]
}
async function pool(items,limit,fn){const out=new Array(items.length);let idx=0;async function w(){while(1){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i])}catch{out[i]=null}}}await Promise.all(Array.from({length:limit},w));return out}
function revUsable(rows){
 const a=rows.filter(x=>(x.create_time||x.date)<=END&&+x.revenue>0).map(x=>({y:+x.revenue_year,m:+x.revenue_month,v:+x.revenue,ct:x.create_time||x.date})).sort((x,z)=>x.ct.localeCompare(z.ct));
 if(!a.length)return false;const cur=a.at(-1),get=(Y,M)=>a.find(x=>x.y===Y&&x.m===M)?.v??null;
 for(let k=0;k<4;k++){let M=cur.m-k,Y=cur.y;while(M<=0){M+=12;Y--}const v=get(Y,M),py=get(Y-1,M);if(!(v>0&&py>0))return false}
 return true;
}
(async()=>{
 const raw=await info(),latest=new Map();
 for(const x of raw){
   if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;
   const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x);
 }
 const stocks=[...latest.values()];
 const px=(await pool(stocks,20,async s=>{const p=await yahoo(s.stock_id,s.type);if(p.length<126)return null;const i=p.length-1;return{code:s.stock_id,name:s.stock_name,type:s.type,industry:s.industry_category,mom6:p[i-21].c/p[i-126].c-1}})).filter(Boolean).sort((a,b)=>b.mom6-a.mom6);
 const n=px.length,cut=Math.ceil(n*.2),m20=px.slice(0,cut);
 const revChecks=await pool(m20,14,async x=>({code:x.code,usable:revUsable(await fm('TaiwanStockMonthRevenue',x.code))}));
 const usable=revChecks.filter(x=>x&&x.usable),missing=revChecks.filter(x=>x&&!x.usable).map(x=>x.code);
 console.log('RESULT',JSON.stringify({
   listedUniverse:stocks.length,
   priceUsable126:n,
   priceCoverage:n/stocks.length,
   mom20N:m20.length,
   revenueAccelUsable:usable.length,
   revenueCoverageWithinMom20:usable.length/m20.length,
   revenueMissingCount:missing.length,
   revenueMissingCodes:missing
 }));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
