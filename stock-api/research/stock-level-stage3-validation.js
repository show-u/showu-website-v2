
const API='https://api.finmindtrade.com/api/v4/data';
const START='2020-01-01',END='2026-09-22',H=84,TARGET=100,SEED=20260925;
const USED=new Set(["1101","1102","1103","1236","1240","1264","1316","1339","1435","1437","1438","1443","1457","1460","1471","1473","1512","1530","1563","1586","1599","1615","1732","1780","2002","2008","2010","2025","2108","2109","2233","2243","2247","2308","2312","2316","2340","2342","2351","2352","2356","2367","2380","2387","2388","2390","2397","2399","2404","2412","2413","2424","2430","2434","2439","2454","2614","2646","2701","2704","2706","2707","2718","2723","2724","2726","2739","2836","2881","2885","2886","2889","2923","3085","3092","3178","3374","3430","3455","3466","3483","3484","3498","3516","3520","3523","3526","3527","3532","3533","3535","3541","3545","3546","3548","3567","3580","3581","3594","3617","3645","3680","3702","3703","3704","3707","4102","4142","4147","4154","4161","4168","4173","4402","4413","4417","4426","4433","4441","4503","4506","4510","4513","4529","4535","4550","4554","4561","4609","4711","4722","4735","4744","4746","4747","4749","4764","4904","4915","4930","4938","4943","4950","4960","4972","5215","5223","5227","5258","5285","5302","5443","5703","5878","5903","6005","6109","6112","6125","6177","6183","6186","6224","6225","6270","6278","6415","6442","6456","6464","6469","6492","6498","6532","6541","6550","6556","6573","6577","6590","6613","6671","6708","6715","6739","6794","6804","6811","6931","8034","8069","8114","8240","8374","8462","8478","9911","9914","9925","9934"].concat(["1218","1337","1419","1467","1538","1560","1569","1580","1591","1587","1603","1626","1702","1711","1712","1727","1733","1742","1736","1781","1783","1788","1796","2206","2301","2347","2353","2371","2401","2433","2459","2548","2597","2618","2702","2712","2719","2722","2729","2734","2745","2756","2838","2901","2938","2945","2947","3027","3067","3088","3130","3169","3202","3218","3323","3479","3489","3501","3522","3551","3555","3592","3629","3653","3669","3693","3705","3712","3713","4109","4116","4120","4121","4123","4139","4148","4162","4163","4303","4420","4541","4543","4557","4563","4568","4706","4903","4956","4961","4966","4967","4968","4973","4976","4987","4991","4994","4999","5011","5015","5211","5225","5228","5243","5244","5245","5251","5269","5274","5276","5278","5287","5288","5299","5312","5321","5328","5364","5371","5386","5432","5438","5452","5455","5464","5489","5498","5511","5529","5531","5548","5609","5701","5706","5876","5902","6020","6028","6101","6121","6124","6138","6140","6144","6148","6150","6169","6170","6175","6182","6185","6188","6189","6194","6205","6207","6208","6209","6215","6216","6217","6219","6220","6221","6241","6242","6245","6263","6266","6277","6291","6292","6414","6417","6418","6419","6423","6441","6449","6465","6474","6491","6499","6508","6510","6514","6516","6527","6533","6546","6558","6561","6568","6569","6570","6574","6576","6579","6603","6624","6666","6690","6692","6720","6743","6756","6761","6763","6776","6789","6830","6870","6873","6903","8027","8028","8032","8038","8040","8046","8064","8067","8072","8084","8085","8087","8093","8097","8099","8103","8104","8107","8109","8111","8112","8147","8150","8182","8183","8213","8215","8255","8291","8341","8342","8349","8358","8390","8401","8403","8404","8415","8416","8420","8421","8423","8424","8429","8431","8432","8433","8435","8467","8472","8481","8482","8908","8916","8927","8928","8931","8932","8935","8936","8938","9103","9105","9110","9905","9927","9929","9933","9939","9941","9945","9949","9950","9951","9958","9960","9962"]));
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
 const ret20=p[i].c/p[i-21].c-1;
 const returns60=[];for(let j=i-59;j<=i;j++)returns60.push(Math.log(p[j].c/p[j-1].c));
 const rm=mean(returns60),vol60=Math.sqrt(mean(returns60.map(x=>(x-rm)**2)));
 let peak=-Infinity,mdd=0;for(const x of p.slice(i-59,i+1)){peak=Math.max(peak,x.c);mdd=Math.min(mdd,x.c/peak-1)}
 const volPrev=mean(p.slice(i-39,i-19).map(x=>x.m)),volAccel=volPrev>0?vol20/volPrev:null;
 return{mom6,mom3,mom12,accel,highProx,posShare,vol20,ret20,vol60,dd60:-mdd,volAccel};
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

 const stage2Delta=[], stage2Precision=[], stage2Counts=[];
 const thirdKeys=[
   ['mom6','high'],['mom12','high'],['highProx','high'],
   ['ret20','high'],['vol60','low'],['dd60','low'],['volAccel','high']
 ];
 const third={};for(const [k] of thirdKeys)third[k]=[];
 const rowsOut=[];
 for(const date of dates){
  const rows=[];for(const [code,d] of Object.entries(data)){const i=d.map.get(date);if(i==null||i<252||!d.p[i+H])continue;const f=feats(d.p,i);if(!f)continue;rows.push({code,...f,ret:d.p[i+H].c/d.p[i].c-1})}
  if(rows.length<80)continue;
  const mr=pct(rows.map(x=>x.mom6));rows.forEach((x,i)=>x.momPct=mr[i]);
  const mom=rows.filter(x=>x.momPct>=.8);if(mom.length<20)continue;
  const psMed=q(mom.map(x=>x.posShare),.5),stage2=mom.filter(x=>x.posShare>=psMed);
  if(stage2.length<10)continue;
  const pMom=mean(mom.map(x=>x.ret>=.2?1:0)),p2=mean(stage2.map(x=>x.ret>=.2?1:0));
  stage2Delta.push(p2-pMom);stage2Precision.push(p2);stage2Counts.push(stage2.length);
  const rec={date,n:rows.length,momN:mom.length,momPrecision:pMom,stage2N:stage2.length,stage2Precision:p2,stage2Delta:p2-pMom,third:{}};
  for(const [k,dir] of thirdKeys){
    const med=q(stage2.map(x=>x[k]).filter(Number.isFinite),.5);
    const sel=stage2.filter(x=>Number.isFinite(x[k])&&(dir==='high'?x[k]>=med:x[k]<=med));
    if(sel.length<5)continue;
    const pr=mean(sel.map(x=>x.ret>=.2?1:0)),delta=pr-p2;
    third[k].push(delta);rec.third[k]={n:sel.length,precision:pr,delta};
  }
  rowsOut.push(rec);
 }
 const stage2Summary={n:stage2Delta.length,avgN:mean(stage2Counts),precision:mean(stage2Precision),deltaVsMOM20:mean(stage2Delta),positive:stage2Delta.filter(x=>x>0).length/stage2Delta.length,p:perm(stage2Delta),ci:boot(stage2Delta)};
 const thirdSummary={};for(const [k] of thirdKeys){const v=third[k];thirdSummary[k]={n:v.length,deltaVsStage2:mean(v),positive:v.filter(x=>x>0).length/v.length,p:perm(v),ci:boot(v)}}
 console.log('RESULT',JSON.stringify({stage2:stage2Summary,thirdStage:thirdSummary,byDate:rowsOut}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
