
const API='https://api.finmindtrade.com/api/v4/data';
const START='2020-01-01',END='2026-09-22',H=84,TARGET=180,SEED=20260927;
const PRIOR=new Set(["3095","6727","6861","6831","6698","2705","5450","8044","5209","2916","4971","6684","6754","4804","6443","6597","4745","6790","4439","8066","3276","6841","5014","8921","8201","8086","4763","3014","3288","4304","6807","3018","7547","2491","3034","4562","3029","9940","4440","2727","5487","5474","4942","6416","3037","3036","3017","3048","3011","6234","3504","3052","2645","8105","3296","6257","4438","4166","8039","5512","4977","4133","6488","8464","8409","5284","6505","8383","5493","5457","3022","6591","4532","3051","3512","3293","3297","5306","2605","9921","4432","8049","3019","3376","3047","3494","4807","3010","4572","5469","6226","3558","3260","2634","6703","3346","3338","3518","3577","8011","3158","2903","4737","6271","8930","3372","6446","3057","6122","8227","2379","3622","5203","2207","1414","1304","6203","4536","1583","6192","3537","4127","3321","6751","4430","2338","1464","2344","1617","1227","6733","1446","9902","3687","2376","3114","2633","5222","8299","4205","1718","3213","4736","6904","4129","2643","2489","6598","6196","3303","3005","5356","3115","1417","1468","3661","3438","3033","4974","5310","6425","2241","2374","2027","5601","8284","2915","3313","6531","6526","8088","9935","6674","6596","6158","6605","8367","3228","9919","2731"]);
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);return (await r.json()).data||[]}
async function fm(ds,id){for(let a=0;a<3;a++){const u=new URL(API);u.searchParams.set('dataset',ds);u.searchParams.set('data_id',id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);const r=await fetch(u);if(r.ok)return (await r.json()).data||[];await sleep(250*(a+1))}return[]}
async function yahoo(code,type){const suf=type==='twse'?'.TW':'.TWO',p1=Math.floor(Date.parse(START+'T00:00:00Z')/1000),p2=Math.floor(Date.parse('2026-09-23T00:00:00Z')/1000);const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suf+'?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';for(let a=0;a<3;a++){const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(r.ok){const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],qq=x?.indicators?.quote?.[0],adj=x?.indicators?.adjclose?.[0]?.adjclose||qq?.close||[];return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),c:+adj[i]})).filter(z=>z.c>0)}await sleep(150*(a+1))}return[]}
async function pool(items,limit,fn){const out=new Array(items.length);let idx=0;async function w(){while(1){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i])}catch{out[i]=null}}}await Promise.all(Array.from({length:limit},w));return out}
function pct(vals){const s=vals.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),o=new Array(vals.length);for(let k=0;k<s.length;k++)o[s[k][1]]=k/(s.length-1||1);return o}
function revSeq(rows,date){
 const a=rows.filter(x=>(x.create_time||x.date)<=date&&+x.revenue>0).map(x=>({y:+x.revenue_year,m:+x.revenue_month,v:+x.revenue,ct:x.create_time||x.date})).sort((x,z)=>x.ct.localeCompare(z.ct));
 if(!a.length)return null;const cur=a.at(-1),get=(Y,M)=>a.find(x=>x.y===Y&&x.m===M)?.v??null,out=[];
 for(let k=0;k<4;k++){let M=cur.m-k,Y=cur.y;while(M<=0){M+=12;Y--}const v=get(Y,M),py=get(Y-1,M);if(!(v>0&&py>0))return null;out.push(v/py-1)}
 const [y0,y1,y2,y3]=out;return{y0,y1,y2,y3,accel:y0-mean([y1,y2,y3]),up1:y0>y1,up2:y0>y1&&y1>y2,positive:y0>0,stable2:y0>y1&&y1>y2&&y0>0};
}
function perm(v,B=20000){let z=246810;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const obs=mean(v);let e=0;for(let b=0;b<B;b++)if(mean(v.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function boot(v,B=10000){let z=108642;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const a=[];for(let b=0;b<B;b++){const t=[];for(let i=0;i<v.length;i++)t.push(v[Math.floor(r()*v.length)]);a.push(mean(t))}return[q(a,.025),q(a,.975)]}
(async()=>{
 console.log('PROTOCOL',JSON.stringify({objective:'independent validation of revenue acceleration depth and stability inside MOM6 top20',rules:['accel top50%','accel top33%','accel top25%','latest YoY > previous month','two consecutive YoY accelerations','positive latest YoY + two consecutive accelerations'],outcome:'future84 >=20%',dates:'non-overlapping'}));
 const raw=await info(),latest=new Map();for(const x of raw){if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||PRIOR.has(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x)}
 const rr=rng(SEED),cand=[...latest.values()].sort(()=>rr()-.5).slice(0,500);
 const got=(await pool(cand,18,async s=>{const p=await yahoo(s.stock_id,s.type);if(p.length<900)return null;const rev=await fm('TaiwanStockMonthRevenue',s.stock_id);return rev.length>=36?{s,p,map:new Map(p.map((x,i)=>[x.date,i])),rev}:null})).filter(Boolean).slice(0,TARGET);
 console.log('LOCK',JSON.stringify({n:got.length,codes:got.map(x=>x.s.stock_id)}));
 const cal=got[0].p.map(x=>x.date),dates=[];for(let i=300;i<cal.length-H;i+=84){const d=cal[i];if(d>='2021-08-01'&&d<='2026-01-31')dates.push(d)}console.log('DATES',JSON.stringify(dates));
 const names=['top50','top33','top25','up1','up2','stable2'],delta={},prec={},cnt={};for(const n of names){delta[n]=[];prec[n]=[];cnt[n]=[]}
 const byDate=[];
 for(const date of dates){
  const rows=[];for(const d of got){const i=d.map.get(date);if(i==null||i<126||!d.p[i+H])continue;const f=revSeq(d.rev,date);if(!f)continue;rows.push({code:d.s.stock_id,mom:d.p[i-21].c/d.p[i-126].c-1,ret:d.p[i+H].c/d.p[i].c-1,...f})}
  if(rows.length<100)continue;const pr=pct(rows.map(x=>x.mom));rows.forEach((x,i)=>x.mp=pr[i]);const m=rows.filter(x=>x.mp>=.8);if(m.length<20)continue;const base=mean(m.map(x=>x.ret>=.2?1:0));
  const a=m.map(x=>x.accel),cuts={top50:q(a,.5),top33:q(a,.67),top25:q(a,.75)};
  const groups={top50:m.filter(x=>x.accel>=cuts.top50),top33:m.filter(x=>x.accel>=cuts.top33),top25:m.filter(x=>x.accel>=cuts.top25),up1:m.filter(x=>x.up1),up2:m.filter(x=>x.up2),stable2:m.filter(x=>x.stable2)};
  const rec={date,n:rows.length,momN:m.length,base,groups:{}};
  for(const n of names){const g=groups[n];if(g.length<4)continue;const p=mean(g.map(x=>x.ret>=.2?1:0));delta[n].push(p-base);prec[n].push(p);cnt[n].push(g.length);rec.groups[n]={n:g.length,precision:p,delta:p-base}}
  byDate.push(rec);
 }
 const summary={};for(const n of names){const v=delta[n];summary[n]={nDates:v.length,avgN:mean(cnt[n]),precision:mean(prec[n]),deltaVsMOM20:mean(v),positive:v.filter(x=>x>0).length/(v.length||1),p:v.length?perm(v):null,ci:v.length?boot(v):null}}
 console.log('RESULT',JSON.stringify({summary,byDate}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
