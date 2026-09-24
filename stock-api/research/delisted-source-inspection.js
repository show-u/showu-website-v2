
(async()=>{
 const urls=[
  'https://www.twse.com.tw/rwd/zh/company/suspendListing?response=json',
  'https://www.tpex.org.tw/zh-tw/mainboard/listed/delisted.html'
 ];
 for(const u of urls){
  const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
  const t=await r.text();
  console.log('URL',u,'STATUS',r.status,'LEN',t.length);
  console.log(t.slice(0,5000).replace(/\n/g,' '));
  if(u.includes('tpex.org.tw')){
    const ms=[...t.matchAll(/(?:fetch|url|api|ajax|query|tables)[^"'<>]{0,180}/gi)].map(m=>m[0]);
    console.log('TPEX_HINTS',JSON.stringify(ms.slice(0,80)));
    const scripts=[...t.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]);
    console.log('TPEX_SCRIPTS',JSON.stringify(scripts));
    const z=t.indexOf('tables.init'); console.log('TPEX_INIT',z>=0?t.slice(Math.max(0,z-1200),z+2200):'none');
  }
 }
 for(const jsu of ['https://www.tpex.org.tw/rsrc/asset/js/global.js','https://www.tpex.org.tw/rsrc/js/tables.js']){const rr=await fetch(jsu,{headers:{'User-Agent':'Mozilla/5.0','Referer':'https://www.tpex.org.tw/zh-tw/mainboard/listed/delisted.html'}});const tt=await rr.text();console.log('JSURL',jsu,rr.status,tt.length);const m=tt.match(/API_PATTERN\s*=\s*[^;]+;/);console.log('APIPATTERN_MATCH',m?m[0]:'none');
 const mm=[...tt.matchAll(/company\/deListed[^"'\s)]*/g)].map(x=>x[0]);console.log('DELIST_MATCH',JSON.stringify(mm.slice(0,20)));}
 for(const code of ['2841','6452','2456','2823','1701','2443','2358','3682']){
  for(const sfx of ['.TW','.TWO']){
   const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+sfx+'?period1=1577836800&period2=1790208000&interval=1d&events=div%2Csplits&includeAdjustedClose=true';
   const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
   let ok=false,n=0,last=null;try{const j=await r.json(),x=j?.chart?.result?.[0];n=x?.timestamp?.length||0;last=n?new Date(x.timestamp[n-1]*1000).toISOString().slice(0,10):null;ok=!!x}catch{}
   console.log('YAHOO',code+sfx,r.status,ok,n,last);
  }
 }
})().catch(e=>{console.error(e);process.exit(1)});
