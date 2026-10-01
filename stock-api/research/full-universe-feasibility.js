
const API='https://api.finmindtrade.com/api/v4/data';
async function call(params){
  const u=new URL(API);for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
  const t=Date.now();const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
  const txt=await r.text();let j;try{j=JSON.parse(txt)}catch{j={raw:txt.slice(0,300)}}
  return {status:r.status,ms:Date.now()-t,data:j.data||[],msg:j.msg||'',raw:j.raw||''};
}
(async()=>{
  const tests=[];
  tests.push(['info',await call({dataset:'TaiwanStockInfo'})]);
  tests.push(['price_day_all',await call({dataset:'TaiwanStockPrice',start_date:'2026-09-24',end_date:'2026-09-24'})]);
  tests.push(['price_month_all',await call({dataset:'TaiwanStockPrice',start_date:'2026-09-01',end_date:'2026-09-24'})]);
  tests.push(['rev_month_all',await call({dataset:'TaiwanStockMonthRevenue',start_date:'2026-08-01',end_date:'2026-09-24'})]);
  for(const [name,x] of tests){
    const ids=[...new Set(x.data.map(z=>z.stock_id).filter(Boolean))];
    console.log('TEST',JSON.stringify({name,status:x.status,ms:x.ms,rows:x.data.length,stocks:ids.length,msg:x.msg,first:x.data.slice(0,2),last:x.data.slice(-2)}));
  }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
