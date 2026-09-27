
const API='https://api.finmindtrade.com/api/v4/data',START='2020-01-01',END='2026-09-22',H=84,TARGET=300,SEED=20260927;
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);return (await r.json()).data||[]}
async function fm(ds,id){for(let a=0;a<3;a++){const u=new URL(API);u.searchParams.set('dataset',ds);u.searchParams.set('data_id',id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);const r=await fetch(u);if(r.ok)return (await r.json()).data||[];await sleep(200*(a+1))}return[]}
async function yahoo(code,type){const suf=type==='twse'?'.TW':'.TWO',p1=Math.floor(Date.parse(START+'T00:00:00Z')/1000),p2=Math.floor(Date.parse('2026-09-23T00:00:00Z')/1000);const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suf+'?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';for(let a=0;a<3;a++){const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(r.ok){const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],qq=x?.indicators?.quote?.[0],adj=x?.indicators?.adjclose?.[0]?.adjclose||qq?.close||[];return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),c:+adj[i]})).filter(z=>z.c>0)}await sleep(150*(a+1))}return[]}
async function pool(items,limit,fn){const out=new Array(items.length);let idx=0;async function w(){while(1){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i])}catch{out[i]=null}}}await Promise.all(Array.from({length:limit},w));return out}
function pct(vals){const s=vals.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),o=new Array(vals.length);for(let k=0;k<s.length;k++)o[s[k][1]]=k/(s.length-1||1);return o}
function revFeat(rows,date){const a=rows.filter(x=>(x.create_time||x.date)<=date&&+x.revenue>0).map(x=>({y:+x.revenue_year,m:+x.revenue_month,v:+x.revenue,ct:x.create_time||x.date})).sort((x,z)=>x.ct.localeCompare(z.ct));if(!a.length)return null;const cur=a.at(-1),get=(Y,M)=>a.find(x=>x.y===Y&&x.m===M)?.v??null,ys=[];for(let k=0;k<4;k++){let M=cur.m-k,Y=cur.y;while(M<=0){M+=12;Y--}const v=get(Y,M),py=get(Y-1,M);if(!(v>0&&py>0))return null;ys.push(v/py-1)}return{revAccel:ys[0]-mean(ys.slice(1))}}
const pos=[
 /訂單|order backlog|backlog|能見度/i,
 /量產|mass production|放量|ramp[- ]?up/i,
 /擴產|新產能|capacity expansion|new capacity/i,
 /新客戶|new customer|design win/i,
 /新產品|new product|新品/i,
 /需求強|需求增加|strong demand|demand growth|供不應求/i,
 /上修|優於預期|raise[sd]? guidance|above expectation/i,
 /出貨成長|shipment growth|出貨增加/i
];
const neg=[
 /下修|lower guidance|below expectation/i,
 /需求疲弱|weak demand|demand weakness/i,
 /庫存調整|inventory correction/i,
 /延後|delay|postpone/i,
 /減產|production cut|capacity cut/i,
 /虧損|loss\b|損失/i,
 /衰退|decline|decrease/i,
 /不確定|uncertain/i
];
function cats(text,regs){return regs.map(r=>r.test(text)?1:0)}
function strip(h){return h.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ')}
const pageCache=new Map(),detailCache=new Map();
async function confList(code){
 if(pageCache.has(code))return pageCache.get(code);
 const r=await fetch('https://finmoconf.diveinvest.net/company/'+code,{headers:{'User-Agent':'Mozilla/5.0'}});if(!r.ok){pageCache.set(code,[]);return[]}
 const t=await r.text(),arr=[],re=new RegExp('href="(/presentation/[^"]+)"[\\\\s\\\\S]{0,5000}?https://mopsov\\\\.twse\\\\.com\\\\.tw/nas/STR/'+code+'(20\\\\d{6})M\\\\d{3}\\\\.pdf','g');let m;
 while((m=re.exec(t))){const d=m[2].slice(0,4)+'-'+m[2].slice(4,6)+'-'+m[2].slice(6,8);if(!arr.some(x=>x.path===m[1]))arr.push({path:m[1],date:d})}
 arr.sort((a,b)=>a.date.localeCompare(b.date));pageCache.set(code,arr);return arr;
}
async function detail(path){
 if(detailCache.has(path))return detailCache.get(path);
 const r=await fetch('https://finmoconf.diveinvest.net'+path,{headers:{'User-Agent':'Mozilla/5.0'}});const t=r.ok?strip(await r.text()):'';detailCache.set(path,t);return t;
}
async function eventScore(code,date){
 const ls=await confList(code),eligible=ls.filter(x=>x.date<=date);if(!eligible.length)return null;
 const latest=eligible.at(-1),prev=eligible.length>1?eligible.at(-2):null;
 const age=(new Date(date)-new Date(latest.date))/86400000;if(age>240)return null;
 const a=await detail(latest.path),b=prev?await detail(prev.path):'';
 const pa=cats(a,pos),pb=cats(b,pos),na=cats(a,neg),nb=cats(b,neg);
 const newPos=pa.reduce((s,x,i)=>s+Math.max(0,x-pb[i]),0),newNeg=na.reduce((s,x,i)=>s+Math.max(0,x-nb[i]),0);
 const levelPos=pa.reduce((s,x)=>s+x,0),levelNeg=na.reduce((s,x)=>s+x,0);
 return {score:2*(newPos-newNeg)+(levelPos-levelNeg)*0.25,newPos,newNeg,levelPos,levelNeg,latest:latest.date,hasPrev:!!prev};
}
function perm(v,B=20000){let z=123987;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const obs=mean(v);let e=0;for(let b=0;b<B;b++)if(mean(v.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function boot(v,B=10000){let z=789321;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const a=[];for(let b=0;b<B;b++){const t=[];for(let i=0;i<v.length;i++)t.push(v[Math.floor(r()*v.length)]);a.push(mean(t))}return[q(a,.025),q(a,.975)]}
(async()=>{
 console.log('PROTOCOL',JSON.stringify({base:'MOM6 top20 + revenue acceleration top33',eventScore:'new positive/negative operating-event categories in latest investor presentation vs prior presentation, fixed before outcome review',cuts:['top50','top25','top10','score>=2'],horizon:'84 trading days +20% winner',dates:'non-overlapping'}));
 const raw=await info(),latest=new Map();for(const x of raw){if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x)}
 const rr=rng(SEED),cand=[...latest.values()].sort(()=>rr()-.5).slice(0,650);
 const data=(await pool(cand,18,async s=>{const [p,rev]=await Promise.all([yahoo(s.stock_id,s.type),fm('TaiwanStockMonthRevenue',s.stock_id)]);return p.length>=900&&rev.length>=36?{s,p,map:new Map(p.map((x,i)=>[x.date,i])),rev}:null})).filter(Boolean).slice(0,TARGET);
 console.log('LOCK',JSON.stringify({n:data.length,codes:data.map(x=>x.s.stock_id)}));
 const cal=data[0].p.map(x=>x.date),dates=[];for(let i=300;i<cal.length-H;i+=84){const d=cal[i];if(d>='2021-08-01'&&d<='2026-01-31')dates.push(d)}
 const names=['top50','top25','top10','score2'],delta={},prec={},cnt={};for(const n of names){delta[n]=[];prec[n]=[];cnt[n]=[]}
 const out=[];
 for(const date of dates){
  const rows=[];for(const d of data){const i=d.map.get(date);if(i==null||i<126||!d.p[i+H])continue;const rf=revFeat(d.rev,date);if(!rf)continue;rows.push({code:d.s.stock_id,mom:d.p[i-21].c/d.p[i-126].c-1,ret:d.p[i+H].c/d.p[i].c-1,...rf})}
  if(rows.length<200)continue;const mp=pct(rows.map(x=>x.mom));rows.forEach((x,i)=>x.mp=mp[i]);const mom=rows.filter(x=>x.mp>=.8),ac=q(mom.map(x=>x.revAccel),.67),base=mom.filter(x=>x.revAccel>=ac);if(base.length<15)continue;
  const withEv=(await pool(base,8,async x=>{const e=await eventScore(x.code,date);return e?{...x,...e}:null})).filter(Boolean);if(withEv.length<6)continue;
  const basePrec=mean(withEv.map(x=>x.ret>=.2?1:0)),scores=withEv.map(x=>x.score),c50=q(scores,.5),c75=q(scores,.75),c90=q(scores,.9);
  const groups={top50:withEv.filter(x=>x.score>=c50),top25:withEv.filter(x=>x.score>=c75),top10:withEv.filter(x=>x.score>=c90),score2:withEv.filter(x=>x.score>=2)};
  const rec={date,baseN:base.length,eventN:withEv.length,basePrec,groups:{}};
  for(const n of names){const g=groups[n];if(g.length<2)continue;const p=mean(g.map(x=>x.ret>=.2?1:0));delta[n].push(p-basePrec);prec[n].push(p);cnt[n].push(g.length);rec.groups[n]={n:g.length,precision:p,delta:p-basePrec}}
  out.push(rec);
 }
 const summary={};for(const n of names){const v=delta[n];summary[n]={nDates:v.length,avgN:mean(cnt[n]),precision:mean(prec[n]),delta:mean(v),positive:v.filter(x=>x>0).length/(v.length||1),p:v.length?perm(v):null,ci:v.length?boot(v):null}}
 console.log('RESULT',JSON.stringify({summary,byDate:out,cache:{companies:pageCache.size,presentations:detailCache.size}}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
