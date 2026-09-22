const API='https://api.finmindtrade.com/api/v4/data';
async function q(dataset,id){
 const u=new URL(API);u.searchParams.set('dataset',dataset);u.searchParams.set('data_id',id);u.searchParams.set('start_date','2023-01-01');u.searchParams.set('end_date','2025-12-31');
 const r=await fetch(u);const j=await r.json();const rows=j.data||[];
 const types=[...new Set(rows.map(x=>x.type))];
 console.log(dataset,types.filter(x=>/Asset|Liab|Operating|Income|CashFlow|NetCash/i.test(x)).slice(0,100));
}
(async()=>{for(const d of ['TaiwanStockFinancialStatements','TaiwanStockBalanceSheet','TaiwanStockCashFlowsStatement'])await q(d,'4938')})()