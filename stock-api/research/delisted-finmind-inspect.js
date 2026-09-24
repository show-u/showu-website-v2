
const API='https://api.finmindtrade.com/api/v4/data';
async function fm(code){
 const u=new URL(API);u.searchParams.set('dataset','TaiwanStockPrice');u.searchParams.set('data_id',code);u.searchParams.set('start_date','2020-01-01');u.searchParams.set('end_date','2026-09-22');
 const r=await fetch(u);const j=await r.json();return {status:r.status,data:j.data||[],msg:j.msg};
}
(async()=>{
 for(const code of ['2841','6452','2456','2823','1701','2443','2358','3682','8480','3383','6251','6172','1507','4725','2448','3698']){
  try{const x=await fm(code);console.log('FM',code,x.status,x.data.length,x.data[0]?.date,x.data.at(-1)?.date,x.msg||'');}catch(e){console.log('ERR',code,e.message)}
 }
})()
