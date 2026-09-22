const stocks=[
  {code:'2330',name:'台積電'},
  {code:'2454',name:'聯發科'},
  {code:'2409',name:'友達'},
  {code:'2881',name:'富邦金'},
  {code:'1301',name:'台塑'}
];
const START='2022-01-01';
const END='2026-09-22';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const n=x=>{const v=Number(String(x??'').replaceAll(',','').replace(/[+X]/g,''));return Number.isFinite(v)?v:null};
function roc(s){const m=String(s).match(/^(\d{3})\/(\d{2})\/(\d{2})$/);return m?(Number(m[1])+1911)+'-'+m[2]+'-'+m[3]:s}
function months(a,b){const A=new Date(a),B=new Date(b),out=[];let d=new Date(A.getFullYear(),A.getMonth(),1);while(d<=B){out.push(String(d.getFullYear())+String(d.getMonth()+1).padStart(2,'0')+'01');d.setMonth(d.getMonth()+1)}return out}
async function json(url){
  for(let k=0;k<4;k++){
    const r=await fetch(url,{headers:{'user-agent':'showu-research/1.0'}});
    if(r.ok){try{return await r.json()}catch{}}
    await sleep(500*(k+1));
  }
  throw Error('fetch failed '+url);
}
async function pool(items,worker,concurrency=3){
  const out=new Array(items.length); let next=0;
  async function run(){while(true){const i=next++;if(i>=items.length)return;out[i]=await worker(items[i],i)}}
  await Promise.all(Array.from({length:concurrency},run)); return out;
}
async function stockBars(code){
  const chunks=await pool(months(START,END),async date=>{
    const urls=[
      'https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?response=json&date='+date+'&stockNo='+code,
      'https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date='+date+'&stockNo='+code
    ];
    let j=null;
    for(const u of urls){
      try{const x=await json(u);if(Array.isArray(x?.data)){j=x;break}}catch(e){}
    }
    if(!j){console.log('WARN stock month failed',code,date);return []}
    return (j.data||[]).map(r=>{
      const o=n(r[3]),h=n(r[4]),l=n(r[5]),c=n(r[6]),v=n(r[1]);
      return [o,h,l,c,v].every(Number.isFinite)?{date:roc(r[0]),o,h,l,c,v}:null;
    }).filter(Boolean);
  },3);
  const out=chunks.flat();
  return [...new Map(out.map(x=>[x.date,x])).values()].sort((a,b)=>a.date.localeCompare(b.date));
}
async function taiexBars(){
  const chunks=await pool(months(START,END),async date=>{
    try{
      const j=await json('https://www.twse.com.tw/indicesReport/MI_5MINS_HIST?response=json&date='+date);
      return (j.data||[]).map(r=>{const c=n(r[4]);return Number.isFinite(c)?{date:roc(r[0]),c}:null}).filter(Boolean);
    }catch(e){console.log('WARN taiex month failed',date);return []}
  },3);
  const out=chunks.flat();
  return [...new Map(out.map(x=>[x.date,x])).values()].sort((a,b)=>a.date.localeCompare(b.date));
}
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const pct=(a,x)=>a.length?a.filter(v=>v<=x).length/a.length:null;
const ret=(a,i,k)=>i>=k?a[i].c/a[i-k].c-1:null;
const rv=(a,i,k=20)=>{if(i<k)return null;const rs=[];for(let j=i-k+1;j<=i;j++){if(j<1)continue;rs.push(Math.log(a[j].c/a[j-1].c))}const m=mean(rs);return Math.sqrt(mean(rs.map(x=>(x-m)**2)))*Math.sqrt(252)};
function taiexMap(b){
  const m=new Map();
  for(let i=0;i<b.length;i++){
    if(i<120)continue;
    const ma120=mean(b.slice(i-119,i+1).map(x=>x.c));
    const vol=rv(b,i,20);
    const hist=[];for(let j=Math.max(120,i-119);j<=i;j++){const z=rv(b,j,20);if(Number.isFinite(z))hist.push(z)}
    const med=median(hist);
    m.set(b[i].date,{trend:b[i].c>=ma120?'UP':'DOWN',vol:Number.isFinite(vol)&&Number.isFinite(med)&&vol>=med?'HIGHVOL':'LOWVOL'});
  }
  return m;
}
function features(b,tm){
  const rows=[];
  for(let i=252;i<b.length-20;i++){
    const r20=ret(b,i,20), r5=ret(b,i,5);
    const r20hist=[]; for(let j=i-251;j<i;j++){const x=ret(b,j,20);if(Number.isFinite(x))r20hist.push(x)}
    const pr=pct(r20hist,r20);
    const mstate=pr>=.8?'MOM_UP':pr<=.2?'MOM_DOWN':'MID';
    const v5=mean(b.slice(i-4,i+1).map(x=>x.v));
    const ratios=[];
    for(let j=i-119;j<i;j++){
      if(j<59)continue;
      const a5=mean(b.slice(j-4,j+1).map(x=>x.v));
      const med60=median(b.slice(j-59,j+1).map(x=>x.v));
      if(Number.isFinite(a5)&&Number.isFinite(med60)&&med60>0)ratios.push(a5/med60);
    }
    const med60=median(b.slice(i-59,i+1).map(x=>x.v));
    const vint=v5/med60;
    const vp=pct(ratios,vint);
    const vstate=vp>=.8?'VOL_HIGH':vp<=.2?'VOL_LOW':'VOL_MID';
    const market=tm.get(b[i].date);
    if(!market)continue;
    const f10=b[i+10].c/b[i].c-1;
    rows.push({date:b[i].date,r20,r5,mstate,vstate,market:market.trend+'_'+market.vol,f10,positive:f10>0});
  }
  return rows;
}
function summarize(rows){
  const groups={};
  for(const x of rows){
    const k=x.mstate+'|'+x.vstate+'|'+x.market;
    (groups[k]??=[]).push(x);
  }
  return Object.fromEntries(Object.entries(groups).map(([k,a])=>[k,{
    n:a.length,hit:a.filter(x=>x.positive).length/a.length,avg:mean(a.map(x=>x.f10)),med:median(a.map(x=>x.f10))
  }]));
}
(async()=>{
  console.log('FIXED SPEC before results:');
  console.log(JSON.stringify({
    sample:[START,END],
    momentum:'20d return percentile vs own trailing 252 observations: >=80% MOM_UP, <=20% MOM_DOWN',
    activity:'5d avg volume / trailing-60d median volume; percentile vs trailing 120 observations: >=80% high, <=20% low',
    regime:'TAIEX close vs MA120 x 20d realized vol vs trailing-120 median',
    target:'forward 10 trading-day return > 0',
    note:'activity is NOT true turnover; pilot proxy only'
  },null,2));
  const taiex=await taiexBars();
  console.log('TAIEX bars',taiex.length,taiex[0]?.date,taiex.at(-1)?.date);
  const tm=taiexMap(taiex);
  const all=[];
  for(const s of stocks){
    const b=await stockBars(s.code);
    const rows=features(b,tm);
    const cur=rows.at(-1);
    console.log('\nSTOCK',s.code,s.name,'bars',b.length,'events',rows.length);
    console.log('LATEST FEATURE',JSON.stringify(cur));
    const g=summarize(rows);
    const key=cur?(cur.mstate+'|'+cur.vstate+'|'+cur.market):null;
    console.log('CURRENT-STATE HIST',key,JSON.stringify(key?g[key]:null));
    for(const r of rows) all.push({...r,code:s.code,name:s.name});
  }
  const gs=summarize(all);
  console.log('\nAGGREGATED CURRENT-STATE ANALOGS');
  for(const s of stocks){
    const rows=all.filter(x=>x.code===s.code);
    const cur=rows.at(-1);
    const key=cur?(cur.mstate+'|'+cur.vstate+'|'+cur.market):null;
    console.log(s.code,s.name,key,JSON.stringify(key?gs[key]:null));
  }
  console.log('\nBASELINE',JSON.stringify({
    n:all.length,
    hit:all.filter(x=>x.positive).length/all.length,
    avg:mean(all.map(x=>x.f10)),
    med:median(all.map(x=>x.f10))
  }));
})().catch(e=>{console.error(e);process.exit(1)});
