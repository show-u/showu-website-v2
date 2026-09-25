
const API='https://api.finmindtrade.com/api/v4/data';
async function fm(ds,id='2301'){
 const u=new URL(API);u.searchParams.set('dataset',ds);u.searchParams.set('data_id',id);u.searchParams.set('start_date','2026-01-01');u.searchParams.set('end_date','2026-09-22');
 const r=await fetch(u);let j={};try{j=await r.json()}catch{};console.log('DS',ds,r.status,j.msg||'',JSON.stringify((j.data||[]).slice(-5)));
}
(async()=>{
 for(const ds of ['TaiwanStockInstitutionalInvestorsBuySell','TaiwanStockMarginPurchaseShortSale','TaiwanStockPER','TaiwanStockMonthRevenue','TaiwanStockFinancialStatements','TaiwanStockCashFlowsStatement']) await fm(ds);
})().catch(e=>{console.error(e);process.exit(1)});
