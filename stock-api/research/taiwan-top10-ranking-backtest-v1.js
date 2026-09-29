
const API='https://api.finmindtrade.com/api/v4/data';
const START='2020-01-01',END='2026-09-24',H=84,TARGET=400,SEED=20260929;
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const sd=a=>{if(a.length<2)return null;const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)))};
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);return (await r.json()).data||[]}
async function fm(ds,id){for(let a=0;a<3;a++){const u=new URL(API);u.searchParams.set('dataset',ds);u.searchParams.set('data_id',id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);const r=await fetch(u);if(r.ok)return (await r.json()).data||[];await sleep(200*(a+1))}return[]}
async function yahoo(code,type){const suf=type==='twse'?'.TW':'.TWO',p1=Math.floor(Date.parse(START+'T00:00:00Z')/1000),p2=Math.floor(Date.parse('2026-09-25T00:00:00Z')/1000);const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suf+'?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';for(let a=0;a<3;a++){const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(r.ok){const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],qq=x?.indicators?.quote?.[0],adj=x?.indicators?.adjclose?.[0]?.adjclose||qq?.close||[];return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),c:+adj[i]})).filter(z=>z.c>0)}await sleep(150*(a+1))}return[]}
async function pool(items,limit,fn){const out=new Array(items.length);let idx=0;async function w(){while(1){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i])}catch{out[i]=null}}}await Promise.all(Array.from({length:limit},w));return out}
function percentile(vals){const s=vals.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),o=new Array(vals.length);for(let k=0;k<s.length;k++)o[s[k][1]]=k/(s.length-1||1);return o}
function revFeat(rows,date){
 const a=rows.filter(x=>(x.create_time||x.date)<=date&&+x.revenue>0).map(x=>({y:+x.revenue_year,m:+x.revenue_month,v:+x.revenue,ct:x.create_time||x.date})).sort((x,z)=>x.ct.localeCompare(z.ct));
 if(a.length<16)return null;const cur=a.at(-1),get=(Y,M)=>a.find(x=>x.y===Y&&x.m===M)?.v??null,ys=[];
 for(let k=0;k<13;k++){let M=cur.m-k,Y=cur.y;while(M<=0){M+=12;Y--}const v=get(Y,M),py=get(Y-1,M);if(!(v>0&&py>0))return null;ys.push(v/py-1)}
 const expected=mean(ys.slice(1,4)),surprise=ys[0]-expected,hist=ys.slice(1,13),hsd=sd(hist);
 return{revYoY:ys[0],revSurprise:surprise,revZ:hsd&&hsd>0?(ys[0]-mean(hist))/hsd:null};
}
function signPerm(v,B=20000){if(!v.length)return null;let z=987654;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const obs=mean(v);let e=0;for(let b=0;b<B;b++){const m=mean(v.map(x=>r()<.5?x:-x));if(m>=obs)e++}return(e+1)/(B+1)}
function boot(v,B=10000){if(!v.length)return null;let z=456789;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const a=[];for(let b=0;b<B;b++){const t=[];for(let i=0;i<v.length;i++)t.push(v[Math.floor(r()*v.length)]);a.push(mean(t))}return[q(a,.025),q(a,.975)]}
(async()=>{
 console.log('PROTOCOL',JSON.stringify({
   universe:'400 current TWSE/TPEx common stocks sampled once with fixed seed; excludes ETFs; survivorship bias remains',
   dates:'non-overlapping 84-trading-day grid',
   outcome:'future 84 trading-day return >=20%',
   lockedMethod:'MOM6 top20% -> revenue surprise top33% -> equal-weight percentile rank of MOM6, revenue surprise, revenue z-score -> top10',
   comparisons:['MOM6 top20 pool','revenue-surprise screened pool','top10 ranked']
 }));
 const raw=await info(),latest=new Map();for(const x of raw){if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x)}
 const rr=rng(SEED),cand=[...latest.values()].sort(()=>rr()-.5).slice(0,700);
 const got=(await pool(cand,18,async s=>{const [p,rev]=await Promise.all([yahoo(s.stock_id,s.type),fm('TaiwanStockMonthRevenue',s.stock_id)]);if(p.length<900||rev.length<36)return null;return{s,p,map:new Map(p.map((x,i)=>[x.date,i])),rev}})).filter(Boolean).slice(0,TARGET);
 console.log('LOCK',JSON.stringify({n:got.length,codes:got.map(x=>x.s.stock_id)}));
 const cal=got[0].p.map(x=>x.date),dates=[];for(let i=300;i<cal.length-H;i+=84){const d=cal[i];if(d>='2021-08-01'&&d<='2026-01-31')dates.push(d)}
 console.log('DATES',JSON.stringify(dates));
 const perDate=[],dTopVsScreen=[],dTopVsMom=[];
 for(const date of dates){
  const rows=[];for(const d of got){const i=d.map.get(date);if(i==null||i<126||!d.p[i+H])continue;const rf=revFeat(d.rev,date);if(!rf)continue;rows.push({code:d.s.stock_id,mom6:d.p[i-21].c/d.p[i-126].c-1,ret:d.p[i+H].c/d.p[i].c-1,...rf})}
  if(rows.length<250)continue;
  const mp=percentile(rows.map(x=>x.mom6));rows.forEach((x,i)=>x.momPct=mp[i]);const mom=rows.filter(x=>x.momPct>=.8);if(mom.length<40)continue;
  const sp=percentile(mom.map(x=>x.revSurprise));mom.forEach((x,i)=>x.surpPct=sp[i]);const screen=mom.filter(x=>x.surpPct>=.67);if(screen.length<12)continue;
  const a=percentile(screen.map(x=>x.mom6)),b=percentile(screen.map(x=>x.revSurprise)),c=percentile(screen.map(x=>Number.isFinite(x.revZ)?x.revZ:-999));
  screen.forEach((x,i)=>x.score=(a[i]+b[i]+c[i])/3);screen.sort((x,y)=>y.score-x.score);const top=screen.slice(0,10);
  const pm=mean(mom.map(x=>x.ret>=.2?1:0)),ps=mean(screen.map(x=>x.ret>=.2?1:0)),pt=mean(top.map(x=>x.ret>=.2?1:0));
  const rm=mean(mom.map(x=>x.ret)),rs=mean(screen.map(x=>x.ret)),rt=mean(top.map(x=>x.ret));
  dTopVsScreen.push(pt-ps);dTopVsMom.push(pt-pm);
  perDate.push({date,n:rows.length,momN:mom.length,screenN:screen.length,topN:top.length,momPrecision:pm,screenPrecision:ps,topPrecision:pt,momMeanReturn:rm,screenMeanReturn:rs,topMeanReturn:rt,topCodes:top.map(x=>x.code)});
 }
 console.log('RESULT',JSON.stringify({
   perDate,
   aggregate:{
    dates:perDate.length,
    momPrecision:mean(perDate.map(x=>x.momPrecision)),
    screenPrecision:mean(perDate.map(x=>x.screenPrecision)),
    top10Precision:mean(perDate.map(x=>x.topPrecision)),
    top10MinusScreen:mean(dTopVsScreen),
    top10MinusMom:mean(dTopVsMom),
    top10MinusScreenPositive:dTopVsScreen.filter(x=>x>0).length,
    pTopVsScreen:signPerm(dTopVsScreen),
    ciTopVsScreen:boot(dTopVsScreen),
    pTopVsMom:signPerm(dTopVsMom),
    ciTopVsMom:boot(dTopVsMom),
    momMeanReturn:mean(perDate.map(x=>x.momMeanReturn)),
    screenMeanReturn:mean(perDate.map(x=>x.screenMeanReturn)),
    top10MeanReturn:mean(perDate.map(x=>x.topMeanReturn))
   }
 }));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
