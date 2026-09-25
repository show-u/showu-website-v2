
const API='https://api.finmindtrade.com/api/v4/data';
const START='2020-01-01',END='2026-09-22',H=84,TARGET=180,SEED=20260926;
const USED=new Set([
"1101","1102","1103","1110","1203","1218","1229","1236","1240","1264","1268","1307","1309","1310","1312","1316","1319","1325","1337","1339","1341","1342","1419","1434","1435","1437","1438","1441","1442","1443","1445","1454","1456","1457","1460","1463","1467","1471","1473","1475","1477","1512","1516","1519","1521","1529","1530","1538","1560","1563","1569","1580","1584","1586","1587","1591","1595","1599","1603","1605","1615","1618","1626","1702","1707","1711","1712","1714","1725","1727","1731","1732","1733","1735","1736","1737","1742","1760","1762","1773","1780","1781","1783","1784","1785","1788","1796","1799","1806","1904","1906","1907","1909","2002","2006","2007","2008","2009","2010","2012","2014","2015","2017","2022","2024","2025","2028","2030","2031","2033","2038","2049","2063","2065","2067","2069","2072","2101","2102","2103","2105","2108","2109","2115","2201","2204","2206","2208","2211","2230","2233","2243","2247","2301","2303","2305","2308","2312","2316","2317","2323","2340","2342","2347","2351","2352","2353","2356","2363","2365","2367","2371","2380","2387","2388","2390","2392","2397","2399","2401","2404","2412","2413","2414","2424","2426","2428","2429","2430","2433","2434","2436","2438","2439","2440","2441","2454","2457","2459","2461","2462","2471","2472","2474","2478","2485","2495","2496","2497","2498","2501","2505","2506","2509","2511","2514","2527","2528","2535","2537","2546","2547","2548","2596","2597","2612","2613","2614","2617","2618","2636","2642","2646","2701","2702","2704","2706","2707","2712","2718","2719","2722","2723","2724","2726","2729","2734","2736","2739","2743","2745","2752","2753","2754","2755","2756","2836","2838","2845","2852","2855","2881","2883","2884","2885","2886","2889","2891","2892","2897","2901","2904","2905","2908","2912","2923","2924","2926","2929","2937","2938","2945","2947","3004","3006","3008","3025","3027","3030","3054","3059","3067","3073","3078","3085","3088","3092","3130","3131","3141","3149","3169","3171","3178","3191","3202","3206","3207","3211","3218","3221","3224","3252","3264","3285","3311","3323","3362","3374","3379","3380","3430","3441","3447","3450","3455","3465","3466","3479","3483","3484","3489","3492","3498","3499","3501","3508","3515","3516","3520","3522","3523","3526","3527","3528","3529","3530","3531","3532","3533","3535","3540","3541","3545","3546","3548","3550","3551","3555","3557","3567","3580","3581","3592","3594","3607","3609","3617","3623","3624","3629","3652","3653","3663","3666","3669","3675","3680","3684","3691","3693","3702","3703","3704","3705","3707","3708","3709","3712","3713","4102","4109","4116","4120","4121","4123","4131","4139","4142","4147","4148","4153","4154","4157","4160","4161","4162","4163","4168","4169","4173","4174","4190","4198","4303","4305","4402","4413","4417","4419","4420","4426","4433","4441","4503","4506","4510","4513","4529","4530","4534","4535","4538","4540","4541","4542","4543","4549","4550","4551","4554","4555","4557","4558","4560","4561","4563","4564","4568","4571","4576","4577","4580","4581","4584","4609","4706","4707","4711","4716","4720","4721","4722","4728","4729","4735","4741","4744","4746","4747","4749","4755","4764","4768","4770","4772","4903","4904","4905","4906","4907","4908","4912","4915","4916","4919","4927","4930","4931","4934","4935","4938","4939","4943","4946","4949","4950","4952","4953","4956","4958","4960","4961","4966","4967","4968","4972","4973","4976","4987","4991","4994","4999","5011","5015","5201","5206","5210","5211","5215","5220","5223","5225","5227","5228","5234","5243","5244","5245","5251","5258","5269","5274","5276","5278","5283","5285","5287","5288","5299","5301","5302","5309","5312","5315","5321","5328","5340","5345","5347","5364","5371","5386","5388","5403","5410","5432","5434","5438","5439","5443","5452","5455","5460","5464","5465","5471","5478","5488","5489","5490","5498","5511","5520","5521","5523","5525","5529","5531","5543","5548","5603","5609","5701","5703","5704","5706","5876","5878","5902","5903","5904","5905","5906","5907","6005","6015","6020","6026","6028","6101","6109","6111","6112","6117","6121","6123","6124","6125","6134","6136","6138","6139","6140","6141","6142","6144","6146","6147","6148","6150","6153","6154","6155","6156","6160","6165","6169","6170","6171","6173","6175","6177","6180","6182","6183","6184","6185","6186","6187","6188","6189","6191","6194","6195","6198","6204","6205","6207","6208","6209","6213","6214","6215","6216","6217","6218","6219","6220","6221","6222","6224","6225","6227","6240","6241","6242","6244","6245","6263","6265","6266","6270","6272","6277","6278","6279","6282","6285","6291","6292","6294","6405","6409","6411","6412","6414","6415","6417","6418","6419","6423","6431","6441","6442","6449","6456","6464","6465","6469","6470","6472","6474","6491","6492","6494","6498","6499","6504","6508","6510","6514","6516","6527","6532","6533","6541","6542","6546","6550","6552","6556","6558","6561","6568","6569","6570","6573","6574","6576","6577","6579","6590","6603","6606","6613","6624","6629","6649","6654","6657","6662","6664","6666","6670","6671","6679","6683","6690","6692","6706","6708","6712","6715","6720","6730","6739","6743","6753","6756","6757","6761","6763","6767","6770","6776","6789","6794","6804","6805","6811","6823","6830","6835","6865","6870","6873","6885","6903","6919","6925","6931","8021","8027","8028","8032","8033","8034","8038","8040","8046","8048","8054","8064","8067","8069","8072","8080","8084","8085","8087","8091","8093","8096","8097","8099","8103","8104","8107","8109","8111","8112","8114","8147","8150","8155","8182","8183","8213","8215","8240","8255","8277","8291","8341","8342","8349","8354","8358","8374","8390","8401","8403","8404","8415","8416","8420","8421","8423","8424","8429","8431","8432","8433","8435","8438","8440","8442","8454","8455","8462","8463","8467","8472","8473","8478","8481","8482","8488","8489","8499","8905","8906","8908","8916","8924","8926","8927","8928","8931","8932","8933","8935","8936","8937","8938","8941","8942","8996","9103","9105","9110","9136","9905","9907","9908","9910","9911","9912","9914","9925","9926","9927","9929","9930","9933","9934","9937","9938","9939","9941","9943","9945","9946","9949","9950","9951","9958","9960","9962"]);
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fm(ds,id){
 for(let a=0;a<3;a++){const u=new URL(API);u.searchParams.set('dataset',ds);u.searchParams.set('data_id',id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);const r=await fetch(u);if(r.ok)return (await r.json()).data||[];await sleep(300*(a+1))}return[];
}
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);return (await r.json()).data||[]}
async function yahoo(code,type){
 const suffix=type==='twse'?'.TW':'.TWO',p1=Math.floor(Date.parse(START+'T00:00:00Z')/1000),p2=Math.floor(Date.parse('2026-09-23T00:00:00Z')/1000);
 const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suffix+'?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';
 for(let a=0;a<3;a++){const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(r.ok){const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],qq=x?.indicators?.quote?.[0],adj=x?.indicators?.adjclose?.[0]?.adjclose||qq?.close||[];return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),c:+adj[i],vol:+qq.volume?.[i]||0})).filter(z=>z.c>0)}await sleep(200*(a+1))}return[];
}
async function pool(items,limit,fn){const out=new Array(items.length);let idx=0;async function w(){while(true){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i])}catch{out[i]=null}}}await Promise.all(Array.from({length:limit},w));return out}
function pct(vals){const s=vals.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),o=new Array(vals.length);for(let k=0;k<s.length;k++)o[s[k][1]]=k/(s.length-1||1);return o}
function dateAdd(d,n){return new Date(new Date(d+'T00:00:00Z').getTime()+n*86400000).toISOString().slice(0,10)}
function nearestIndex(p,date){let lo=0,hi=p.length-1,ans=-1;while(lo<=hi){const m=(lo+hi)>>1;if(p[m].date<=date){ans=m;lo=m+1}else hi=m-1}return ans}
function revFeatures(rows,date){
 const a=rows.filter(x=>(x.create_time||x.date)<=date&&+x.revenue>0).map(x=>({y:+x.revenue_year,m:+x.revenue_month,v:+x.revenue,ct:x.create_time||x.date})).sort((x,z)=>x.ct.localeCompare(z.ct));
 if(!a.length)return {};
 const cur=a.at(-1),get=(Y,M)=>a.find(x=>x.y===Y&&x.m===M)?.v??null,py=get(cur.y-1,cur.m);if(!(py>0))return{};
 const yoy=cur.v/py-1, hist=[];
 for(let k=1;k<=3;k++){let M=cur.m-k,Y=cur.y;while(M<=0){M+=12;Y--}const x=get(Y,M),b=get(Y-1,M);if(x>0&&b>0)hist.push(x/b-1)}
 return {revYoY:yoy,revAccel:hist.length?yoy-mean(hist):null};
}
function finFeatures(rows,date){
 const cutoff=dateAdd(date,-70),a=rows.filter(x=>x.date<=cutoff),ds=[...new Set(a.map(x=>x.date))].sort();if(ds.length<2)return{};
 const d=ds.at(-1),prev=d.slice(0,4)-1+d.slice(4),get=(D,t)=>a.find(x=>x.date===D&&x.type===t)?.value;
 const op=+get(d,'OperatingIncome'),op0=+get(prev,'OperatingIncome'),ni=+get(d,'IncomeAfterTaxes'),ni0=+get(prev,'IncomeAfterTaxes');
 return {opPositive:Number.isFinite(op)?(op>0?1:0):null,niPositive:Number.isFinite(ni)?(ni>0?1:0):null,
   opYoY:(Number.isFinite(op)&&Number.isFinite(op0)&&Math.abs(op0)>1)?(op-op0)/Math.abs(op0):null,
   niYoY:(Number.isFinite(ni)&&Number.isFinite(ni0)&&Math.abs(ni0)>1)?(ni-ni0)/Math.abs(ni0):null};
}
function instFeatures(rows,p,date){
 const i=nearestIndex(p,date);if(i<20)return{};const start=p[i-19].date,end=p[i].date,sub=rows.filter(x=>x.date>=start&&x.date<=end);
 const volume=p.slice(i-19,i+1).reduce((s,x)=>s+x.vol,0);if(!(volume>0))return{};
 const by=n=>sub.filter(x=>x.name===n).reduce((s,x)=>s+(+x.buy||0)-(+x.sell||0),0)/volume;
 return {foreign20:by('Foreign_Investor'),trust20:by('Investment_Trust')};
}
function marginFeatures(rows,p,date){
 const i=nearestIndex(p,date);if(i<20)return{};const start=p[i-19].date,sub=rows.filter(x=>x.date>=start&&x.date<=date).sort((a,b)=>a.date.localeCompare(b.date));if(sub.length<2)return{};
 const a=+sub[0].MarginPurchaseTodayBalance,b=+sub.at(-1).MarginPurchaseTodayBalance;return {marginChg20:a>0?(b/a-1):null};
}
function perFeatures(rows,date){
 const a=rows.filter(x=>x.date<=date).sort((x,z)=>x.date.localeCompare(z.date));if(!a.length)return{};const x=a.at(-1);return {PER:+x.PER||null,PBR:+x.PBR||null};
}
function perm(v,B=20000){let z=113355;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const obs=mean(v);let e=0;for(let b=0;b<B;b++)if(mean(v.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function boot(v,B=10000){let z=551133;const r=()=>{z=(1664525*z+1013904223)>>>0;return z/4294967296};const a=[];for(let b=0;b<B;b++){const t=[];for(let i=0;i<v.length;i++)t.push(v[Math.floor(r()*v.length)]);a.push(mean(t))}return[q(a,.025),q(a,.975)]}
(async()=>{
 console.log('PROTOCOL',JSON.stringify({
   objective:'Explain which stock-level point-in-time characteristics separate future +20% winners from non-winners inside MOM6 top20',
   freshStocks:TARGET,
   horizon:'84 trading days',
   dates:'non-overlapping 84-day grid',
   discovery:'2021-2023',validation:'2024-2026',
   features:['revYoY','revAccel','opPositive','niPositive','opYoY','niYoY','foreign20','trust20','marginChg20','PER','PBR'],
   rule:'Discovery only chooses direction of each feature by winner-vs-loser median difference; validation tests top/bottom half within MOM6 candidates with fixed direction. No multivariate tuning.'
 }));
 const raw=await info(),latest=new Map();
 for(const x of raw){if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||USED.has(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x)}
 const rr=rng(SEED),cand=[...latest.values()].sort(()=>rr()-.5).slice(0,500);
 const pxs=await pool(cand,18,async s=>{const p=await yahoo(s.stock_id,s.type);return p.length>=900?{s,p}:null});
 const base=pxs.filter(Boolean).slice(0,TARGET);console.log('PRICE_LOCK',JSON.stringify({fresh:base.length,codes:base.map(x=>x.s.stock_id)}));
 const ds=await pool(base,8,async z=>{const id=z.s.stock_id;const [rev,fin,inst,margin,per]=await Promise.all([
   fm('TaiwanStockMonthRevenue',id),fm('TaiwanStockFinancialStatements',id),fm('TaiwanStockInstitutionalInvestorsBuySell',id),fm('TaiwanStockMarginPurchaseShortSale',id),fm('TaiwanStockPER',id)
 ]);return {...z,rev,fin,inst,margin,per,map:new Map(z.p.map((x,i)=>[x.date,i]))}});
 const data=ds.filter(Boolean);console.log('DATA_LOCK',JSON.stringify({n:data.length}));
 const cal=data[0].p.map(x=>x.date),dates=[];for(let i=300;i<cal.length-H;i+=84){const d=cal[i];if(d>='2021-08-01'&&d<='2026-01-31')dates.push(d)}console.log('DATES',JSON.stringify(dates));
 const obs=[];
 for(const date of dates){
   const rows=[];
   for(const d of data){const i=d.map.get(date);if(i==null||i<252||!d.p[i+H])continue;const mom6=d.p[i-21].c/d.p[i-126].c-1,ret=d.p[i+H].c/d.p[i].c-1;
     rows.push({code:d.s.stock_id,mom6,ret,...revFeatures(d.rev,date),...finFeatures(d.fin,date),...instFeatures(d.inst,d.p,date),...marginFeatures(d.margin,d.p,date),...perFeatures(d.per,date)});
   }
   if(rows.length<100)continue;const mr=pct(rows.map(x=>x.mom6));rows.forEach((x,i)=>x.momPct=mr[i]);for(const x of rows.filter(x=>x.momPct>=.8))obs.push({...x,date,winner:x.ret>=.2});
 }
 const keys=['revYoY','revAccel','opPositive','niPositive','opYoY','niYoY','foreign20','trust20','marginChg20','PER','PBR'];
 const early=obs.filter(x=>x.date<'2024-01-01'),late=obs.filter(x=>x.date>='2024-01-01');
 const discovery={};const directions={};
 for(const k of keys){
   const w=early.filter(x=>x.winner&&Number.isFinite(x[k])).map(x=>x[k]),l=early.filter(x=>!x.winner&&Number.isFinite(x[k])).map(x=>x[k]);
   const mw=median(w),ml=median(l),dir=(mw??0)>=(ml??0)?'high':'low';directions[k]=dir;discovery[k]={winnerN:w.length,loserN:l.length,winnerMedian:mw,loserMedian:ml,diff:(mw??0)-(ml??0),direction:dir};
 }
 const validation={};
 for(const k of keys){
   const dsDates=[...new Set(late.map(x=>x.date))],deltas=[],precs=[],ns=[];
   for(const date of dsDates){
     const a=late.filter(x=>x.date===date&&Number.isFinite(x[k]));if(a.length<15)continue;const basePrec=mean(a.map(x=>x.winner?1:0)),med=median(a.map(x=>x[k])),sel=a.filter(x=>directions[k]==='high'?x[k]>=med:x[k]<=med);if(sel.length<5)continue;const pr=mean(sel.map(x=>x.winner?1:0));deltas.push(pr-basePrec);precs.push(pr);ns.push(sel.length);
   }
   validation[k]={nDates:deltas.length,avgN:mean(ns),precision:mean(precs),delta:mean(deltas),positive:deltas.filter(x=>x>0).length/(deltas.length||1),p:deltas.length?perm(deltas):null,ci:deltas.length?boot(deltas):null,direction:directions[k]};
 }
 console.log('RESULT',JSON.stringify({discovery,validation,counts:{early:early.length,late:late.length,earlyWinners:early.filter(x=>x.winner).length,lateWinners:late.filter(x=>x.winner).length}}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
