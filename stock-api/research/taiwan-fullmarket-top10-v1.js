
const API='https://api.finmindtrade.com/api/v4/data';
const START_PRICE='2025-09-01', ASOF='2026-09-24';
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const sd=a=>{if(a.length<2)return null;const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)))};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function info(){
 const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');
 const r=await fetch(u);if(!r.ok)throw Error('info '+r.status);return (await r.json()).data||[];
}
async function fm(ds,id,start='2024-01-01',end=ASOF){
 for(let a=0;a<4;a++){const u=new URL(API);u.searchParams.set('dataset',ds);u.searchParams.set('data_id',id);u.searchParams.set('start_date',start);u.searchParams.set('end_date',end);
 const r=await fetch(u);if(r.ok)return (await r.json()).data||[];await sleep(200*(a+1));}return[];
}
async function yahoo(code,type){
 const suf=type==='twse'?'.TW':'.TWO',p1=Math.floor(Date.parse(START_PRICE+'T00:00:00Z')/1000),p2=Math.floor(Date.parse('2026-09-25T00:00:00Z')/1000);
 const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suf+'?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';
 for(let a=0;a<3;a++){const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(r.ok){const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],q=x?.indicators?.quote?.[0],adj=x?.indicators?.adjclose?.[0]?.adjclose||q?.close||[];
   return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),c:+adj[i],v:+q.volume?.[i]||0,raw:+q.close?.[i]})).filter(z=>z.c>0)}
  await sleep(150*(a+1));}
 return [];
}
async function pool(items,limit,fn){const out=new Array(items.length);let idx=0;async function w(){while(1){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i])}catch{out[i]=null}}}await Promise.all(Array.from({length:limit},w));return out}
function percentile(vals){const s=vals.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),o=new Array(vals.length);for(let k=0;k<s.length;k++)o[s[k][1]]=k/(s.length-1||1);return o}
function revFeat(rows){
 const a=rows.filter(x=>(x.create_time||x.date)<=ASOF&&+x.revenue>0).map(x=>({y:+x.revenue_year,m:+x.revenue_month,v:+x.revenue,ct:x.create_time||x.date})).sort((x,z)=>x.ct.localeCompare(z.ct));
 if(a.length<16)return null;const cur=a.at(-1),get=(Y,M)=>a.find(x=>x.y===Y&&x.m===M)?.v??null;
 const ys=[];for(let k=0;k<6;k++){let M=cur.m-k,Y=cur.y;while(M<=0){M+=12;Y--}const v=get(Y,M),py=get(Y-1,M);if(!(v>0&&py>0))return null;ys.push(v/py-1)}
 const expected=mean(ys.slice(1,4)),surprise=ys[0]-expected;
 const hist=[];for(let k=1;k<=12;k++){let M=cur.m-k,Y=cur.y;while(M<=0){M+=12;Y--}const v=get(Y,M),py=get(Y-1,M);if(v>0&&py>0)hist.push(v/py-1)}
 const hsd=sd(hist);
 return{revMonth:cur.y+'-'+String(cur.m).padStart(2,'0'),revYoY:ys[0],revSurprise:surprise,revZ:hsd&&hsd>0?(ys[0]-mean(hist))/hsd:null};
}
function latestFin(rows){
 const cutoff=new Date(Date.parse(ASOF+'T00:00:00Z')-70*86400000).toISOString().slice(0,10);
 const a=rows.filter(x=>x.date<=cutoff),ds=[...new Set(a.map(x=>x.date))].sort();if(!ds.length)return{};
 const d=ds.at(-1),get=t=>a.find(x=>x.date===d&&x.type===t)?.value;
 const rev=+get('Revenue'),op=+get('OperatingIncome'),ni=+get('IncomeAfterTaxes');
 return{finDate:d,opMargin:(rev>0&&Number.isFinite(op))?op/rev:null,opPositive:Number.isFinite(op)?op>0:null,niPositive:Number.isFinite(ni)?ni>0:null};
}
(async()=>{
 console.log('PROTOCOL',JSON.stringify({
  goal:'current full-market research shortlist, not a buy list',
  universe:'current TWSE+TPEx four-digit common stocks excluding ETFs and innovation-board label',
  features:[
   'MOM6 = return from t-126 to t-21 trading days',
   'Revenue surprise = latest YoY minus mean prior 3 monthly YoY',
   'Revenue z-score = latest YoY vs prior 12 monthly YoY'
  ],
  screen:'MOM6 top20% AND revenue surprise top33% among valid revenue observations',
  ranking:'equal-weight percentile of MOM6, revenue surprise, revenue z-score within screened set',
  riskFlags:'latest quarterly operating income/net income positivity and 20-day liquidity only; do not add predictive points',
  noEventClaims:true
 }));
 const raw=await info(),latest=new Map();
 for(const x of raw){if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x)}
 const stocks=[...latest.values()];
 const px=(await pool(stocks,20,async s=>{const p=await yahoo(s.stock_id,s.type);if(p.length<126)return null;const i=p.length-1;if(i<126)return null;const mom6=p[i-21].c/p[i-126].c-1;const liq=mean(p.slice(i-19,i+1).map(x=>x.v*x.raw));return{code:s.stock_id,name:s.stock_name,type:s.type,industry:s.industry_category,lastDate:p[i].date,lastClose:p[i].raw||p[i].c,mom6,liq}})).filter(Boolean);
 const mp=percentile(px.map(x=>x.mom6));px.forEach((x,i)=>x.momPct=mp[i]);const mom20=px.filter(x=>x.momPct>=.8);
 const revs=(await pool(mom20,14,async x=>{const r=revFeat(await fm('TaiwanStockMonthRevenue',x.code));return r?{...x,...r}:null})).filter(Boolean);
 const sp=percentile(revs.map(x=>x.revSurprise));revs.forEach((x,i)=>x.surpPct=sp[i]);const screened=revs.filter(x=>x.surpPct>=.67);
 const rp1=percentile(screened.map(x=>x.mom6)),rp2=percentile(screened.map(x=>x.revSurprise)),rp3=percentile(screened.map(x=>Number.isFinite(x.revZ)?x.revZ:-999));
 screened.forEach((x,i)=>x.score=(rp1[i]+rp2[i]+rp3[i])/3);
 screened.sort((a,b)=>b.score-a.score);
 const top=screened.slice(0,20);
 const enriched=(await pool(top,8,async x=>{const f=latestFin(await fm('TaiwanStockFinancialStatements',x.code,'2024-01-01',ASOF));return{...x,...f}})).filter(Boolean);
 console.log('RESULT',JSON.stringify({asof:ASOF,universe:px.length,mom20: mom20.length,validRevenue:revs.length,screened:screened.length,top20:enriched.map((x,i)=>({rank:i+1,code:x.code,name:x.name,industry:x.industry,lastDate:x.lastDate,lastClose:x.lastClose,mom6:x.mom6,momPct:x.momPct,revMonth:x.revMonth,revYoY:x.revYoY,revSurprise:x.revSurprise,revZ:x.revZ,score:x.score,finDate:x.finDate,opMargin:x.opMargin,opPositive:x.opPositive,niPositive:x.niPositive,liq20:x.liq}))}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
