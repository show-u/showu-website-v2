
(async()=>{
 const API='https://api.finmindtrade.com/api/v4/data';
 for(const ds of ['TaiwanStockCashFlowsStatement','TaiwanStockCashFlowsStatements','TaiwanStockCashFlow']){
  const u=new URL(API);u.searchParams.set('dataset',ds);u.searchParams.set('data_id','2347');u.searchParams.set('start_date','2024-01-01');u.searchParams.set('end_date','2026-09-22');
  const r=await fetch(u);let j={};try{j=await r.json()}catch{};console.log('DS',ds,r.status,JSON.stringify((j.data||[]).slice(-20)),j.msg||'');
 }
})()
