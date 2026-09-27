
(async()=>{
 const u='https://mops.twse.com.tw/mops/web/ajax_t05st01';
 const body=new URLSearchParams({
  encodeURIComponent:'1',step:'1',firstin:'1',off:'1',keyword4:'',code1:'',
  TYPEK:'all',co_id:'2301',year:'115',month:'09',begin_day:'01',end_day:'30'
 });
 const r=await fetch(u,{method:'POST',headers:{'User-Agent':'Mozilla/5.0','Content-Type':'application/x-www-form-urlencoded','Referer':'https://mops.twse.com.tw/mops/web/t05st01'},body});
 const t=await r.text();
 console.log('STATUS',r.status,'LEN',t.length);
 console.log(t.slice(0,5000).replace(/\s+/g,' '));
})().catch(e=>{console.error(e);process.exit(1)});
