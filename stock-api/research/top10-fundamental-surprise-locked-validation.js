
const API='https://api.finmindtrade.com/api/v4/data';
const START='2013-01-01',END='2026-09-22',H=84;
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const sd=a=>{const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)))||1};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);return (await r.json()).data||[]}
async function fm(ds,id){for(let a=0;a<4;a++){const u=new URL(API);u.searchParams.set('dataset',ds);u.searchParams.set('data_id',id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);const r=await fetch(u);if(r.ok)return (await r.json()).data||[];await sleep(300*(a+1))}return[]}
async function yahoo(code,type){const suf=type==='twse'?'.TW':'.TWO',p1=Math.floor(Date.parse(START+'T00:00:00Z')/1000),p2=Math.floor(Date.parse('2026-09-23T00:00:00Z')/1000);const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suf+'?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';for(let a=0;a<3;a++){const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(r.ok){const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],qq=x?.indicators?.quote?.[0],adj=x?.indicators?.adjclose?.[0]?.adjclose||qq?.close||[];return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),c:+adj[i]})).filter(z=>z.c>0)}await sleep(150*(a+1))}return[]}
async function pool(items,limit,fn){const out=new Array(items.length);let idx=0;async function w(){while(1){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i])}catch{out[i]=null}}}await Promise.all(Array.from({length:limit},w));return out}
function rankPct(rows,key){const a=rows.filter(x=>Number.isFinite(x[key])).sort((x,y)=>x[key]-y[key]),m=new Map();a.forEach((x,i)=>m.set(x.code,i/(a.length-1||1)));return m}
function dateAdd(d,n){return new Date(new Date(d+'T00:00:00Z').getTime()+n*86400000).toISOString().slice(0,10)}
function revFeat(rows,date){const a=rows.filter(x=>(x.create_time||x.date)<=date&&+x.revenue>0).map(x=>({y:+x.revenue_year,m:+x.revenue_month,v:+x.revenue,ct:x.create_time||x.date})).sort((x,z)=>x.ct.localeCompare(z.ct));if(a.length<15)return null;const cur=a.at(-1),get=(Y,M)=>a.find(x=>x.y===Y&&x.m===M)?.v??null,ys=[];for(let k=0;k<13;k++){let M=cur.m-k,Y=cur.y;while(M<=0){M+=12;Y--}const v=get(Y,M),py=get(Y-1,M);if(!(v>0&&py>0))return null;ys.push(v/py-1)}return{revZ:(ys[0]-mean(ys.slice(1)))/sd(ys.slice(1))}}
function finFeat(rows,date){
 const cutoff=dateAdd(date,-70),a=rows.filter(x=>x.date<=cutoff),ds=[...new Set(a.map(x=>x.date))].sort();if(ds.length<5)return null;
 const d=ds.at(-1),py=String(+d.slice(0,4)-1)+d.slice(4),get=(D,t)=>{const z=a.find(x=>x.date===D&&x.type===t);return z?+z.value:null};
 const rev=get(d,'Revenue'),op=get(d,'OperatingIncome'),eps=get(d,'EPS'),rev0=get(py,'Revenue'),op0=get(py,'OperatingIncome'),eps0=get(py,'EPS');
 if(!(rev>0&&rev0>0&&Number.isFinite(op)&&Number.isFinite(op0)&&Number.isFinite(eps)&&Number.isFinite(eps0)))return null;
 const om=op/rev,om0=op0/rev0,opMarginDelta=om-om0,epsYoY=(eps-eps0)/(Math.abs(eps0)+0.1);
 return{opMarginDelta,epsYoY};
}
function perm(v,B=20000){let z=223344;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const obs=mean(v);let e=0;for(let b=0;b<B;b++)if(mean(v.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function quant(a,p){const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)}
function boot(v,B=10000){let z=443322;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const a=[];for(let b=0;b<B;b++){let s=0;for(let i=0;i<v.length;i++)s+=v[Math.floor(r()*v.length)];a.push(s/v.length)}return[quant(a,.025),quant(a,.975)]}
(async()=>{
 console.log('PROTOCOL',JSON.stringify({
   objective:'exact top10 discovery-validation using point-in-time revenue + quarterly fundamental surprise',
   universe:'current-listed historical cross-section; survivorship bias remains',
   gate:'MOM6 top20%',
   candidates:{
    r1:'70% MOM6 rank +30% revenue surprise z',
    r2:'60% MOM6 +20% revenue z +20% operating-margin YoY change',
    r3:'60% MOM6 +20% revenue z +20% EPS YoY change',
    r4:'50% MOM6 +20% revenue z +15% operating-margin change +15% EPS YoY change'
   },
   discovery:'2018-2021 choose highest mean top10 precision',
   validation:'2022-2025 locked winner, no retuning',
   outcome:'future84 >=20%'
 }));
 const raw=await info(),latest=new Map();for(const x of raw){if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x)}
 const stocks=[...latest.values()];
 const px=(await pool(stocks,22,async s=>{const p=await yahoo(s.stock_id,s.type);return p.length>=900?{s,p,map:new Map(p.map((x,i)=>[x.date,i]))}:null})).filter(Boolean);
 const cal=px.sort((a,b)=>b.p.length-a.p.length)[0].p.map(x=>x.date),dates=[];for(let i=300;i<cal.length-H;i+=84){const d=cal[i];if(d>='2015-01-01'&&d<='2026-01-31')dates.push(d)}
 const priceByDate=new Map(),union=new Set();
 for(const date of dates){const rows=[];for(const d of px){const i=d.map.get(date);if(i==null||i<126||!d.p[i+H])continue;rows.push({code:d.s.stock_id,date,mom6:d.p[i-21].c/d.p[i-126].c-1,ret:d.p[i+H].c/d.p[i].c-1})}rows.sort((a,b)=>b.mom6-a.mom6);const gate=rows.slice(0,Math.ceil(rows.length*.2));gate.forEach(x=>union.add(x.code));priceByDate.set(date,gate)}
 console.log('LOCK',JSON.stringify({priceN:px.length,dates:dates.length,gateUnion:union.size}));
 const dataMap=new Map(),fetched=await pool([...union],14,async code=>[code,await fm('TaiwanStockMonthRevenue',code),await fm('TaiwanStockFinancialStatements',code)]);for(const z of fetched.filter(Boolean))dataMap.set(z[0],{rev:z[1],fin:z[2]});
 const byDate=[];
 for(const date of dates){const g=[];for(const x of priceByDate.get(date)){const d=dataMap.get(x.code),rf=d?revFeat(d.rev,date):null,ff=d?finFeat(d.fin,date):null;if(rf&&ff)g.push({...x,...rf,...ff,win:x.ret>=.2})}if(g.length<100)continue;
   const pm=rankPct(g,'mom6'),rz=rankPct(g,'revZ'),ro=rankPct(g,'opMarginDelta'),re=rankPct(g,'epsYoY');
   const rules={
    raw:g.map(x=>({...x,score:pm.get(x.code)})),
    r1:g.map(x=>({...x,score:.7*pm.get(x.code)+.3*rz.get(x.code)})),
    r2:g.map(x=>({...x,score:.6*pm.get(x.code)+.2*rz.get(x.code)+.2*ro.get(x.code)})),
    r3:g.map(x=>({...x,score:.6*pm.get(x.code)+.2*rz.get(x.code)+.2*re.get(x.code)})),
    r4:g.map(x=>({...x,score:.5*pm.get(x.code)+.2*rz.get(x.code)+.15*ro.get(x.code)+.15*re.get(x.code)}))
   };
   const rec={date,gateN:g.length,gatePrecision:mean(g.map(x=>x.win?1:0)),rules:{}};
   for(const [k,a] of Object.entries(rules)){const s=[...a].sort((u,v)=>v.score-u.score).slice(0,10);rec.rules[k]={precision:mean(s.map(x=>x.win?1:0)),codes:s.map(x=>x.code)}}
   byDate.push(rec);
 }
 const disc=byDate.filter(x=>x.date>='2018-01-01'&&x.date<'2022-01-01'),val=byDate.filter(x=>x.date>='2022-01-01'),ks=['r1','r2','r3','r4'];
 const means=Object.fromEntries(ks.map(k=>[k,mean(disc.map(x=>x.rules[k].precision))])),best=[...ks].sort((a,b)=>means[b]-means[a]||a.localeCompare(b))[0];
 const dRaw=val.map(x=>x.rules[best].precision-x.rules.raw.precision),dGate=val.map(x=>x.rules[best].precision-x.gatePrecision);
 console.log('RESULT',JSON.stringify({discovery:{periods:disc.length,means,selected:best},validation:{periods:val.length,precision:mean(val.map(x=>x.rules[best].precision)),rawMOM10Precision:mean(val.map(x=>x.rules.raw.precision)),gatePrecision:mean(val.map(x=>x.gatePrecision)),deltaVsRaw10:mean(dRaw),pVsRaw10:perm(dRaw),ciVsRaw10:boot(dRaw),deltaVsGate:mean(dGate),pVsGate:perm(dGate),ciVsGate:boot(dGate)},byDate:val.map(x=>({date:x.date,gateN:x.gateN,gatePrecision:x.gatePrecision,raw:x.rules.raw.precision,selected:x.rules[best].precision,codes:x.rules[best].codes}))}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});

// rerun 2026-09-29
