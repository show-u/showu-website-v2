
const API='https://api.finmindtrade.com/api/v4/data';
(async()=>{
 for(const ds of ['TaiwanStockMonthRevenue','TaiwanStockFinancialStatements','TaiwanStockPrice']){
  const u=new URL(API);u.searchParams.set('dataset',ds);u.searchParams.set('start_date','2026-08-01');u.searchParams.set('end_date','2026-08-31');
  const r=await fetch(u);let t=await r.text();console.log('DS',ds,'STATUS',r.status,'LEN',t.length,'HEAD',t.slice(0,1000).replace(/\s+/g,' '));
 }
})().catch(e=>{console.error(e);process.exit(1)});
