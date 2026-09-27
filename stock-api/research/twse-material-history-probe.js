
(async()=>{
 const sw=await (await fetch('https://openapi.twse.com.tw/v1/swagger.json')).json();
 const op=sw.paths?.['/opendata/t187ap04_L'];
 console.log('SCHEMA',JSON.stringify(op));
 for(const u of [
  'https://openapi.twse.com.tw/v1/opendata/t187ap04_L',
  'https://openapi.twse.com.tw/v1/opendata/t187ap04_L?date=20250925',
  'https://openapi.twse.com.tw/v1/opendata/t187ap04_L?Date=20250925',
  'https://openapi.twse.com.tw/v1/opendata/t187ap04_L?startDate=20250925&endDate=20250925'
 ]){
  const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
  const j=await r.json();
  console.log('CALL',u,'N',Array.isArray(j)?j.length:'NA','FIRST',JSON.stringify(Array.isArray(j)?j.slice(0,2):j).slice(0,1500));
 }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
