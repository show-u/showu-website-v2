
(async()=>{
 for(const u of [
  'https://mops.twse.com.tw/nas/t21/sii/t21sc03_115_8_0.html',
  'https://mops.twse.com.tw/nas/t21/otc/t21sc03_115_8_0.html',
  'https://mops.twse.com.tw/nas/t21/sii/t21sc03_109_6_0.html'
 ]){
   const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
   const t=await r.text();
   console.log('TEST',JSON.stringify({u,status:r.status,len:t.length,head:t.slice(0,500).replace(/\s+/g,' '),has2301:t.includes('2301')}));
 }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
