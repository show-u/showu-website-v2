
(async()=>{
 for(const code of ['2059','2301','3006']){
  const u='https://finmoconf.diveinvest.net/company/'+code;
  const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
  const t=await r.text();
  console.log('CODE',code,'STATUS',r.status,'LEN',t.length);
  const urls=[...t.matchAll(/href="([^"]+)"/g)].map(m=>m[1]).filter(x=>/presentation|pdf/i.test(x));
  console.log('LINKS',JSON.stringify(urls.slice(0,30)));
  const dates=[...t.matchAll(/20\d{2}[\/-]\d{1,2}[\/-]\d{1,2}/g)].map(m=>m[0]);
  console.log('DATES',JSON.stringify([...new Set(dates)].slice(0,30)));
 }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
