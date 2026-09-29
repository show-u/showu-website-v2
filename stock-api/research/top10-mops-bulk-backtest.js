
const API='https://api.finmindtrade.com/api/v4/data';
const START='2020-01-01',END='2026-09-24',H=84;
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const sd=a=>{const m=mean(a);return a.length?Math.sqrt(mean(a.map(x=>(x-m)**2))):null};
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function info(){
  const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');
  const r=await fetch(u);if(!r.ok)throw Error('info '+r.status);return (await r.json()).data||[];
}
async function fmPrice(id){
  for(let a=0;a<3;a++){
    const u=new URL(API);u.searchParams.set('dataset','TaiwanStockPrice');u.searchParams.set('data_id',id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);
    const r=await fetch(u);if(r.ok){const j=await r.json();return (j.data||[]).map(x=>({date:x.date,c:+x.close})).filter(x=>x.c>0).sort((a,b)=>a.date.localeCompare(b.date))}
    await sleep(250*(a+1));
  } return [];
}
async function yahoo(code,type){
  const suf=type==='twse'?'.TW':'.TWO',p1=Math.floor(Date.parse(START+'T00:00:00Z')/1000),p2=Math.floor(Date.parse('2026-09-26T00:00:00Z')/1000);
  const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suf+'?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';
  for(let a=0;a<3;a++){
    const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
    if(r.ok){const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],qq=x?.indicators?.quote?.[0],adj=x?.indicators?.adjclose?.[0]?.adjclose||qq?.close||[];return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),c:+adj[i]})).filter(z=>z.c>0)}
    await sleep(150*(a+1));
  } return [];
}
async function pool(items,limit,fn){const out=new Array(items.length);let idx=0;async function w(){while(true){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i],i)}catch(e){out[i]=null}}}await Promise.all(Array.from({length:limit},w));return out}
function pctRank(rows,key){const a=rows.map((x,i)=>[x[key],i]).filter(z=>Number.isFinite(z[0])).sort((a,b)=>a[0]-b[0]),o=new Array(rows.length).fill(null);for(let k=0;k<a.length;k++)o[a[k][1]]=a.length===1?1:k/(a.length-1);return o}

