const API='https://api.finmindtrade.com/api/v4/data';
async function q(dataset,id){
 const u=new URL(API);u.searchParams.set('dataset',dataset);u.searchParams.set('data_id',id);u.searchParams.set('start_date','2025-01-01');u.searchParams.set('end_date','2026-09-22');
 const r=await fetch(u); console.log('DATASET',dataset,'HTTP',r.status); const j=await r.json(); console.log(JSON.stringify((j.data||[]).slice(0,3),null,2));
}
(async()=>{for(const d of ['TaiwanStockMonthRevenue','TaiwanStockPER']){try{await q(d,'2330')}catch(e){console.error(d,e.message)}}})()