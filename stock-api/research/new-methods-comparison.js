
const API='https://api.finmindtrade.com/api/v4/data';
const START='2020-01-01',END='2026-09-22',H=84,TARGET=180,SEED=20261004;
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);return (await r.json()).data||[]}
async function fm(ds,id){for(let a=0;a<3;a++){const u=new URL(API);u.searchParams.set('dataset',ds);u.searchParams.set('data_id',id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);const r=await fetch(u);if(r.ok)return (await r.json()).data||[];await sleep(250*(a+1))}return[]}
async function yahoo(code,type){const suf=type==='twse'?'.TW':'.TWO',p1=Math.floor(Date.parse(START+'T00:00:00Z')/1000),p2=Math.floor(Date.parse('2026-09-23T00:00:00Z')/1000);const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suf+'?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';for(let a=0;a<3;a++){const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(r.ok){const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],qq=x?.indicators?.quote?.[0],adj=x?.indicators?.adjclose?.[0]?.adjclose||qq?.close||[];return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),c:+adj[i],v:+qq.volume?.[i]||0})).filter(z=>z.c>0)}await sleep(150*(a+1))}return[]}
async function pool(items,limit,fn){const out=new Array(items.length);let idx=0;async function w(){while(1){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i])}catch{out[i]=null}}}await Promise.all(Array.from({length:limit},w));return out}
function pct(vals){const s=vals.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),o=new Array(vals.length);for(let k=0;k<s.length;k++)o[s[k][1]]=k/(s.length-1||1);return o}
function dateAdd(d,n){return new Date(new Date(d+'T00:00:00Z').getTime()+n*86400000).toISOString().slice(0,10)}
function perm(v,B=20000){let z=171717;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const obs=mean(v);let e=0;for(let b=0;b<B;b++)if(mean(v.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function boot(v,B=10000){let z=272727;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const a=[];for(let b=0;b<B;b++){const t=[];for(let i=0;i<v.length;i++)t.push(v[Math.floor(r()*v.length)]);a.push(mean(t))}return[q(a,.025),q(a,.975)]}
function finFeat(rows,date){
 const cutoff=dateAdd(date,-70),a=rows.filter(x=>x.date<=cutoff),ds=[...new Set(a.map(x=>x.date))].sort();if(!ds.length)return{};
 const d=ds.at(-1),get=t=>{const z=a.find(x=>x.date===d&&x.type===t);return z?+z.value:null};
 const gp=get('GrossProfit'),ta=get('TotalAssets'),op=get('OperatingIncome'),rev=get('Revenue');
 return {gpTA:(Number.isFinite(gp)&&ta>0)?gp/ta:null,opMargin:(Number.isFinite(op)&&rev>0)?op/rev:null};
}
function ocfFeat(rows,date,finRows){
 const cutoff=dateAdd(date,-70),a=rows.filter(x=>x.date<=cutoff&&(x.type==='CashFlowsFromOperatingActivities'||x.type==='NetCashInflowFromOperatingActivities')&&Number.isFinite(+x.value)).sort((x,z)=>x.date.localeCompare(z.date));if(!a.length)return null;
 const ds=[...new Set(finRows.filter(x=>x.date<=cutoff).map(x=>x.date))].sort();if(!ds.length)return null;const d=ds.at(-1),taRow=finRows.find(x=>x.date===d&&x.type==='TotalAssets'),ta=taRow?+taRow.value:null;if(!(ta>0))return null;
 const latest=a.at(-1);return (+latest.value)/ta;
}
function betaResidualScore(p,i,marketMap){
 const rs=[],ms=[];for(let j=i-125;j<=i-21;j++){if(j<=0)continue;const d=p[j].date,m=marketMap.get(d);if(!Number.isFinite(m))continue;const r=p[j].c/p[j-1].c-1;rs.push(r);ms.push(m)}
 if(rs.length<80)return null;const mr=mean(rs),mm=mean(ms);let cov=0,varm=0;for(let k=0;k<rs.length;k++){cov+=(rs[k]-mr)*(ms[k]-mm);varm+=(ms[k]-mm)**2}const b=varm>0?cov/varm:0,a=mr-b*mm,res=rs.map((r,k)=>r-(a+b*ms[k]));const sd=Math.sqrt(mean(res.map(x=>(x-mean(res))**2)));return sd>0?res.reduce((s,x)=>s+x,0)/(sd*Math.sqrt(res.length)):null;
}
(async()=>{
 console.log('PROTOCOL',JSON.stringify({
   objective:'Compare previously untested/under-tested practical Taiwan-stock methods against MOM6 on one locked benchmark sample',
   sample:'180 current TWSE/TPEx stocks with long history; this is a comparison benchmark, NOT claimed independent from all prior studies',
   dates:'14 non-overlapping 84-trading-day dates, 2021-2026',
   outcome:'future 84-trading-day return >=20%',
   methods:{
     MOM6:'6-to-1 month momentum benchmark',
     RESMOM1F:'one-factor market-residual momentum proxy; not an exact FF3 replication',
     GPTA:'gross profit / total assets using statements known with 70-day lag',
     OCF_A:'operating cash flow / total assets using statements known with 70-day lag',
     MOM6_LOWLIQ:'MOM6 top20 intersect lower-half cross-sectional dollar-volume proxy; NOT exact turnover-rate replication'
   },
   evaluation:'top20% each method vs same-date universe; report precision/lift/sign test permutation/bootstrap'
 }));
 const raw=await info(),latest=new Map();for(const x of raw){if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x)}
 const rr=rng(SEED),cand=[...latest.values()].sort(()=>rr()-.5).slice(0,520);
 const got=(await pool(cand,14,async s=>{const [p,fin,cash]=await Promise.all([yahoo(s.stock_id,s.type),fm('TaiwanStockFinancialStatements',s.stock_id),fm('TaiwanStockCashFlowsStatement',s.stock_id)]);if(p.length<900||fin.length<20)return null;return{s,p,map:new Map(p.map((x,i)=>[x.date,i])),fin,cash}})).filter(Boolean).slice(0,TARGET);
 console.log('LOCK',JSON.stringify({n:got.length,codes:got.map(x=>x.s.stock_id)}));
 const cal=got[0].p.map(x=>x.date),dates=[];for(let i=300;i<cal.length-H;i+=84){const d=cal[i];if(d>='2021-08-01'&&d<='2026-01-31')dates.push(d)}console.log('DATES',JSON.stringify(dates));
 const names=['MOM6','RESMOM1F','GPTA','OCF_A','MOM6_LOWLIQ'],lift={},prec={},cnt={};for(const n of names){lift[n]=[];prec[n]=[];cnt[n]=[]}
 const rowsOut=[];
 for(const date of dates){
   const temp=[];
   for(const d of got){const i=d.map.get(date);if(i==null||i<126||!d.p[i+H])continue;const mom6=d.p[i-21].c/d.p[i-126].c-1,ret=d.p[i+H].c/d.p[i].c-1,avgDollar=mean(d.p.slice(i-19,i+1).map(x=>x.v*x.c)),ff=finFeat(d.fin,date),ocf=ocfFeat(d.cash,date,d.fin);temp.push({d,i,code:d.s.stock_id,mom6,ret,avgDollar,...ff,ocfA:ocf})}
   if(temp.length<100)continue;
   const allDateSet=new Set(temp.map(x=>x.d.p[x.i].date));
   const marketMap=new Map();
   for(let off=125;off>=21;off--){const vals=[];let dd=null;for(const x of temp){const j=x.i-off;if(j>0){dd=x.d.p[j].date;vals.push(x.d.p[j].c/x.d.p[j-1].c-1)}}if(dd&&vals.length>50)marketMap.set(dd,mean(vals))}
   for(const x of temp)x.resmom=betaResidualScore(x.d.p,x.i,marketMap);
   const baseline=mean(temp.map(x=>x.ret>=.2?1:0));
   const groups={};
   function top20(k,high=true){const a=temp.filter(x=>Number.isFinite(x[k]));if(a.length<50)return[];const cut=q(a.map(x=>x[k]),high?.8:.2);return a.filter(x=>high?x[k]>=cut:x[k]<=cut)}
   groups.MOM6=top20('mom6',true);groups.RESMOM1F=top20('resmom',true);groups.GPTA=top20('gpTA',true);groups.OCF_A=top20('ocfA',true);
   const m=groups.MOM6,liqCut=median(m.map(x=>x.avgDollar));groups.MOM6_LOWLIQ=m.filter(x=>x.avgDollar<=liqCut);
   const rec={date,n:temp.length,baseline,groups:{}};
   for(const n of names){const g=groups[n];if(g.length<5)continue;const p=mean(g.map(x=>x.ret>=.2?1:0)),d=p-baseline;lift[n].push(d);prec[n].push(p);cnt[n].push(g.length);rec.groups[n]={n:g.length,precision:p,lift:d}}
   rowsOut.push(rec);
 }
 const summary={};for(const n of names){const v=lift[n];summary[n]={nDates:v.length,avgN:mean(cnt[n]),precision:mean(prec[n]),liftVsUniverse:mean(v),positive:v.filter(x=>x>0).length/(v.length||1),p:v.length?perm(v):null,ci:v.length?boot(v):null}}
 console.log('RESULT',JSON.stringify({summary,byDate:rowsOut}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
