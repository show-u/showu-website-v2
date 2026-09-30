
const API='https://api.finmindtrade.com/api/v4/data';
const START='2019-01-02',END='2026-09-24';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);if(!r.ok)throw Error('info '+r.status);return (await r.json()).data||[]}
async function yahoo(code,type){const suf=type==='twse'?'.TW':'.TWO',p1=Math.floor(Date.parse(START+'T00:00:00Z')/1000),p2=Math.floor(Date.parse('2026-09-26T00:00:00Z')/1000);const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suf+'?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';for(let a=0;a<3;a++){const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(r.ok){const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],qq=x?.indicators?.quote?.[0],adj=x?.indicators?.adjclose?.[0]?.adjclose||qq?.close||[];return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),c:+adj[i]})).filter(z=>z.c>0)}await sleep(150*(a+1))}return[]}
async function fm(ds,id,start='2019-01-01',end=END){for(let a=0;a<3;a++){const u=new URL(API);u.searchParams.set('dataset',ds);u.searchParams.set('data_id',id);u.searchParams.set('start_date',start);u.searchParams.set('end_date',end);const r=await fetch(u);if(r.ok)return (await r.json()).data||[];await sleep(200*(a+1))}return[]}
async function pool(items,limit,fn){const out=new Array(items.length);let idx=0;async function w(){while(true){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i])}catch{out[i]=null}}await Promise.all(Array.from({length:limit},w));return out}
function revFeat(rows){const a=rows.filter(x=>(x.create_time||x.date)<=END&&+x.revenue>0).map(x=>({y:+x.revenue_year,m:+x.revenue_month,v:+x.revenue,ct:x.create_time||x.date})).sort((x,z)=>x.ct.localeCompare(z.ct));if(a.length<16)return null;const cur=a.at(-1),get=(Y,M)=>a.find(x=>x.y===Y&&x.m===M)?.v??null,ys=[];for(let k=0;k<4;k++){let M=cur.m-k,Y=cur.y;while(M<=0){M+=12;Y--}const v=get(Y,M),py=get(Y-1,M);if(!(v>0&&py>0))return null;ys.push(v/py-1)}return{latestMonth:cur.y+'-'+String(cur.m).padStart(2,'0'),yoy:ys[0],accel:ys[0]-(ys[1]+ys[2]+ys[3])/3,rows:a.length}}
(async()=>{
 const raw=await info(),latest=new Map();for(const x of raw){if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x)}
 const universe=[...latest.values()];
 const fetched=await pool(universe,20,async s=>{const p=await yahoo(s.stock_id,s.type);if(p.length<126)return{ok:false,code:s.stock_id};const i=p.length-1;return{ok:true,code:s.stock_id,name:s.stock_name,type:s.type,industry:s.industry_category,rows:p.length,first:p[0].date,last:p[i].date,mom6:p[i-21].c/p[i-126].c-1}});
 const px=fetched.filter(x=>x?.ok).sort((a,b)=>b.mom6-a.mom6),missing=fetched.filter(x=>!x?.ok).length;
 px.forEach((x,i)=>x.rank=i+1);const top20=px.slice(0,Math.ceil(px.length*.2));
 const revFetched=await pool(top20,14,async x=>{const rows=await fm('TaiwanStockMonthRevenue',x.code,'2019-01-01',END);const r=revFeat(rows);return r?{...x,...r}:null});
 const rev=revFetched.filter(Boolean).sort((a,b)=>b.accel-a.accel);rev.forEach((x,i)=>x.accelRank=i+1);
 const top33=rev.slice(0,Math.ceil(rev.length/3));
 console.log('RESULT',JSON.stringify({
   asof:END,
   universeFromStockInfo:universe.length,
   priceUsable:px.length,
   priceMissingOrTooShort:missing,
   priceCoverage:universe.length?px.length/universe.length:null,
   top20N:top20.length,
   top20RevenueUsable:rev.length,
   revenueCoverageWithinTop20:top20.length?rev.length/top20.length:null,
   top33RevenueAccelN:top33.length,
   priceRowStats:{min:Math.min(...px.map(x=>x.rows)),median:px.map(x=>x.rows).sort((a,b)=>a-b)[Math.floor(px.length/2)],max:Math.max(...px.map(x=>x.rows))},
   sampleTop10:top33.slice(0,10).map(x=>({code:x.code,name:x.name,momRank:x.rank,mom6:x.mom6,revMonth:x.latestMonth,revYoY:x.yoy,revAccel:x.accel,revRows:x.rows}))
 }));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