function parseCSV(text){
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean), out=[];
  function row(line){const a=[];let s='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){s+='"';i++}else q=!q}else if(ch===','&&!q){a.push(s);s=''}else s+=ch}a.push(s);return a}
  const h=row(lines[0]);
  for(let i=1;i<lines.length;i++){const r=row(lines[i]);if(r.length<h.length)continue;const o={};h.forEach((k,j)=>o[k]=r[j]);out.push(o)}
  return out;
}
async function revenueBulk(){
  const byCode=new Map();
  for(let roc=109;roc<=115;roc++){
    for(let m=1;m<=12;m++){
      if(roc===115&&m>8)break;
      for(const market of ['sii','otc']){
        const u='https://mopsov.twse.com.tw/nas/t21/'+market+'/t21sc03_'+roc+'_'+m+'.csv';
        const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
        if(!r.ok)continue;
        const text=new TextDecoder('utf-8').decode(await r.arrayBuffer());
        const rows=parseCSV(text);
        for(const x of rows){
          const code=(x['公司代號']||'').trim(); if(!/^[0-9]{4}$/.test(code))continue;
          const ym=x['資料年月']||'', mm=ym.match(/(\d{2,3})\/(\d{1,2})/); if(!mm)continue;
          const y=+mm[1]+1911, mo=+mm[2], rev=+(x['營業收入-當月營收']||'').replace(/,/g,'');
          if(!(rev>0))continue;
          if(!byCode.has(code))byCode.set(code,[]);
          byCode.get(code).push({y,m:mo,v:rev,knownDate:y+'-'+String(mo+1>12?1:mo+1).padStart(2,'0')+'-10'});
        }
      }
    }
  }
  for(const arr of byCode.values())arr.sort((a,b)=>(a.y*12+a.m)-(b.y*12+b.m));
  return byCode;
}
function revSignal(arr,date){
  if(!arr)return null;
  const d=new Date(date+'T00:00:00Z'), cutoffY=d.getUTCFullYear(),cutoffM=d.getUTCMonth()+1;
  const eligible=arr.filter(x=>x.y<cutoffY||(x.y===cutoffY&&x.m<=cutoffM-1)); // prior month only; conservative next-month knowledge
  if(!eligible.length)return null;
  const cur=eligible.at(-1), get=(Y,M)=>arr.find(x=>x.y===Y&&x.m===M)?.v??null, yoy=[];
  for(let k=0;k<13;k++){
    let M=cur.m-k,Y=cur.y;while(M<=0){M+=12;Y--}
    const v=get(Y,M),py=get(Y-1,M); if(!(v>0&&py>0))return null;
    yoy.push(v/py-1);
  }
  const hist=yoy.slice(1),s=sd(hist);
  return {revYoY:yoy[0],revAccel3:yoy[0]-mean(yoy.slice(1,4)),revZ12:s>1e-9?(yoy[0]-mean(hist))/s:null};
}
function perm(v,B=20000){if(!v.length)return null;let z=19790421;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const obs=mean(v);let e=0;for(let b=0;b<B;b++)if(mean(v.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function boot(v,B=10000){if(!v.length)return null;let z=4201979;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const a=[];for(let b=0;b<B;b++){const t=[];for(let i=0;i<v.length;i++)t.push(v[Math.floor(r()*v.length)]);a.push(mean(t))}return[q(a,.025),q(a,.975)]}
function summarize(arr,label){
  const v=arr.map(x=>x.delta), vm=arr.map(x=>x.deltaVsMOM20),p=arr.map(x=>x.precision);
  return{label,nDates:arr.length,avgUniverse:mean(arr.map(x=>x.universeN)),precision:mean(p),
    deltaVsUniverse:mean(v),positive:v.filter(x=>x>0).length/(v.length||1),p:perm(v),ci:boot(v),
    deltaVsMOM20:mean(vm),pVsMOM20:perm(vm),ciVsMOM20:boot(vm)};
}
(async()=>{
 console.log('PROTOCOL',JSON.stringify({
  objective:'Can a transparent Taiwan-localized method select exactly 10 stocks with out-of-sample value?',
  priceSignal:'6m-to-1m momentum, literature-grounded',
  TaiwanSignal:'standardized unexpected monthly revenue from official MOPS static bulk history',
  knowledgeRule:'only revenue for month t-1 or earlier is usable on date t; conservative no-lookahead',
  outcome:'future84 return >=20%',
  methods:['MOM10 full-universe','REV10 within MOM top20%','50/50 MOM+REV composite top10 within MOM top20%'],
  dates:'non-overlapping 84-trading-day grid',
  split:'2021-2023 vs 2024-2026; no tuning'
 }));
 const raw=await info(),latest=new Map();for(const x of raw){if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x)}
 const stocks=[...latest.values()];
 const px=(await pool(stocks,20,async s=>{let p=await yahoo(s.stock_id,s.type);if(p.length<400)p=await fmPrice(s.stock_id);if(p.length<400)return null;return{code:s.stock_id,name:s.stock_name,type:s.type,p,map:new Map(p.map((x,i)=>[x.date,i]))}})).filter(Boolean);
 console.log('PRICE_LOCK',JSON.stringify({requested:stocks.length,usable:px.length}));
 const rev=await revenueBulk();
 console.log('REVENUE_LOCK',JSON.stringify({codes:rev.size,first:[...rev.entries()].slice(0,3).map(([c,a])=>({code:c,n:a.length,first:a[0],last:a.at(-1)}))}));
 const anchor=[...px].sort((a,b)=>b.p.length-a.p.length)[0],cal=anchor.p.map(x=>x.date),dates=[];for(let i=300;i<cal.length-H;i+=84){const d=cal[i];if(d>='2021-08-01'&&d<='2026-01-31')dates.push(d)}console.log('DATES',JSON.stringify(dates));
 const methods={MOM20:[],MOM10:[],REV10:[],COMPOSITE10:[]},detail=[];
 for(const date of dates){
  const rows=[];
  for(const d of px){
   const i=d.map.get(date);if(i==null||i<252||!d.p[i+H])continue;
   const sig=revSignal(rev.get(d.code),date);if(!sig||!Number.isFinite(sig.revZ12))continue;
   rows.push({code:d.code,mom6:d.p[i-21].c/d.p[i-126].c-1,ret:d.p[i+H].c/d.p[i].c-1,...sig});
  }
  if(rows.length<800)continue;
  const momPct=pctRank(rows,'mom6');rows.forEach((x,i)=>x.momPct=momPct[i]);
  const universePrec=mean(rows.map(x=>x.ret>=.2?1:0));
  const mom10=[...rows].sort((a,b)=>b.mom6-a.mom6).slice(0,10),pool20=rows.filter(x=>x.momPct>=.8);
  const rp=pctRank(pool20,'revZ12'),mp=pctRank(pool20,'mom6');pool20.forEach((x,i)=>{x.rp=rp[i];x.mp=mp[i];x.comp=.5*x.rp+.5*x.mp});
  const rev10=[...pool20].sort((a,b)=>b.revZ12-a.revZ12).slice(0,10),comp10=[...pool20].sort((a,b)=>b.comp-a.comp).slice(0,10);
  const groups={MOM20:pool20,MOM10:mom10,REV10:rev10,COMPOSITE10:comp10},rec={date,n:rows.length,universePrec,groups:{}};
  const mom20Prec=mean(pool20.map(x=>x.ret>=.2?1:0));
  for(const [k,g] of Object.entries(groups)){
    const pr=mean(g.map(x=>x.ret>=.2?1:0)),delta=pr-universePrec,deltaVsMOM20=pr-mom20Prec;
    methods[k].push({date,universeN:rows.length,precision:pr,delta,deltaVsMOM20});
    rec.groups[k]={precision:pr,delta,deltaVsMOM20,codes:k==='MOM20'?[]:g.map(x=>x.code)};
  }
  detail.push(rec);
 }
 const res={all:{},early:{},late:{},detail};
 for(const k of Object.keys(methods)){res.all[k]=summarize(methods[k],k);res.early[k]=summarize(methods[k].filter(x=>x.date<'2024-01-01'),k);res.late[k]=summarize(methods[k].filter(x=>x.date>='2024-01-01'),k)}
 console.log('RESULT',JSON.stringify(res));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
