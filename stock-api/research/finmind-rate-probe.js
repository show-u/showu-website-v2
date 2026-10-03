
const API='https://api.finmindtrade.com/api/v4/data';
(async()=>{
 for(const id of ['6654','6669','6732','2301','2059']){
  const u=new URL(API);u.searchParams.set('dataset','TaiwanStockMonthRevenue');u.searchParams.set('data_id',id);u.searchParams.set('start_date','2024-01-01');u.searchParams.set('end_date','2026-09-24');
  const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
  const t=await r.text();let j={};try{j=JSON.parse(t)}catch{}
  console.log('PROBE',id,'status',r.status,'msg',j.msg||'','rows',(j.data||[]).length,'last',JSON.stringify((j.data||[]).at(-1)||null));
 }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
