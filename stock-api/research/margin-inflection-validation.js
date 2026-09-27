
const API='https://api.finmindtrade.com/api/v4/data';
const START='2020-01-01',END='2026-09-22',H=84,SEED=20260927;
const EXCLUDE=new Set(["3305","3230","3031","3264","3229","3232","3167","3043","3206","2362","2540","1103","1735","1235","3287","3027","1909","3349","1517","2070","1218","1471","2536","3147","2247","2516","2031","2022","3003","1522","2428","2317","2834","2332","3006","3049","2049","2482","2886","2337","2034","2227","3189","1203","2211","3272","2364","2884","2945","3066","2431","1215","3666","2107","4935","2103","3402","2106","2369","4764","2221","1521","3527","2477","2243","2890","2035","2882","4116","3491","7402","4107","4402","1104","2359","3628","3629","2548","4108","1309","3219","8289","8917","5299","2073","8462","8059","3483","9949","4938","8033","5009","6411","2312","2104","4417","3090","6020","1906","2367","8422","6166","2363","9906","9960","1102","4906","2495","6578","3094","4188","6170","6584","3042","2305","5483","3046","6523","5202","6456","5432","5468","3645","1316","5878","1410","5443","6201","8463","2615","5520","2852","1315","8443","5439","1525","1233","6220","2231","9926","6259","3374","2911","2722","2485","2314","9924","5906","4931","2032","5398","8131","6804","4502","5212","1527","6504","3050","2420","5508","2801","8040","5321","6213","2478","2013","6589","2832","6005","3416","4109","4541","8438","6248","9946","2434","3284","8104","8440","9955"]);
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);return (await r.json()).data||[]}
async function fm(ds,id){for(let a=0;a<3;a++){const u=new URL(API);u.searchParams.set('dataset',ds);u.searchParams.set('data_id',id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);const r=await fetch(u);if(r.ok)return (await r.json()).data||[];await sleep(250*(a+1))}return[]}
async function yahoo(code,type){const suf=type==='twse'?'.TW':'.TWO',p1=Math.floor(Date.parse(START+'T00:00:00Z')/1000),p2=Math.floor(Date.parse('2026-09-23T00:00:00Z')/1000);const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suf+'?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';for(let a=0;a<3;a++){const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(r.ok){const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],qq=x?.indicators?.quote?.[0],adj=x?.indicators?.adjclose?.[0]?.adjclose||qq?.close||[];return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),c:+adj[i]})).filter(z=>z.c>0)}await sleep(150*(a+1))}return[]}
async function pool(items,limit,fn){const out=new Array(items.length);let idx=0;async function w(){while(1){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i])}catch{out[i]=null}}}await Promise.all(Array.from({length:limit},w));return out}
function pct(vals){const s=vals.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),o=new Array(vals.length);for(let k=0;k<s.length;k++)o[s[k][1]]=k/(s.length-1||1);return o}
function dateAdd(d,n){return new Date(new Date(d+'T00:00:00Z').getTime()+n*86400000).toISOString().slice(0,10)}
function revFeat(rows,date){
 const a=rows.filter(x=>(x.create_time||x.date)<=date&&+x.revenue>0).map(x=>({y:+x.revenue_year,m:+x.revenue_month,v:+x.revenue,ct:x.create_time||x.date})).sort((x,z)=>x.ct.localeCompare(z.ct));
 if(!a.length)return null;const cur=a.at(-1),get=(Y,M)=>a.find(x=>x.y===Y&&x.m===M)?.v??null,ys=[];
 for(let k=0;k<4;k++){let M=cur.m-k,Y=cur.y;while(M<=0){M+=12;Y--}const v=get(Y,M),py=get(Y-1,M);if(!(v>0&&py>0))return null;ys.push(v/py-1)}
 return{revYoY:ys[0],revAccel:ys[0]-mean(ys.slice(1))};
}
function finFeat(rows,date){
 const cutoff=dateAdd(date,-70),a=rows.filter(x=>x.date<=cutoff),ds=[...new Set(a.map(x=>x.date))].sort();if(!ds.length)return null;
 const d=ds.at(-1),py=String(+d.slice(0,4)-1)+d.slice(4);
 const get=(D,t)=>{const z=a.find(x=>x.date===D&&x.type===t);return z?+z.value:null};
 const rev=get(d,'Revenue'),gp=get(d,'GrossProfit'),op=get(d,'OperatingIncome');
 const rev0=get(py,'Revenue'),gp0=get(py,'GrossProfit'),op0=get(py,'OperatingIncome');
 if(!(rev>0&&rev0>0&&Number.isFinite(gp)&&Number.isFinite(op)&&Number.isFinite(gp0)&&Number.isFinite(op0)))return null;
 const gm=gp/rev,om=op/rev,gm0=gp0/rev0,om0=op0/rev0;
 return{gm,om,gmDelta:gm-gm0,omDelta:om-om0,quality:(gm-gm0)+(om-om0)};
}
function perm(v,B=20000){let z=998877;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const obs=mean(v);let e=0;for(let b=0;b<B;b++)if(mean(v.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function boot(v,B=10000){let z=778899;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const a=[];for(let b=0;b<B;b++){const t=[];for(let i=0;i<v.length;i++)t.push(v[Math.floor(r()*v.length)]);a.push(mean(t))}return[q(a,.025),q(a,.975)]}
async function buildSample(stocks,target){
 const got=(await pool(stocks,16,async s=>{const [p,rev,fin]=await Promise.all([yahoo(s.stock_id,s.type),fm('TaiwanStockMonthRevenue',s.stock_id),fm('TaiwanStockFinancialStatements',s.stock_id)]);if(p.length<900||rev.length<36||fin.length<30)return null;return{s,p,map:new Map(p.map((x,i)=>[x.date,i])),rev,fin}})).filter(Boolean);
 return got.slice(0,target);
}
function evaluate(data,label){
 const cal=data[0].p.map(x=>x.date),dates=[];for(let i=300;i<cal.length-H;i+=84){const d=cal[i];if(d>='2021-08-01'&&d<='2026-01-31')dates.push(d)}
 const keys=['gmDelta50','gmDelta33','omDelta50','omDelta33','quality50','quality33','bothPositive','qualityTop20'];
 const delta={},prec={},cnt={};for(const k of keys){delta[k]=[];prec[k]=[];cnt[k]=[]}
 const rowsOut=[];
 for(const date of dates){
  const rows=[];for(const d of data){const i=d.map.get(date);if(i==null||i<126||!d.p[i+H])continue;const rf=revFeat(d.rev,date),ff=finFeat(d.fin,date);if(!rf||!ff)continue;rows.push({code:d.s.stock_id,mom:d.p[i-21].c/d.p[i-126].c-1,ret:d.p[i+H].c/d.p[i].c-1,...rf,...ff})}
  if(rows.length<90)continue;const pr=pct(rows.map(x=>x.mom));rows.forEach((x,i)=>x.mp=pr[i]);const mom=rows.filter(x=>x.mp>=.8);if(mom.length<18)continue;
  const accelCut=q(mom.map(x=>x.revAccel),.67),basePool=mom.filter(x=>x.revAccel>=accelCut);if(basePool.length<6)continue;
  const base=mean(basePool.map(x=>x.ret>=.2?1:0));
  const gm50=q(basePool.map(x=>x.gmDelta),.5),gm33=q(basePool.map(x=>x.gmDelta),.67),om50=q(basePool.map(x=>x.omDelta),.5),om33=q(basePool.map(x=>x.omDelta),.67),qu50=q(basePool.map(x=>x.quality),.5),qu33=q(basePool.map(x=>x.quality),.67),qu80=q(basePool.map(x=>x.quality),.8);
  const groups={
   gmDelta50:basePool.filter(x=>x.gmDelta>=gm50),gmDelta33:basePool.filter(x=>x.gmDelta>=gm33),
   omDelta50:basePool.filter(x=>x.omDelta>=om50),omDelta33:basePool.filter(x=>x.omDelta>=om33),
   quality50:basePool.filter(x=>x.quality>=qu50),quality33:basePool.filter(x=>x.quality>=qu33),
   bothPositive:basePool.filter(x=>x.gmDelta>0&&x.omDelta>0),qualityTop20:basePool.filter(x=>x.quality>=qu80)
  };
  const rec={date,n:rows.length,momN:mom.length,revAccelN:basePool.length,basePrecision:base,groups:{}};
  for(const k of keys){const g=groups[k];if(g.length<2)continue;const p=mean(g.map(x=>x.ret>=.2?1:0));delta[k].push(p-base);prec[k].push(p);cnt[k].push(g.length);rec.groups[k]={n:g.length,precision:p,delta:p-base}}
  rowsOut.push(rec);
 }
 const summary={};for(const k of keys){const v=delta[k];summary[k]={nDates:v.length,avgN:mean(cnt[k]),precision:mean(prec[k]),deltaVsRevAccel:mean(v),positive:v.filter(x=>x>0).length/(v.length||1),p:v.length?perm(v):null,ci:v.length?boot(v):null}}
 return{label,dates,summary,byDate:rowsOut};
}
(async()=>{
 console.log('PROTOCOL',JSON.stringify({base:'MOM6 top20 then revenue-acceleration top33',thirdLayer:['gross margin YoY inflection','operating margin YoY inflection','combined margin quality'],goal:'see whether candidate set can compress toward ~10 stocks without losing winner lift',samples:'two independent random cohorts'}));
 const raw=await info(),latest=new Map();for(const x of raw){if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||EXCLUDE.has(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x)}
 const rr=rng(SEED),cand=[...latest.values()].sort(()=>rr()-.5);
 const A=await buildSample(cand.slice(0,450),150),used=new Set(A.map(x=>x.s.stock_id));
 const B=await buildSample(cand.filter(x=>!used.has(x.stock_id)).slice(0,500),150);
 console.log('LOCK',JSON.stringify({A:A.length,B:B.length,A_codes:A.map(x=>x.s.stock_id),B_codes:B.map(x=>x.s.stock_id)}));
 const a=evaluate(A,'A'),b=evaluate(B,'B');
 console.log('RESULT',JSON.stringify({A:a,B:b}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
