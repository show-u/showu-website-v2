
const API='https://api.finmindtrade.com/api/v4/data';
const START='2026-02-01',END='2026-09-24',TOPN=30;
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function fm(dataset,id,start=START,end=END){
 for(let a=0;a<4;a++){
  const u=new URL(API);u.searchParams.set('dataset',dataset);if(id)u.searchParams.set('data_id',id);u.searchParams.set('start_date',start);u.searchParams.set('end_date',end);
  const r=await fetch(u);if(r.ok){const j=await r.json();return j.data||[]}
  if(a===3)throw Error(dataset+' '+(id||'')+' '+r.status);await sleep(500*(a+1));
 }
}
async function info(){
 const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');
 const r=await fetch(u);if(!r.ok)throw Error('info '+r.status);return (await r.json()).data||[];
}
function dateAdd(d,n){return new Date(new Date(d+'T00:00:00Z').getTime()+n*86400000).toISOString().slice(0,10)}
function scoreRevenue(rev,asof){
 const rows=rev.filter(x=>(x.create_time||x.date)<=asof&&+x.revenue>0).map(x=>({y:+x.revenue_year,m:+x.revenue_month,v:+x.revenue,ct:x.create_time||x.date})).sort((a,b)=>a.ct.localeCompare(b.ct));
 if(!rows.length)return {pts:null,yoy:null,trend:null};
 const cur=rows.at(-1),get=(Y,M)=>rows.find(x=>x.y===Y&&x.m===M)?.v??null,py=get(cur.y-1,cur.m);
 if(!(py>0))return {pts:null,yoy:null,trend:null};
 const yoy=cur.v/py-1,h=[];
 for(let k=1;k<=3;k++){let M=cur.m-k,Y=cur.y;while(M<=0){M+=12;Y--}const a=get(Y,M),b=get(Y-1,M);if(a>0&&b>0)h.push(a/b-1)}
 let pts=0;if(yoy>0)pts+=2;const trend=h.length>=2&&yoy>=median(h);if(trend)pts+=2;
 return {pts,yoy,trend,month:cur.y+'-'+String(cur.m).padStart(2,'0')};
}
function scoreFin(fin,asof){
 const cutoff=dateAdd(asof,-70),fs=fin.filter(x=>x.date<=cutoff),ds=[...new Set(fs.map(x=>x.date))].sort();if(!ds.length)return {pts:null};
 const d=ds.at(-1),get=t=>fs.find(x=>x.date===d&&x.type===t)?.value;
 const op=+get('OperatingIncome'),ni=+get('IncomeAfterTaxes');let pts=0;
 if(Number.isFinite(op)&&op>0)pts+=2;if(Number.isFinite(ni)&&ni>0)pts+=2;
 return {pts,date:d,op,ni};
}
function ttmOCF(cash,asof){
 const cutoff=dateAdd(asof,-70),xs=cash.filter(x=>x.date<=cutoff&&(x.type==='CashFlowsFromOperatingActivities'||x.type==='NetCashInflowFromOperatingActivities')&&Number.isFinite(+x.value))
  .map(x=>({d:x.date,v:+x.value})).sort((a,b)=>a.d.localeCompare(b.d));
 if(xs.length<4)return null;
 const byYear={};for(const x of xs){const y=x.d.slice(0,4);(byYear[y]??=[]).push(x)}
 const qs=[];for(const y of Object.keys(byYear).sort()){const a=byYear[y].sort((x,z)=>x.d.localeCompare(z.d));let prev=0;for(const x of a){qs.push({d:x.d,v:x.v-prev});prev=x.v}}
 if(qs.length<4)return null;return qs.slice(-4).reduce((s,x)=>s+x.v,0);
}
function riskStats(p){
 const n=p.length,i=n-1;if(i<60)return null;
 const rs=[];for(let j=i-59;j<=i;j++)rs.push(Math.log(p[j].close/p[j-1].close));
 const m=mean(rs),vol=Math.sqrt(mean(rs.map(x=>(x-m)**2)))*Math.sqrt(252);
 let peak=-Infinity,mdd=0;for(const x of p.slice(i-59,i+1)){peak=Math.max(peak,x.close);mdd=Math.min(mdd,x.close/peak-1)}
 const avgMoney20=mean(p.slice(i-19,i+1).map(x=>x.money));
 let extreme=false;for(let j=i-19;j<=i;j++)if(Math.abs(p[j].close/p[j-1].close-1)>=.10){extreme=true;break}
 return {vol,dd:-mdd,avgMoney20,extreme};
}
(async()=>{
 console.log('PROTOCOL',JSON.stringify({
  asof:END,
  objective:'Run the validated individual-stock candidate workflow on current Taiwan stocks',
  gate:'MOM6 market top20%; report top30 by MOM6 for full second-stage checks',
  fundamentals:'revenue YoY, revenue trend, operating income, net income, TTM operating cash flow',
  risk:'60d volatility, 60d max drawdown, 20d avg traded money, >=10% single-day move in latest20d',
  event:'not auto-scored here; final output marks event review pending for shortlisted names'
 }));
 const raw=await info(),latest=new Map();
 for(const x of raw){
  if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;
  const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x);
 }
 const stocks=[...latest.values()],px=[];
 for(const s of stocks){
  try{
   const rows=await fm('TaiwanStockPrice',s.stock_id,'2026-02-01',END);
   const p=rows.map(x=>({date:x.date,close:+x.close,money:+x.Trading_money||0})).filter(x=>x.close>0).sort((a,b)=>a.date.localeCompare(b.date));
   if(p.length<126)continue;
   const i=p.length-1,mom=p[i-21].close/p[i-126].close-1;
   if(Number.isFinite(mom))px.push({code:s.stock_id,name:s.stock_name,type:s.type,industry:s.industry_category,mom,p});
  }catch{}
  await sleep(35);
 }
 px.sort((a,b)=>b.mom-a.m);px.forEach((x,i)=>x.pct=1-i/Math.max(1,px.length-1));
 const top20=px.filter(x=>x.pct>=.80),leaders=top20.slice(0,TOPN);
 const vols=px.map(x=>riskStats(x.p)?.vol).filter(Number.isFinite).sort((a,b)=>a-b),liq=px.map(x=>riskStats(x.p)?.avgMoney20).filter(Number.isFinite).sort((a,b)=>a-b);
 const quant=(arr,v)=>arr.findIndex(x=>x>=v)/Math.max(1,arr.length-1);
 const out=[];
 for(const x of leaders){
  let rev=[],fin=[],cash=[];try{[rev,fin,cash]=await Promise.all([
   fm('TaiwanStockMonthRevenue',x.code,'2024-01-01',END),
   fm('TaiwanStockFinancialStatements',x.code,'2024-01-01',END),
   fm('TaiwanStockCashFlowsStatement',x.code,'2024-01-01',END)
  ])}catch{}
  const rs=scoreRevenue(rev,END),fs=scoreFin(fin,END),ocf=ttmOCF(cash,END),risk=riskStats(x.p);
  const basic=(rs.pts??0)+(fs.pts??0)+(Number.isFinite(ocf)&&ocf>0?2:0);
  const vPct=Number.isFinite(risk?.vol)?quant(vols,risk.vol):null,lPct=Number.isFinite(risk?.avgMoney20)?quant(liq,risk.avgMoney20):null;
  const flags=[];
  if(vPct!=null&&vPct>=.90)flags.push('高波動');
  if(risk?.dd>.20)flags.push('60日回撤>20%');
  if(lPct!=null&&lPct<=.20)flags.push('低流動性');
  if(risk?.extreme)flags.push('20日極端跳動');
  let grade='A';
  if(x.pct>=.90&&basic>=8&&!risk?.extreme)grade='A+';
  else if(x.pct>=.80)grade='A';
  else grade='B';
  out.push({code:x.code,name:x.name,industry:x.industry,mom:x.mom,marketPercentile:x.pct,basicScore:basic,
    revenueYoY:rs.yoy,revenueTrend:rs.trend,operatingIncomePositive:Number.isFinite(fs.op)?fs.op>0:null,
    netIncomePositive:Number.isFinite(fs.ni)?fs.ni>0:null,ttmOCFPositive:Number.isFinite(ocf)?ocf>0:null,
    riskFlags:flags,volPercentile:vPct,drawdown60:risk?.dd,liquidityPercentile:lPct,grade,eventReview:'PENDING'});
  await sleep(100);
 }
 console.log('RESULT',JSON.stringify({universe:px.length,top20Count:top20.length,top30:out}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
