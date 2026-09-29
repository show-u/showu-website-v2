
(async()=>{
 for(const market of ['sii','otc']){
  for(const [y,m] of [[114,8],[115,8]]){
   const urls=[
    'https://mopsov.twse.com.tw/nas/t21/'+market+'/t21sc03_'+y+'_'+m+'.csv',
    'https://mopsov.twse.com.tw/nas/t21/'+market+'/t21sc03_'+y+'_'+m+'_0.csv'
   ];
   for(const u of urls){
    const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
    const b=await r.arrayBuffer();const t=new TextDecoder('utf-8').decode(b);
    console.log('CALL',market,y,m,u,'STATUS',r.status,'LEN',b.byteLength,'HEAD',t.slice(0,500).replace(/\s+/g,' '));
   }
  }
 }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
