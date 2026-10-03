
const API='https://api.finmindtrade.com/api/v4/data';
const START='2026-02-01', END='2026-09-24';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);return (await r.json()).data||[]}
async function fmRev(id){
 for(let a=0;a<4;a++){
  const u=new URL(API);u.searchParams.set('dataset','TaiwanStockMonthRevenue');u.searchParams.set('data_id',id);u.searchParams.set('start_date','2024-01-01');u.searchParams.set('end_date',END);
  const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
  if(r.ok){const j=await r.json();return j.data||[]}
  await sleep(250*(a+1));
 }
 return[];
}
async function yahoo(code,type){
 const suf=type==='twse'?'.TW':'.TWO',p1=Math.floor(Date.parse(START+'T00:00:00Z')/1000),p2=Math.floor(Date.parse('2026-09-26T00:00:00Z')/1000);
 const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suf+'?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';
 for(let a=0;a<3;a++){const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(r.ok){const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],q=x?.indicators?.quote?.[0];if(!x||!q)return[];return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),c:+q.close?.[i]})).filter(z=>z.c>0)}await sleep(150*(a+1))}return[];
}
async function pool(items,limit,fn){const out=new Array(items.length);let idx=0;async function w(){while(1){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i])}catch{out[i]=null}}}await Promise.all(Array.from({length:limit},w));return out}
(async()=>{
 const raw=await info(),latest=new Map();
 for(const x of raw){if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||x.industry_category==='ETF'||(x.stock_name||'').includes('創'))continue;const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x)}
 const cand=[...latest.values()];
 const px=(await pool(cand,20,async s=>{const p=await yahoo(s.stock_id,s.type);return p.length>=126&&p.at(-1)?.date>='2026-09-23'?{code:s.stock_id,name:s.stock_name,type:s.type,n:p.length,last:p.at(-1).date}:null})).filter(Boolean);
 const rev=await pool(px,14,async s=>{const r=await fmRev(s.code);const last=r.at(-1);return{...s,rows:r.length,lastCreate:last?.create_time||last?.date||null,lastRevenueMonth:last?String(last.revenue_year)+'-'+String(last.revenue_month).padStart(2,'0'):null}});
 const withAny=rev.filter(x=>x.rows>0),enough15=rev.filter(x=>x.rows>=15),latestAug=rev.filter(x=>x.lastRevenueMonth==='2026-08'),freshAnnouncement=rev.filter(x=>x.lastCreate&&x.lastCreate>='2026-09-01');
 console.log('RESULT',JSON.stringify({
  asof:END,
  activePriceEligible:px.length,
  byMarket:{twse:px.filter(x=>x.type==='twse').length,tpex:px.filter(x=>x.type==='tpex').length},
  revenueCoverage:{tested:rev.length,any:withAny.length,rowsAtLeast15:enough15.length,latestMonth2026_08:latestAug.length,announcementSep2026:freshAnnouncement.length,empty:rev.filter(x=>!x.rows).length},
  staleOrMissing:rev.filter(x=>x.rows<15||x.lastRevenueMonth!=='2026-08').slice(0,80)
 }));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
