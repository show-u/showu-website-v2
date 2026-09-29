
const API='https://api.finmindtrade.com/api/v4/data';
const START='2020-01-01', END='2026-09-24', H=84;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const sd=a=>{const m=mean(a);return a.length?Math.sqrt(mean(a.map(x=>(x-m)**2))):null};
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};

async function info(){
  const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');
  const r=await fetch(u);if(!r.ok)throw Error('info '+r.status);return (await r.json()).data||[];
}
async function fm(ds,id,start=START,end=END){
  for(let a=0;a<4;a++){
    const u=new URL(API);u.searchParams.set('dataset',ds);u.searchParams.set('data_id',id);
    u.searchParams.set('start_date',start);u.searchParams.set('end_date',end);
    const r=await fetch(u);
    if(r.ok)return (await r.json()).data||[];
    await sleep(300*(a+1));
  } return [];
}
async function yahoo(code,type){
  const suf=type==='twse'?'.TW':'.TWO';
  const p1=Math.floor(Date.parse(START+'T00:00:00Z')/1000),p2=Math.floor(Date.parse('2026-09-26T00:00:00Z')/1000);
  const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suf+'?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';
  for(let a=0;a<3;a++){
    const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
    if(r.ok){
      const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],qq=x?.indicators?.quote?.[0],
        adj=x?.indicators?.adjclose?.[0]?.adjclose||qq?.close||[];
      return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),c:+adj[i]})).filter(z=>z.c>0);
    }
    await sleep(180*(a+1));
  }
  return [];
}
async function pool(items,limit,fn){
  const out=new Array(items.length);let idx=0;
  async function w(){while(true){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i],i)}catch(e){out[i]=null}}}
  await Promise.all(Array.from({length:limit},w));return out;
}
function pctRank(rows,key){
  const a=rows.map((x,i)=>[x[key],i]).filter(z=>Number.isFinite(z[0])).sort((a,b)=>a[0]-b[0]),o=new Array(rows.length).fill(null);
  for(let k=0;k<a.length;k++)o[a[k][1]]=a.length===1?1:k/(a.length-1);
  return o;
}
function revSignal(rows,date){
  const a=rows.filter(x=>(x.create_time||x.date)<=date&&+x.revenue>0)
   .map(x=>({y:+x.revenue_year,m:+x.revenue_month,v:+x.revenue,ct:x.create_time||x.date}))
   .sort((x,z)=>x.ct.localeCompare(z.ct));
  if(!a.length)return null;
  const cur=a.at(-1),get=(Y,M)=>a.find(x=>x.y===Y&&x.m===M)?.v??null, yoy=[];
  for(let k=0;k<13;k++){
    let M=cur.m-k,Y=cur.y;while(M<=0){M+=12;Y--}
    const v=get(Y,M),py=get(Y-1,M); if(!(v>0&&py>0)) return null;
    yoy.push(v/py-1);
  }
  const hist=yoy.slice(1),s=sd(hist);
  return {revYoY:yoy[0],revAccel3:yoy[0]-mean(yoy.slice(1,4)),revZ12:s>1e-9?(yoy[0]-mean(hist))/s:null};
}
function perm(v,B=20000){
  if(!v.length)return null;let z=19790421;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};
  const obs=mean(v);let e=0;for(let b=0;b<B;b++)if(mean(v.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1);
}
function boot(v,B=10000){
  if(!v.length)return null;let z=4201979;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};
  const a=[];for(let b=0;b<B;b++){const t=[];for(let i=0;i<v.length;i++)t.push(v[Math.floor(r()*v.length)]);a.push(mean(t))}
  return[q(a,.025),q(a,.975)];
}
function summarize(perDate,label){
  const v=perDate.map(x=>x.delta), p=perDate.map(x=>x.precision), n=perDate.map(x=>x.selectedN);
  return {label,nDates:v.length,avgSelected:mean(n),precision:mean(p),deltaVsUniverse:mean(v),positive:v.filter(x=>x>0).length/(v.length||1),p:perm(v),ci:boot(v)};
}
(async()=>{
  console.log('PROTOCOL',JSON.stringify({
    objective:'Test whether a transparent literature-grounded ranking can select exactly 10 Taiwan stocks',
    universe:'TWSE+TPEx ordinary 4-digit stocks from TaiwanStockInfo; price history from Yahoo adjusted where available',
    dates:'non-overlapping 84-trading-day grid, 2021-2026',
    outcome:'future 84 trading-day return >=20%',
    methods:{
      MOM10:'top 10 by 6m-to-1m momentum in full eligible universe',
      REV10:'within MOM6 top20%, top 10 by 12m standardized unexpected monthly revenue',
      COMPOSITE10:'within MOM6 top20%, top 10 by equal-weight percentile of MOM6 and revZ12'
    },
    split:'2021-2023 and 2024-2026 reported separately; no parameter tuning after results'
  }));

  const raw=await info(), latest=new Map();
  for(const x of raw){
    if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;
    const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x);
  }
  const stocks=[...latest.values()];
  const px=(await pool(stocks,20,async s=>{
    let p=await yahoo(s.stock_id,s.type);
    if(p.length<400){
      const f=await fm('TaiwanStockPrice',s.stock_id,START,END);
      p=f.map(x=>({date:x.date,c:+x.close})).filter(x=>x.c>0).sort((a,b)=>a.date.localeCompare(b.date));
    }
    if(p.length<400)return null;
    return {code:s.stock_id,name:s.stock_name,type:s.type,p,map:new Map(p.map((x,i)=>[x.date,i]))};
  })).filter(Boolean);

  console.log('PRICE_LOCK',JSON.stringify({requested:stocks.length,usable:px.length}));

  const revData=await pool(px,12,async d=>{
    const rev=await fm('TaiwanStockMonthRevenue',d.code,START,END);
    return {...d,rev};
  });
  const data=revData.filter(x=>x.rev.length>=24);
  console.log('REVENUE_LOCK',JSON.stringify({requested:px.length,usable:data.length}));

  // use a liquid long-history calendar anchor; any stock with sufficient dates can serve only to define spaced dates
  const anchor=[...data].sort((a,b)=>b.p.length-a.p.length)[0];
  const cal=anchor.p.map(x=>x.date),dates=[];
  for(let i=300;i<cal.length-H;i+=84){const d=cal[i];if(d>='2021-08-01'&&d<='2026-01-31')dates.push(d)}
  console.log('DATES',JSON.stringify(dates));

  const methods={MOM10:[],REV10:[],COMPOSITE10:[]}, detail=[];
  for(const date of dates){
    const rows=[];
    for(const d of data){
      const i=d.map.get(date); if(i==null||i<252||!d.p[i+H]) continue;
      const sig=revSignal(d.rev,date); if(!sig||!Number.isFinite(sig.revZ12)) continue;
      const mom6=d.p[i-21].c/d.p[i-126].c-1;
      const ret=d.p[i+H].c/d.p[i].c-1;
      rows.push({code:d.code,mom6,ret,...sig});
    }
    if(rows.length<500) continue;
    const mp=pctRank(rows,'mom6'); rows.forEach((x,i)=>x.momPct=mp[i]);
    const universePrec=mean(rows.map(x=>x.ret>=.2?1:0));

    const mom10=[...rows].sort((a,b)=>b.mom6-a.mom6).slice(0,10);
    const pool20=rows.filter(x=>x.momPct>=.8);
    const rz=pctRank(pool20,'revZ12'), mm=pctRank(pool20,'mom6');
    pool20.forEach((x,i)=>{x.revPct=rz[i];x.momPct2=mm[i];x.comp=.5*x.revPct+.5*x.momPct2});
    const rev10=[...pool20].sort((a,b)=>b.revZ12-a.revZ12).slice(0,10);
    const comp10=[...pool20].sort((a,b)=>b.comp-a.comp).slice(0,10);

    const groups={MOM10:mom10,REV10:rev10,COMPOSITE10:comp10},rec={date,n:rows.length,universePrec,groups:{}};
    for(const [k,g] of Object.entries(groups)){
      const pr=mean(g.map(x=>x.ret>=.2?1:0)),delta=pr-universePrec;
      methods[k].push({date,selectedN:g.length,precision:pr,delta});
      rec.groups[k]={precision:pr,delta,codes:g.map(x=>x.code)};
    }
    detail.push(rec);
  }

  const split=(arr,which)=>arr.filter(x=>which==='early'?x.date<'2024-01-01':x.date>='2024-01-01');
  const result={all:{},early:{},late:{},detail};
  for(const k of Object.keys(methods)){
    result.all[k]=summarize(methods[k],k);
    result.early[k]=summarize(split(methods[k],'early'),k);
    result.late[k]=summarize(split(methods[k],'late'),k);
  }
  console.log('RESULT',JSON.stringify(result));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
