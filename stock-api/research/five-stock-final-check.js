
const API='https://api.finmindtrade.com/api/v4/data';
const ASOF='2026-09-24', START='2026-02-01';
const TARGETS=new Set(['1218','1727','2301','2618','9941']);
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function fm(dataset,id,start=START,end=ASOF){
 for(let a=0;a<4;a++){const u=new URL(API);u.searchParams.set('dataset',dataset);if(id)u.searchParams.set('data_id',id);u.searchParams.set('start_date',start);u.searchParams.set('end_date',end);const r=await fetch(u);if(r.ok){const j=await r.json();return j.data||[]}if(a===3)throw Error(dataset+' '+(id||'')+' '+r.status);await sleep(350*(a+1))}
}
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);if(!r.ok)throw Error('info '+r.status);return (await r.json()).data||[]}
function dateAdd(d,n){return new Date(new Date(d+'T00:00:00Z').getTime()+n*86400000).toISOString().slice(0,10)}
function risk(p){
 const i=p.length-1;if(i<126)return null;
 const rs=[];for(let j=i-59;j<=i;j++)rs.push(Math.log(p[j].close/p[j-1].close));const m=mean(rs),vol=Math.sqrt(mean(rs.map(x=>(x-m)**2)))*Math.sqrt(252);
 let peak=-Infinity,mdd=0;for(const x of p.slice(i-59,i+1)){peak=Math.max(peak,x.close);mdd=Math.min(mdd,x.close/peak-1)}
 const avgMoney20=mean(p.slice(i-19,i+1).map(x=>x.money));
 let extreme=false;for(let j=i-19;j<=i;j++)if(Math.abs(p[j].close/p[j-1].close-1)>=.10)extreme=true;
 return {vol,drawdown60:-mdd,avgMoney20,extreme20:extreme,mom6:p[i-21].close/p[i-126].close-1,lastDate:p[i].date,lastClose:p[i].close};
}
function revenueScore(rev){
 const rows=rev.filter(x=>(x.create_time||x.date)<=ASOF&&+x.revenue>0).map(x=>({y:+x.revenue_year,m:+x.revenue_month,v:+x.revenue,ct:x.create_time||x.date})).sort((a,b)=>a.ct.localeCompare(b.ct));if(!rows.length)return {};
 const cur=rows.at(-1),get=(Y,M)=>rows.find(x=>x.y===Y&&x.m===M)?.v??null,py=get(cur.y-1,cur.m);
 let yoy=null,trend=null;if(py>0){yoy=cur.v/py-1;const h=[];for(let k=1;k<=3;k++){let M=cur.m-k,Y=cur.y;while(M<=0){M+=12;Y--}const a=get(Y,M),b=get(Y-1,M);if(a>0&&b>0)h.push(a/b-1)}if(h.length>=2)trend=yoy>=median(h)}
 return {month:cur.y+'-'+String(cur.m).padStart(2,'0'),yoy,trend};
}
function fin(fin){
 const cutoff=dateAdd(ASOF,-70),fs=fin.filter(x=>x.date<=cutoff),dates=[...new Set(fs.map(x=>x.date))].sort();if(!dates.length)return {};
 const d=dates.at(-1),get=t=>fs.find(x=>x.date===d&&x.type===t)?.value;
 return {date:d,op:+get('OperatingIncome'),ni:+get('IncomeAfterTaxes')};
}
function ttmOCF(cash){
 const cutoff=dateAdd(ASOF,-70),xs=cash.filter(x=>x.date<=cutoff&&(x.type==='CashFlowsFromOperatingActivities'||x.type==='NetCashInflowFromOperatingActivities')&&Number.isFinite(+x.value)).map(x=>({d:x.date,v:+x.value})).sort((a,b)=>a.d.localeCompare(b.d));if(xs.length<4)return null;
 const byYear={};for(const x of xs){const y=x.d.slice(0,4);(byYear[y]??=[]).push(x)}const qs=[];for(const y of Object.keys(byYear).sort()){const a=byYear[y].sort((x,z)=>x.d.localeCompare(z.d));let prev=0;for(const x of a){qs.push({d:x.d,v:x.v-prev});prev=x.v}}if(qs.length<4)return null;return qs.slice(-4).reduce((s,x)=>s+x.v,0);
}
(async()=>{
 const raw=await info(),latest=new Map();for(const x of raw){if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x)}
 const all=[];
 for(const s of latest.values()){
  try{const rows=await fm('TaiwanStockPrice',s.stock_id);const p=rows.map(x=>({date:x.date,close:+x.close,money:+x.Trading_money||0})).filter(x=>x.close>0).sort((a,b)=>a.date.localeCompare(b.date));if(p.length<126)continue;const r=risk(p);if(r)all.push({code:s.stock_id,name:s.stock_name,industry:s.industry_category,type:s.type,p,r});}catch{}
  await sleep(20);
 }
 all.sort((a,b)=>b.r.mom6-a.r.mom6);all.forEach((x,i)=>x.rank=i+1);
 const n=all.length, vols=[...all].sort((a,b)=>a.r.vol-b.r.vol), liqs=[...all].sort((a,b)=>a.r.avgMoney20-b.r.avgMoney20);
 const vMap=new Map(vols.map((x,i)=>[x.code,i/(n-1)])),lMap=new Map(liqs.map((x,i)=>[x.code,i/(n-1)]));
 const out=[];
 for(const x of all.filter(x=>TARGETS.has(x.code))){
   const [rev,finrows,cash]=await Promise.all([fm('TaiwanStockMonthRevenue',x.code,'2024-01-01',ASOF),fm('TaiwanStockFinancialStatements',x.code,'2024-01-01',ASOF),fm('TaiwanStockCashFlowsStatement',x.code,'2024-01-01',ASOF)]);
   const rv=revenueScore(rev),ff=fin(finrows),ocf=ttmOCF(cash);
   const pct=1-(x.rank-1)/(n-1), flags=[];
   if((vMap.get(x.code)??0)>=.9)flags.push('高波動');
   if(x.r.drawdown60>.20)flags.push('60日回撤>20%');
   if((lMap.get(x.code)??1)<=.2)flags.push('低流動性');
   if(x.r.extreme20)flags.push('20日單日±10%以上');
   out.push({code:x.code,name:x.name,industry:x.industry,lastDate:x.r.lastDate,lastClose:x.r.lastClose,mom6:x.r.mom6,rank:x.rank,universe:n,percentile:pct,
    candidate:pct>=.9?'強候選':pct>=.8?'候選':pct>=.7?'觀察':'非候選',
    risk:{volPercentile:vMap.get(x.code),drawdown60:x.r.drawdown60,liquidityPercentile:lMap.get(x.code),extreme20:x.r.extreme20,flags},
    fundamentals:{revenueMonth:rv.month,revenueYoY:rv.yoy,revenueTrend:rv.trend,operatingIncome:ff.op,netIncome:ff.ni,financialDate:ff.date,ttmOCF:ocf}});
 }
 console.log('RESULT',JSON.stringify({asof:ASOF,universe:n,targets:out}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
