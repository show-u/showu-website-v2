
const API='https://api.finmindtrade.com/api/v4/data';
async function fm(dataset,id){
 const u=new URL(API);u.searchParams.set('dataset',dataset);u.searchParams.set('data_id',id);u.searchParams.set('start_date','2023-01-01');u.searchParams.set('end_date','2026-09-22');
 const r=await fetch(u);const j=await r.json();return j.data||[];
}
(async()=>{
 for(const code of ['1587','1702','2347']){
  const [fin,rev,px]=await Promise.all([fm('TaiwanStockFinancialStatements',code),fm('TaiwanStockMonthRevenue',code),fm('TaiwanStockPrice',code)]);
  console.log('CODE',code);
  console.log('FIN_TYPES',JSON.stringify([...new Set(fin.map(x=>x.type))]));
  console.log('FIN_SAMPLE',JSON.stringify(fin.slice(-30)));
  console.log('REV_SAMPLE',JSON.stringify(rev.slice(-5)));
  console.log('PX_SAMPLE',JSON.stringify(px.slice(-3)));
 }
})().catch(e=>{console.error(e);process.exit(1)});
