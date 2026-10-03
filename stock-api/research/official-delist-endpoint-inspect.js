
(async()=>{
 for(const u of [
  'https://www.twse.com.tw/rwd/zh/company/suspendListing?response=json',
  'https://www.tpex.org.tw/www/zh-tw/company/deListed?code=&date=2024&reason=-1',
  'https://www.tpex.org.tw/zh-tw/mainboard/listed/delisted.html'
 ]){
  try{
    const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json,text/html,*/*'}});
    const t=await r.text();
    console.log('URL',u,'STATUS',r.status,'TYPE',r.headers.get('content-type'),'LEN',t.length);
    console.log('BODY',t.slice(0,2500).replace(/\s+/g,' '));
  }catch(e){console.log('ERR',u,String(e))}
 }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
