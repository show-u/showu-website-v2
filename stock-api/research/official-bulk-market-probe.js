
(async()=>{
 const urls=[
  ['TWSE','https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=20260924&type=ALLBUT0999&response=json'],
  ['TPEx','https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes?date=2026/09/24&id=&response=json']
 ];
 for(const [name,u] of urls){
  const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
  const t=await r.text();
  console.log(name,'STATUS',r.status,'LEN',t.length,'HEAD',t.slice(0,500).replace(/\s+/g,' '));
 }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
