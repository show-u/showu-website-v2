
const API='https://api.finmindtrade.com/api/v4/data';
const START='2013-01-01',END='2026-09-22',H=84;
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const sd=a=>{const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)))||1};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);return (await r.json()).data||[]}
async function fm(id){for(let a=0;a<4;a++){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockMonthRevenue');u.searchParams.set('data_id',id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);const r=await fetch(u);if(r.ok)return (await r.json()).data||[];await sleep(300*(a+1))}return[]}
async function yahoo(code,type){const suf=type==='twse'?'.TW':'.TWO',p1=Math.floor(Date.parse(START+'T00:00:00Z')/1000),p2=Math.floor(Date.parse('2026-09-23T00:00:00Z')/1000);const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suf+'?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';for(let a=0;a<3;a++){const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(r.ok){const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],qq=x?.indicators?.quote?.[0],adj=x?.indicators?.adjclose?.[0]?.adjclose||qq?.close||[];return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),c:+adj[i]})).filter(z=>z.c>0)}await sleep(150*(a+1))}return[]}
async function pool(items,limit,fn){const out=new Array(items.length);let idx=0;async function w(){while(1){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i])}catch{out[i]=null}}}await Promise.all(Array.from({length:limit},w));return out}
function rankPct(rows,key){const s=[...rows].sort((a,b)=>a[key]-b[key]);const m=new Map();s.forEach((x,i)=>m.set(x.code,i/(s.length-1||1)));return m}
function revFeat(rows,date){
 const a=rows.filter(x=>(x.create_time||x.date)<=date&&+x.revenue>0).map(x=>({y:+x.revenue_year,m:+x.revenue_month,v:+x.revenue,ct:x.create_time||x.date})).sort((x,z)=>x.ct.localeCompare(z.ct));if(a.length<15)return null;
 const cur=a.at(-1),get=(Y,M)=>a.find(x=>x.y===Y&&x.m===M)?.v??null,ys=[];
 for(let k=0;k<13;k++){let M=cur.m-k,Y=cur.y;while(M<=0){M+=12;Y--}const v=get(Y,M),py=get(Y-1,M);if(!(v>0&&py>0))return null;ys.push(v/py-1)}
 const latest=ys[0],prev3=ys.slice(1,4),hist=ys.slice(1);
 return{revYoY:latest,revAccel:latest-mean(prev3),revZ:(latest-mean(hist))/sd(hist)};
}
function perm(v,B=20000){let z=114477;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const obs=mean(v);let e=0;for(let b=0;b<B;b++)if(mean(v.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function quant(a,p){const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)}
function boot(v,B=10000){let z=774411;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const a=[];for(let b=0;b<B;b++){let s=0;for(let i=0;i<v.length;i++)s+=v[Math.floor(r()*v.length)];a.push(s/v.length)}return[quant(a,.025),quant(a,.975)]}
(async()=>{
 console.log('PROTOCOL',JSON.stringify({
  objective:'discover on 2018-2021 then lock and validate on 2022-2025 an exact top10 rule',
  universe:'current-listed TWSE/TPEx with sufficient historical data; survivorship caveat applies',
  gate:'MOM6 top20%',
  candidates:['MOM6+revAccel equal rank','MOM6+revYoY equal rank','MOM6+revZ equal rank','70% MOM6 +30% revZ','30% MOM6 +70% revZ'],
  selection:'highest discovery mean top10 precision; ties favor simpler/lower revZ weight',
  validation:'no retuning after discovery',
  outcome:'future84 >=20%'
 }));
 const raw=await info(),latest=new Map();for(const x of raw){if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x)}
 const stocks=[...latest.values()];
 const px=(await pool(stocks,22,async s=>{const p=await yahoo(s.stock_id,s.type);return p.length>=900?{s,p,map:new Map(p.map((x,i)=>[x.date,i]))}:null})).filter(Boolean);
 const cal=px.sort((a,b)=>b.p.length-a.p.length)[0].p.map(x=>x.date),dates=[];for(let i=300;i<cal.length-H;i+=84){const d=cal[i];if(d>='2015-01-01'&&d<='2026-01-31')dates.push(d)}
 const priceByDate=new Map(),union=new Set();
 for(const date of dates){const rows=[];for(const d of px){const i=d.map.get(date);if(i==null||i<126||!d.p[i+H])continue;rows.push({code:d.s.stock_id,date,mom6:d.p[i-21].c/d.p[i-126].c-1,ret:d.p[i+H].c/d.p[i].c-1})}rows.sort((a,b)=>b.mom6-a.mom6);const gate=rows.slice(0,Math.ceil(rows.length*.2));gate.forEach(x=>union.add(x.code));priceByDate.set(date,gate)}
 console.log('LOCK',JSON.stringify({priceN:px.length,dates:dates.length,gateUnion:union.size}));
 const rv=new Map(),fetched=await pool([...union],18,async code=>[code,await fm(code)]);for(const z of fetched.filter(Boolean))rv.set(z[0],z[1]);
 const byDate=[];
 for(const date of dates){const g=[];for(const x of priceByDate.get(date)){const f=revFeat(rv.get(x.code)||[],date);if(f)g.push({...x,...f,win:x.ret>=.2})}if(g.length<100)continue;
   const pm=rankPct(g,'mom6'),pa=rankPct(g,'revAccel'),py=rankPct(g,'revYoY'),pz=rankPct(g,'revZ');
   const rules={
    rawMOM:g.map(x=>({...x,score:pm.get(x.code)})),
    accel:g.map(x=>({...x,score:.5*pm.get(x.code)+.5*pa.get(x.code)})),
    yoy:g.map(x=>({...x,score:.5*pm.get(x.code)+.5*py.get(x.code)})),
    z50:g.map(x=>({...x,score:.5*pm.get(x.code)+.5*pz.get(x.code)})),
    z30:g.map(x=>({...x,score:.7*pm.get(x.code)+.3*pz.get(x.code)})),
    z70:g.map(x=>({...x,score:.3*pm.get(x.code)+.7*pz.get(x.code)}))
   };
   const rec={date,gateN:g.length,gatePrecision:mean(g.map(x=>x.win?1:0)),rules:{}};
   for(const [k,a] of Object.entries(rules)){const s=[...a].sort((u,v)=>v.score-u.score).slice(0,10);rec.rules[k]={precision:mean(s.map(x=>x.win?1:0)),codes:s.map(x=>x.code)}}
   byDate.push(rec);
 }
 const disc=byDate.filter(x=>x.date>='2018-01-01'&&x.date<'2022-01-01'),val=byDate.filter(x=>x.date>='2022-01-01');
 const candidates=['accel','yoy','z50','z30','z70'];
 const means=Object.fromEntries(candidates.map(k=>[k,mean(disc.map(x=>x.rules[k].precision))]));
 const order=['accel','yoy','z30','z50','z70'];
 const best=[...candidates].sort((a,b)=>means[b]-means[a]||(order.indexOf(a)-order.indexOf(b)))[0];
 const dRaw=val.map(x=>x.rules[best].precision-x.rules.rawMOM.precision),dGate=val.map(x=>x.rules[best].precision-x.gatePrecision);
 console.log('RESULT',JSON.stringify({
  discovery:{periods:disc.length,means,selected:best},
  validation:{periods:val.length,selected:best,precision:mean(val.map(x=>x.rules[best].precision)),rawMOM10Precision:mean(val.map(x=>x.rules.rawMOM.precision)),gatePrecision:mean(val.map(x=>x.gatePrecision)),deltaVsRaw10:mean(dRaw),pVsRaw10:perm(dRaw),ciVsRaw10:boot(dRaw),deltaVsGate:mean(dGate),pVsGate:perm(dGate),ciVsGate:boot(dGate)},
  byDate:val.map(x=>({date:x.date,gateN:x.gateN,gatePrecision:x.gatePrecision,raw:x.rules.rawMOM.precision,selected:x.rules[best].precision,codes:x.rules[best].codes}))
 }));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});

// rerun 2026-09-29
