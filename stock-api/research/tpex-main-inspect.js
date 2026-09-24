
(async()=>{
 for(const jsu of ['https://www.tpex.org.tw/rsrc/js/main.js','https://www.tpex.org.tw/rsrc/asset/js/main.js']){
  const r=await fetch(jsu,{headers:{'User-Agent':'Mozilla/5.0','Referer':'https://www.tpex.org.tw/zh-tw/mainboard/listed/delisted.html'}});const t=await r.text();
  const i=t.indexOf('API_PATTERN');console.log('MAIN',jsu,r.status,t.length,JSON.stringify(i>=0?t.slice(Math.max(0,i-1000),i+2500):t.slice(0,500)));
 }
})()
