
const API='https://api.finmindtrade.com/api/v4/data';
const END='2026-09-24';
async function q(dataset,start,end){
 const u=new URL(API);u.searchParams.set('dataset',dataset);u.searchParams.set('start_date',start);u.searchParams.set('end_date',end);
 const r=await fetch(u);let j={};try{j=await r.json()}catch{};return {status:r.status,msg:j.msg||'',data:j.data||[]};
}
async function info(){
 const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);const j=await r.json();return j.data||[];
}
(async()=>{
 const raw=await info(), latest=new Map();
 for(const x of raw){
   if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創')) continue;
   const o=latest.get(x.stock_id); if(!o||x.date>o.date) latest.set(x.stock_id,x);
 }
 const universe=[...latest.values()], ids=new Set(universe.map(x=>x.stock_id));
 console.log('UNIVERSE',universe.length);
 const probes=[
  ['price126','TaiwanStockPrice','2026-03-01',END],
  ['revenue16m','TaiwanStockMonthRevenue','2025-01-01',END],
  ['financial2y','TaiwanStockFinancialStatements','2024-01-01',END],
  ['cashflow2y','TaiwanStockCashFlowsStatement','2024-01-01',END],
  ['per1y','TaiwanStockPER','2025-09-01',END],
  ['inst6m','TaiwanStockInstitutionalInvestorsBuySell','2026-03-01',END]
 ];
 const out={};
 for(const [key,ds,s,e] of probes){
   const r=await q(ds,s,e);
   const counts=new Map();
   for(const x of r.data){ if(ids.has(x.stock_id)) counts.set(x.stock_id,(counts.get(x.stock_id)||0)+1); }
   const nonzero=[...counts.values()];
   out[key]={dataset:ds,status:r.status,msg:r.msg,rows:r.data.length,covered:counts.size,coverage:counts.size/universe.length,
     min:nonzero.length?Math.min(...nonzero):0,median:nonzero.length?nonzero.sort((a,b)=>a-b)[Math.floor(nonzero.length/2)]:0,max:nonzero.length?Math.max(...nonzero):0};
   console.log('PROBE',key,JSON.stringify(out[key]));
 }
 // exact eligibility for current screen: price>=126 trading rows, revenue>=16 monthly rows, financial any, cashflow any, PER any, inst any
 // bulk queries may truncate, so if any row count suspiciously caps, report limitation.
 console.log('RESULT',JSON.stringify({universe:universe.length,probes:out}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
