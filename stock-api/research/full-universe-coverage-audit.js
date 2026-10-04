
const API='https://api.finmindtrade.com/api/v4/data';
const START='2026-02-01',END='2026-09-24';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);if(!r.ok)throw Error('info '+r.status);return (await r.json()).data||[]}
async function fm(ds,id,start='2024-01-01',end=END){
 for(let a=0;a<3;a++){const u=new URL(API);u.searchParams.set('dataset',ds);u.searchParams.set('data_id',id);u.searchParams.set('start_date',start);u.searchParams.set('end_date',end);const r=await fetch(u);if(r.ok)return (await r.json()).data||[];await sleep(200*(a+1))}
 return[];
}
async function yahoo(code,type){
 const suf=type==='twse'?'.TW':'.TWO';
 const p1=Math.floor(Date.parse(START+'T00:00:00Z')/1000),p2=Math.floor(Date.parse('2026-09-26T00:00:00Z')/1000);
 const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suf+'?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';
 for(let a=0;a<3;a++){
  const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
  if(r.ok){const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],q=x?.indicators?.quote?.[0],adj=x?.indicators?.adjclose?.[0]?.adjclose||q?.close||[];
   return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),c:+adj[i]})).filter(z=>z.c>0)}
  await sleep(120*(a+1));
 }
 return[];
}
async function pool(items,limit,fn){const out=new Array(items.length);let idx=0;async function w(){while(true){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i])}catch(e){out[i]={error:String(e)}}}}await Promise.all(Array.from({length:limit},w));return out}
function revOk(rows){
 const a=rows.filter(x=>(x.create_time||x.date)<=END&&+x.revenue>0);
 const months=new Set(a.map(x=>x.revenue_year+'-'+x.revenue_month));
 return {rows:a.length,months:months.size,latest:a.sort((x,z)=>(x.create_time||x.date).localeCompare(z.create_time||z.date)).at(-1)?.create_time||null};
}
(async()=>{
 const raw=await info(),latest=new Map();
 for(const x of raw){
  if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;
  const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x);
 }
 const stocks=[...latest.values()];
 const px=await pool(stocks,24,async s=>{const p=await yahoo(s.stock_id,s.type);return {code:s.stock_id,name:s.stock_name,type:s.type,n:p.length,last:p.at(-1)?.date||null,mom:p.length>=126?p.at(-22).c/p.at(-127).c-1:null}});
 const good=px.filter(x=>x.n>=126&&x.last>='2026-09-23'&&Number.isFinite(x.mom)).sort((a,b)=>b.mom-a.mom);
 const bad=px.filter(x=>!(x.n>=126&&x.last>='2026-09-23'&&Number.isFinite(x.mom)));
 const cut=Math.ceil(good.length*.2),top=good.slice(0,cut);
 const rev=await pool(top,12,async x=>({code:x.code,...revOk(await fm('TaiwanStockMonthRevenue',x.code))}));
 const revGood=rev.filter(x=>x.months>=15&&x.latest&&x.latest>='2026-08-01');
 const revBad=rev.filter(x=>!(x.months>=15&&x.latest&&x.latest>='2026-08-01'));
 const byType={};
 for(const s of stocks){byType[s.type]=(byType[s.type]||0)+1}
 console.log('RESULT',JSON.stringify({
  asof:END,
  listedUniverse:stocks.length,
  byType,
  priceUsable:good.length,
  priceCoverage:good.length/stocks.length,
  priceUnusable:bad.length,
  mom20N:top.length,
  revenueUsableInMom20:revGood.length,
  revenueCoverageInMom20:revGood.length/top.length,
  revenueUnusableInMom20:revBad.length,
  samplePriceFailures:bad.slice(0,20),
  sampleRevenueFailures:revBad.slice(0,20)
 }));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
