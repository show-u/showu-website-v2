
const API='https://api.finmindtrade.com/api/v4/data';
async function call(dataset,start,end){
 const u=new URL(API);u.searchParams.set('dataset',dataset);u.searchParams.set('start_date',start);u.searchParams.set('end_date',end);
 const r=await fetch(u);let j={};try{j=await r.json()}catch{}
 console.log('DS',dataset,'STATUS',r.status,'MSG',j.msg||'','N',Array.isArray(j.data)?j.data.length:null,'FIRST',JSON.stringify((j.data||[]).slice(0,3)));
}
(async()=>{
 await call('TaiwanStockPrice','2026-09-24','2026-09-24');
 await call('TaiwanStockMonthRevenue','2026-08-01','2026-08-31');
 await call('TaiwanStockPER','2026-09-24','2026-09-24');
 await call('TaiwanStockInstitutionalInvestorsBuySell','2026-09-24','2026-09-24');
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
