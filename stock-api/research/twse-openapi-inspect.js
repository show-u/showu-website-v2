
(async()=>{
 const r=await fetch('https://openapi.twse.com.tw/v1/swagger.json',{headers:{'User-Agent':'Mozilla/5.0'}});
 const j=await r.json();
 const out=[];
 for(const [p,v] of Object.entries(j.paths||{})){
  const s=JSON.stringify(v);
  if(/重大訊息|法說|法人說明|公開說明|財測|月營收|重大資訊|material|conference/i.test(s)){
    out.push({path:p,summary:Object.values(v).map(x=>x.summary||x.description||'').filter(Boolean)});
  }
 }
 console.log('RESULT',JSON.stringify(out));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
