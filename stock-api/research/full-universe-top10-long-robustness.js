
const API='https://api.finmindtrade.com/api/v4/data';
const START='2013-01-01',END='2026-09-22',H=84;
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const std=a=>{const m=mean(a),s=Math.sqrt(mean(a.map(x=>(x-m)**2)))||1;return[m,s]};
const q=(a,p)=>{const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);return (await r.json()).data||[]}
async function fm(ds,id){for(let a=0;a<4;a++){const u=new URL(API);u.searchParams.set('dataset',ds);u.searchParams.set('data_id',id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);const r=await fetch(u);if(r.ok)return (await r.json()).data||[];await sleep(300*(a+1))}return[]}
async function yahoo(code,type){const suf=type==='twse'?'.TW':'.TWO',p1=Math.floor(Date.parse(START+'T00:00:00Z')/1000),p2=Math.floor(Date.parse('2026-09-23T00:00:00Z')/1000);const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suf+'?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';for(let a=0;a<3;a++){const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(r.ok){const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],qq=x?.indicators?.quote?.[0],adj=x?.indicators?.adjclose?.[0]?.adjclose||qq?.close||[];return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),c:+adj[i]})).filter(z=>z.c>0)}await sleep(150*(a+1))}return[]}
async function pool(items,limit,fn){const out=new Array(items.length);let idx=0;async function w(){while(1){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i])}catch{out[i]=null}}}await Promise.all(Array.from({length:limit},w));return out}
function priceFeat(p,i){if(i<252||!p[i+H])return null;const mom6=p[i-21].c/p[i-126].c-1,mom3=p[i-21].c/p[i-63].c-1,mom12=p[i-21].c/p[i-252].c-1,ret20=p[i].c/p[i-21].c-1,hi=Math.max(...p.slice(i-251,i+1).map(x=>x.c)),highProx=p[i].c/hi;let pos=0;for(let j=i-125;j<=i;j++)if(p[j].c>p[j-1].c)pos++;return{mom6,mom3,mom12,ret20,highProx,posShare:pos/126,ret:p[i+H].c/p[i].c-1}}
function revFeat(rows,date){const a=rows.filter(x=>(x.create_time||x.date)<=date&&+x.revenue>0).map(x=>({y:+x.revenue_year,m:+x.revenue_month,v:+x.revenue,ct:x.create_time||x.date})).sort((x,z)=>x.ct.localeCompare(z.ct));if(!a.length)return null;const cur=a.at(-1),get=(Y,M)=>a.find(x=>x.y===Y&&x.m===M)?.v??null,ys=[];for(let k=0;k<4;k++){let M=cur.m-k,Y=cur.y;while(M<=0){M+=12;Y--}const v=get(Y,M),py=get(Y-1,M);if(!(v>0&&py>0))return null;ys.push(v/py-1)}return{revYoY:ys[0],revAccel:ys[0]-mean(ys.slice(1))}}
function sigmoid(z){return 1/(1+Math.exp(-Math.max(-30,Math.min(30,z))))}
function fit(train,keys,lambda=1,steps=900,lr=.03){
 const stats={};for(const k of keys)stats[k]=std(train.map(x=>x[k]));
 const X=train.map(x=>[1,...keys.map(k=>(x[k]-stats[k][0])/stats[k][1])]),y=train.map(x=>x.win?1:0),w=new Array(keys.length+1).fill(0);
 for(let s=0;s<steps;s++){const g=new Array(w.length).fill(0);for(let i=0;i<X.length;i++){let z=0;for(let j=0;j<w.length;j++)z+=w[j]*X[i][j];const e=sigmoid(z)-y[i];for(let j=0;j<w.length;j++)g[j]+=e*X[i][j]}for(let j=0;j<w.length;j++){g[j]/=X.length;if(j>0)g[j]+=lambda*w[j]/X.length;w[j]-=lr*g[j]}}
 return x=>{let z=w[0];keys.forEach((k,j)=>z+=w[j+1]*(x[k]-stats[k][0])/stats[k][1]);return sigmoid(z)}
}
function signPerm(v,B=20000){let z=778811;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const obs=mean(v);let e=0;for(let b=0;b<B;b++)if(mean(v.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function boot(v,B=10000){let z=118877;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const a=[];for(let b=0;b<B;b++){const t=[];for(let i=0;i<v.length;i++)t.push(v[Math.floor(r()*v.length)]);a.push(mean(t))}return[q(a,.025),q(a,.975)]}
(async()=>{
 console.log('PROTOCOL',JSON.stringify({
   goal:'long-horizon robustness test of the already-locked exact-top10 model; no model changes',
   caveat:'current-listed historical universe; survivorship bias remains',
   gate:'MOM6 top20% each date',
   features:['mom6','mom3','mom12','ret20','highProx','posShare','revYoY','revAccel'],
   model:'fixed ridge logistic lambda=1, no hyperparameter tuning',
   train:'walk-forward; test starts 2018 when >=800 prior candidate observations exist; only prior non-overlapping dates used',
   outcome:'future84 return >=20%',
   benchmark:['MOM6 top20 pool','raw MOM6 top10']
 }));
 const raw=await info(),latest=new Map();for(const x of raw){if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x)}
 const stocks=[...latest.values()];
 const px=(await pool(stocks,22,async s=>{const p=await yahoo(s.stock_id,s.type);return p.length>=900?{s,p,map:new Map(p.map((x,i)=>[x.date,i]))}:null})).filter(Boolean);
 console.log('PRICE_LOCK',JSON.stringify({n:px.length}));
 if(px.length<1000)throw Error('insufficient price universe');
 const cal=px.sort((a,b)=>b.p.length-a.p.length)[0].p.map(x=>x.date),dates=[];for(let i=300;i<cal.length-H;i+=84){const d=cal[i];if(d>='2015-01-01'&&d<='2026-01-31')dates.push(d)}
 console.log('DATES',JSON.stringify(dates));
 const priceRowsByDate=new Map(),union=new Set();
 for(const date of dates){const rows=[];for(const d of px){const i=d.map.get(date),f=i==null?null:priceFeat(d.p,i);if(f)rows.push({code:d.s.stock_id,name:d.s.stock_name,industry:d.s.industry_category,date,...f})}rows.sort((a,b)=>b.mom6-a.mom6);const gate=rows.slice(0,Math.ceil(rows.length*.2));gate.forEach(x=>union.add(x.code));priceRowsByDate.set(date,{all:rows,gate})}
 console.log('GATE_UNION',JSON.stringify({n:union.size}));
 const revMap=new Map();const unionStocks=[...union];
 const fetched=await pool(unionStocks,18,async code=>[code,await fm('TaiwanStockMonthRevenue',code)]);
 for(const z of fetched.filter(Boolean))revMap.set(z[0],z[1]);
 const dataset=[];
 for(const date of dates){const g=priceRowsByDate.get(date).gate;for(const x of g){const rf=revFeat(revMap.get(x.code)||[],date);if(rf)dataset.push({...x,...rf,win:x.ret>=.2})}}
 console.log('DATA',JSON.stringify({rows:dataset.length,withRevenueCodes:new Set(dataset.map(x=>x.code)).size}));
 const keys=['mom6','mom3','mom12','ret20','highProx','posShare','revYoY','revAccel'];
 const out=[],diffModelVsRaw=[],diffModelVsGate=[];
 for(const date of dates.filter(d=>d>='2018-01-01')){
   const train=dataset.filter(x=>x.date<date),test=dataset.filter(x=>x.date===date);if(train.length<800||test.length<100)continue;
   const score=fit(train,keys),model=[...test].sort((a,b)=>score(b)-score(a)).slice(0,10),raw10=[...test].sort((a,b)=>b.mom6-a.mom6).slice(0,10);
   const modelP=mean(model.map(x=>x.win?1:0)),rawP=mean(raw10.map(x=>x.win?1:0)),gateP=mean(test.map(x=>x.win?1:0));
   diffModelVsRaw.push(modelP-rawP);diffModelVsGate.push(modelP-gateP);
   out.push({date,trainN:train.length,testGateN:test.length,gatePrecision:gateP,rawMOM10Precision:rawP,model10Precision:modelP,model10:model.map(x=>x.code)});
 }
 console.log('RESULT',JSON.stringify({
   periods:out.length,
   model10Precision:mean(out.map(x=>x.model10Precision)),
   rawMOM10Precision:mean(out.map(x=>x.rawMOM10Precision)),
   gatePrecision:mean(out.map(x=>x.gatePrecision)),
   deltaModelVsRaw10:mean(diffModelVsRaw),pVsRaw10:signPerm(diffModelVsRaw),ciVsRaw10:boot(diffModelVsRaw),
   deltaModelVsGate:mean(diffModelVsGate),pVsGate:signPerm(diffModelVsGate),ciVsGate:boot(diffModelVsGate),
   byDate:out
 }));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
