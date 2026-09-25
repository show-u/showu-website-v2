
const API='https://api.finmindtrade.com/api/v4/data';
const START='2020-01-01',END='2026-09-22',H=84,TARGET=100,SEED=20260925;
const USED=new Set(["1218","1337","1419","1467","1538","1560","1569","1580","1591","1587","1603","1626","1702","1711","1712","1727","1733","1742","1736","1781","1783","1788","1796","2206","2301","2347","2353","2371","2401","2433","2459","2548","2597","2618","2702","2712","2719","2722","2729","2734","2745","2756","2838","2901","2938","2945","2947","3027","3067","3088","3130","3169","3202","3218","3323","3479","3489","3501","3522","3551","3555","3592","3629","3653","3669","3693","3705","3712","3713","4109","4116","4120","4121","4123","4139","4148","4162","4163","4303","4420","4541","4543","4557","4563","4568","4706","4903","4956","4961","4966","4967","4968","4973","4976","4987","4991","4994","4999","5011","5015","5211","5225","5228","5243","5244","5245","5251","5269","5274","5276","5278","5287","5288","5299","5312","5321","5328","5364","5371","5386","5432","5438","5452","5455","5464","5489","5498","5511","5529","5531","5548","5609","5701","5706","5876","5902","6020","6028","6101","6121","6124","6138","6140","6144","6148","6150","6169","6170","6175","6182","6185","6188","6189","6194","6205","6207","6208","6209","6215","6216","6217","6219","6220","6221","6241","6242","6245","6263","6266","6277","6291","6292","6414","6417","6418","6419","6423","6441","6449","6465","6474","6491","6499","6508","6510","6514","6516","6527","6533","6546","6558","6561","6568","6569","6570","6574","6576","6579","6603","6624","6666","6690","6692","6720","6743","6756","6761","6763","6776","6789","6830","6870","6873","6903","8027","8028","8032","8038","8040","8046","8064","8067","8072","8084","8085","8087","8093","8097","8099","8103","8104","8107","8109","8111","8112","8147","8150","8182","8183","8213","8215","8255","8291","8341","8342","8349","8358","8390","8401","8403","8404","8415","8416","8420","8421","8423","8424","8429","8431","8432","8433","8435","8467","8472","8481","8482","8908","8916","8927","8928","8931","8932","8935","8936","8938","9103","9105","9110","9905","9927","9929","9933","9939","9941","9945","9949","9950","9951","9958","9960","9962"]);
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const q=(a,p)=>{const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fm(ds,id){for(let a=0;a<4;a++){const u=new URL(API);u.searchParams.set('dataset',ds);if(id)u.searchParams.set('data_id',id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);const r=await fetch(u);if(r.ok)return (await r.json()).data||[];await sleep(400*(a+1))}return[]}
async function yahoo(code,type){
 const suffix=type==='twse'?'.TW':'.TWO',p1=Math.floor(Date.parse(START+'T00:00:00Z')/1000),p2=Math.floor(Date.parse('2026-09-23T00:00:00Z')/1000);
 const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suffix+'?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';
 for(let a=0;a<3;a++){const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(r.ok){const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],q=x?.indicators?.quote?.[0],adj=x?.indicators?.adjclose?.[0]?.adjclose||q?.close||[];return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),close:+adj[i],Trading_money:(+q.volume?.[i]||0)*(+q.close?.[i]||0)})).filter(z=>z.close>0)}await sleep(250*(a+1))}return[];
}
async function pool(items,limit,fn){const out=new Array(items.length);let idx=0;async function w(){while(true){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i])}catch{out[i]=null}}}await Promise.all(Array.from({length:limit},w));return out}
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);return (await r.json()).data||[]}
function P(rows){return rows.map(x=>({date:x.date,c:+x.close,m:+x.Trading_money||0})).filter(x=>x.c>0).sort((a,b)=>a.date.localeCompare(b.date))}
function pct(vals){const s=vals.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),o=new Array(vals.length);for(let k=0;k<s.length;k++)o[s[k][1]]=k/(s.length-1||1);return o}
function perm(v,B=20000){let z=123456;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const obs=mean(v);let e=0;for(let b=0;b<B;b++)if(mean(v.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function boot(v,B=10000){let z=654321;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const a=[];for(let b=0;b<B;b++){const t=[];for(let i=0;i<v.length;i++)t.push(v[Math.floor(r()*v.length)]);a.push(mean(t))}return[q(a,.025),q(a,.975)]}
function feats(p,i){
 if(i<252)return null;
 const mom6=p[i-21].c/p[i-126].c-1;
 const mom3=p[i-21].c/p[i-63].c-1;
 const mom12=p[i-21].c/p[i-252].c-1;
 const mom6Prev=p[i-42].c/p[i-147].c-1;
 const accel=mom6-mom6Prev;
 const high252=Math.max(...p.slice(i-251,i+1).map(x=>x.c)),highProx=p[i].c/high252;
 const r=[];for(let j=i-125;j<=i;j++)r.push(p[j].c/p[j-1].c-1);
 const posShare=r.filter(x=>x>0).length/r.length;
 const vol20=mean(p.slice(i-19,i+1).map(x=>x.m));
 return{mom6,mom3,mom12,accel,highProx,posShare,vol20};
}
(async()=>{
 console.log('PROTOCOL',JSON.stringify({
 objective:'Find stock-level discriminators that add value inside MOM6 top20, not broad sector direction',
 fresh:'100 never-before-used current stocks plus delistings where price history exists',
 dates:'non-overlapping ~84 trading-day grid',
 outcome:'future84 return >=20%',
 lockedFeatures:['MOM6 level','MOM3','MOM12','MOM6 acceleration','52-week-high proximity','positive-day share'],
 test:'Within MOM6 top20, compare top half of each feature against all MOM6 top20; no tuning'
 }));
 const raw=await info(),latest=new Map();for(const x of raw){if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||USED.has(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x)}
 const rr=rng(SEED),cand=[...latest.values()].sort(()=>rr()-.5),data={};
 const fetched=await pool(cand.slice(0,500),18,async s=>{const p=P(await yahoo(s.stock_id,s.type));return p.length>=900?{s,p}:null});
 for(const z of fetched.filter(Boolean)){if(Object.keys(data).length>=200)break;data[z.s.stock_id]={p:z.p,map:new Map(z.p.map((x,i)=>[x.date,i])),name:z.s.stock_name}}

 console.log('LOCK',JSON.stringify({fresh:Object.keys(data).length,codes:Object.keys(data)}));
 const base=data[Object.keys(data)[0]].p,cal=base.map(x=>x.date),pos=new Map(cal.map((d,i)=>[d,i])),dates=[];for(let i=300;i<cal.length-H;i+=84){const d=cal[i];if(d>='2021-06-01'&&d<='2026-04-30')dates.push(d)}console.log('DATES',JSON.stringify(dates));
 const keys=['mom6','mom3','mom12','accel','highProx','posShare'],diff={};keys.forEach(k=>diff[k]=[]);const rowsOut=[];
 for(const date of dates){
  const rows=[];for(const [code,d] of Object.entries(data)){const i=d.map.get(date);if(i==null||i<252||!d.p[i+H])continue;const f=feats(d.p,i);if(!f)continue;rows.push({code,...f,ret:d.p[i+H].c/d.p[i].c-1})}
  if(rows.length<60)continue;
  const mr=pct(rows.map(x=>x.mom6));rows.forEach((x,i)=>x.momPct=mr[i]);const mom=rows.filter(x=>x.momPct>=.8);if(mom.length<10)continue;
  const basePrec=mean(mom.map(x=>x.ret>=.2?1:0)), rec={date,n:rows.length,momN:mom.length,basePrec};
  for(const k of keys){
   const vals=mom.map(x=>x[k]),med=q(vals,.5),sel=mom.filter(x=>x[k]>=med);const pr=mean(sel.map(x=>x.ret>=.2?1:0));diff[k].push(pr-basePrec);rec[k]={n:sel.length,prec:pr,delta:pr-basePrec};
  }
  rowsOut.push(rec);
 }
 const summary={};for(const k of keys){const v=diff[k];summary[k]={n:v.length,delta:mean(v),positive:v.filter(x=>x>0).length/v.length,p:perm(v),ci:boot(v)}}
 console.log('RESULT',JSON.stringify({summary,byDate:rowsOut}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
