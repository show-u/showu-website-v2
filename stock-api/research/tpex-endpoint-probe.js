
(async()=>{
 const urls=[
 'https://www.tpex.org.tw/web/api/company/deListed?l=zh-tw',
 'https://www.tpex.org.tw/api/company/deListed?l=zh-tw',
 'https://www.tpex.org.tw/www/api/company/deListed?l=zh-tw',
 'https://www.tpex.org.tw/zh-tw/api/company/deListed',
 'https://www.tpex.org.tw/web/regular_emerging/corporateInfo/stopSale/terminate_result.php?l=zh-tw',
 'https://www.tpex.org.tw/web/regular_emerging/corporateInfo/stopSale/terminate_result.php?l=zh-tw&stk_code=&year=&reason=-1'
 ];
 for(const u of urls){try{const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0','Referer':'https://www.tpex.org.tw/zh-tw/mainboard/listed/delisted.html'}});const t=await r.text();console.log('PROBE',r.status,u,t.length,JSON.stringify(t.slice(0,300)));}catch(e){console.log('ERR',u,e.message)}}
 const u=new URL('https://api.finmindtrade.com/api/v4/data');u.searchParams.set('dataset','TaiwanStockInfo');u.searchParams.set('start_date','2020-01-01');u.searchParams.set('end_date','2026-09-22');
 const r=await fetch(u);const j=await r.json();const rows=j.data||[];console.log('INFO',rows.length,JSON.stringify(rows.filter(x=>['2841','6452','2456','2823'].includes(x.stock_id)).slice(0,20)));
})()
