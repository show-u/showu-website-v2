
const API='https://api.finmindtrade.com/api/v4/data';
const START='2020-01-01',END='2026-09-22',H=84,SEED=20261022,TARGET=60;
const EX=new Set(["2330","2454","2409","2881","1301","2434","1454","3419","4938","8499","4581","6525","6831","2009","8473","1437","6164","5264","6965","9942","2437","6153","5471","9938","5285","6541","4441","1262","4989","1618","6281","7765","6202","6919","7795","4566","1721","6230","8464","1512","3026","3593","2385","3168","3494","4169","2340","1101","3266","2316","3296","3346","4137","1465","2362","2033","2017","1475","1216","1220","1477","2321","3257","3596","3356","2328","1102","4164","2387","2236","3376","3532","3711","8021","2072","2630","6206","1605","2312","2443","3652","2497","2402","4915","3030","6438","1723","3563","6176","3583","9919","2485","2543","8110","2606","2480","2547","9935","3645","6906","2509","2498","2607","3686","8462","3543","2603","4763","2404","2530","2504","8443","6005","8438","3673","2495","4771","6592","4564","6213","6589","3706","6405","9937","6719","1722","6278","6443","6257","6183","8261","6152","9917","6531","6243","1707","1608","6272","1434","9902","6282","1453","1714","8466","6285","6689","6239","6177","1612","2816","6271","8131","2393","4414","3708","6796","6657","1110","2923","3380","1210","1304","2022","3164","2062","1808","3209","2365","3515","2233","2109","3406","2317","1529","2324","2373","1526","1905","1537","2354","1449","4562","2114","5521","2101","2305","4439","5258","4935","6117","3311","5007","1521","3557","6142","6136","2426","2484","2419","2323","4104","2540","4930","2453","5469","5538","2476","1103","3054","6550","3682","2867","2358","1701","2601","1441","8480","1589","2888","6806","3454","2809","1104","1203","1225","1231","1234","1256","1307","1321","1341","1413","1414","1416","1417","1443","1466","1471","1531","1583","1590","1597","1614","2208","2228","2243","2247","2302","2303","2327","2332","2356","2368","2374","2383","2408","2417","2428","2466","2534","2613","2614","2633","2727","3518","3679","3701","4532","4583","5906","6416","6431","6581","6691","6706","8249","8454","8940","9136","9912","9926","9930","1456","1504","1524","1584","1586","1784","1786","2064","2106","2221","2231","2308","2342","2352","2405","2412","2421","2429","2460","2643","2701","2726","2736","2754","2812","2910","2924","3081","3171","3219","3434","3483","3498","3558","3577","4168","4401","4406","4506","4572","4702","4907","5220","5340","5347","5353","5388","5484","5490","5512","5536","5607","6026","6113","6118","6134","6143","6158","6161","6165","6235","6275","6462","6625","6637","6732","8011","8024","8044","8048","8059","8071","8076","8077","8080","8114","8210","8222","8426","9907","1439","1455","1515","1516","1536","1708","1730","1810","1815","1903","2065","2364","2471","2849","2880","3432","3580","4131","4157","4502","4523","4934","5291","5355","5483","5488","5520","5604","6109","6122","6128","6151","6168","6171","6179","6186","6212","6223","6226","6261","6264","6269","6279","6412","6506","8043","8074","8083","8105","8933","1264","1325","1326","1336","1436","1438","1444","1446","1611","1734","1735","1762","1805","1813","1817","1909","2010","2031","2038","2059","2070","2102","2436","2718","3005","3622","3630","3675","3687","3694","3702","3704","3709","4107","4108","4419","5009","5013","5474","5523","5530","6023","6115","6116","6129","6191","6556","6590","6664","6671","6693","6703","6712","6716","6728","6752","8039","8171","8234","9918","1452","1472","1532","1593","2204","2235","2377","2414","2423","2425","2442","2489","2537","2608","2615","2634","2641","2724","2731","2801","3029","3031","3032","3036","3085","3094","3227","3260","3276","3285","3289","3317","3324","3325","3354","3363","3441","3450","3465","4142","4190","4306","4413","4545","4558","4609","4768","4905","4960","4974","5284","5457","5516","6016","6114","6163","6197","6204","6233","6415","6504","6584","6613","8066","8081","8086","8088","8101","8284","8354","1310","1312","1315","1324","1410","1435","1442","1445","1599","1717","1726","2006","2061","2227","2375","2379","2449","2472","2496","2528","2542","2723","2752","2820","2852","3149","3226","3230","3252","3265","3455","3508","3541","3548","3628","3672","4105","4160","4171","4175","4205","4432","4534","4549","4551","4736","4745","4754","4906","4916","4946","4951","4979","5215","5227","5310","5348","5403","5487","5533","5534","6108","6120","6126","6139","6199","6227","6283","6432","6442","6456","6464","6486","6552","6577","6578","6661","6683","6803","8033","8050","8069","8070","8096","8478","8905","8921","8926","9921","9944","1464","1474","1476","1503","1582","1615","1616","1709","1710","1732","1737","1777","1795","1799","2067","2108","2207","2313","2314","2337","2344","2357","2359","2360","2367","2376","2392","2406","2413","2420","2431","2438","2439","2441","2444","2478","2486","2515","2545","2596","2636","2884","2885","2897","3006","3022","3035","3152","3189","3402","3520","3537","3552","3564","3576","3611","3624","3625","4138","4192","4729","4743","4927","5880","6642","6643","6654","6695","6721","6733","8155","8240","8444","8450","8488","8906","8917","8929","9906","9928","1587","1603","1626","1702","1712","1736","1781","1783","1788","1796","2206","2347","2353","2433","2459","2702","2719","2722","2734","2745","2756","2938","3130","3489","3501","3522","3551","3592","3629","3669","3712","3713","4109","4116","4121","4123","4956","4961","4966","4967","4968","4973","4991","4994","4999","5211","5244","5245","5251","5269","5274","5276","5287","5288","5321","5328","5386","5432","5455","5489","5511","5529","5609","5701","5876","5902","6028","6101","6121","6124","6150","6175","6182","6188","6189","6194","6215","6216","6219","6220","6242","6291","6292","6414","6419","6423","6449","6465","6474","6499","6516","6527","6533","6546","6561","6568","6574","6666","6690","6692","6720","6743","6756","6761","6763","6776","8032","8038","8040","8064","8072","8084","8099","8103","8104","8147","8150","8183","8213","8215","8255","8291","8341","8342","8349","8390","8401","8403","8415","8416","8420","8421","8423","8424","8432","8433","8472","8482","8908","8916","8931","9103","9105","9110","9927","9933","9950","9951","9958","9960"]);
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function fm(dataset,id){
 for(let a=0;a<4;a++){const u=new URL(API);u.searchParams.set('dataset',dataset);if(id)u.searchParams.set('data_id',id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);const r=await fetch(u);if(r.ok)return (await r.json()).data||[];if(a===3)throw Error(dataset+' '+(id||'')+' '+r.status);await sleep(500*(a+1))}
}
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);if(!r.ok)throw Error('info '+r.status);return (await r.json()).data||[]}
async function twseDelisted(){
 const r=await fetch('https://www.twse.com.tw/rwd/zh/company/suspendListing?response=json',{headers:{'User-Agent':'Mozilla/5.0'}});const j=await r.json();
 return (j.data||[]).map(x=>{const [roc,name,code]=x,p=roc.split('/').map(Number);return{code,name,date:(p[0]+1911)+'-'+String(p[1]).padStart(2,'0')+'-'+String(p[2]).padStart(2,'0'),market:'twse'}}).filter(x=>/^[0-9]{4}$/.test(x.code)&&x.date>='2021-01-01'&&x.date<='2026-09-22');
}
async function tpexDelisted(){
 const out=[];for(const year of [2021,2022,2023,2024,2025,2026]){const r=await fetch('https://www.tpex.org.tw/www/zh-tw/company/deListed?code=&date='+year+'&reason=-1',{headers:{'User-Agent':'Mozilla/5.0','Referer':'https://www.tpex.org.tw/zh-tw/mainboard/listed/delisted.html'}});
 const j=await r.json();for(const x of j?.tables?.[0]?.data||[]){const p=x[2].split('-').map(Number);if(/^[0-9]{4}$/.test(x[0])&&p.length===3)out.push({code:x[0],name:x[1],date:(p[0]+1911)+'-'+String(p[1]).padStart(2,'0')+'-'+String(p[2]).padStart(2,'0'),market:'tpex'});}}
 return out.filter(x=>x.date>='2021-01-01'&&x.date<='2026-09-22');
}
function P(rows){return rows.map(x=>({date:x.date,close:+x.close,money:+x.Trading_money||0})).filter(x=>x.close>0).sort((a,b)=>a.date.localeCompare(b.date))}
function mom6(p,i){return i>=126?p[i-21].close/p[i-126].close-1:null}
function annVol60(p,i){if(i<60)return null;const r=[];for(let j=i-59;j<=i;j++)r.push(Math.log(p[j].close/p[j-1].close));const m=mean(r);return Math.sqrt(mean(r.map(x=>(x-m)**2)))*Math.sqrt(252)}
function maxDD60(p,i){if(i<59)return null;let peak=-Infinity,mdd=0;for(const x of p.slice(i-59,i+1)){peak=Math.max(peak,x.close);mdd=Math.min(mdd,x.close/peak-1)}return -mdd}
function avgMoney20(p,i){if(i<19)return null;return mean(p.slice(i-19,i+1).map(x=>x.money))}
function extreme20(p,i){if(i<20)return false;for(let j=i-19;j<=i;j++)if(Math.abs(p[j].close/p[j-1].close-1)>=.10)return true;return false}
function rank(vals){const idx=vals.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),r=new Array(vals.length);let k=0;while(k<idx.length){let j=k;while(j+1<idx.length&&idx[j+1][0]===idx[k][0])j++;const rr=(k+j)/2+1;for(let z=k;z<=j;z++)r[idx[z][1]]=rr;k=j+1}return r}
function pct(vals){const r=rank(vals);return r.map(x=>(x-1)/(vals.length-1||1))}
function dateAdd(d,n){return new Date(new Date(d+'T00:00:00Z').getTime()+n*86400000).toISOString().slice(0,10)}
function latestRevScore(rev,date){
 const rows=rev.filter(x=>(x.create_time||x.date)<=date&&+x.revenue>0).map(x=>({y:+x.revenue_year,m:+x.revenue_month,v:+x.revenue,ct:x.create_time||x.date})).sort((a,b)=>a.ct.localeCompare(b.ct));
 if(!rows.length)return {score:null};
 const cur=rows.at(-1),get=(Y,M)=>rows.find(x=>x.y===Y&&x.m===M)?.v??null,py=get(cur.y-1,cur.m);if(!(py>0))return {score:null};
 const yoy=cur.v/py-1,prev=[];
 for(let k=1;k<=3;k++){let M=cur.m-k,Y=cur.y;while(M<=0){M+=12;Y--}const a=get(Y,M),b=get(Y-1,M);if(a>0&&b>0)prev.push(a/b-1)}
 let s=0;if(yoy>0)s+=2;if(prev.length>=2&&yoy>=median(prev))s+=2;return {score:s,yoy};
}
function latestFinScore(fin,date){
 const cutoff=dateAdd(date,-70),fs=fin.filter(x=>x.date<=cutoff),dates=[...new Set(fs.map(x=>x.date))].sort();if(!dates.length)return {score:null};
 const d=dates.at(-1),get=t=>fs.find(x=>x.date===d&&x.type===t)?.value;
 const op=+get('OperatingIncome'),ni=+get('IncomeAfterTaxes');let s=0,n=0;if(Number.isFinite(op)){n++;if(op>0)s+=2}if(Number.isFinite(ni)){n++;if(ni>0)s+=2}
 return {score:s,n,date:d,op,ni};
}
function ttmOCF(cash,date){
 const cutoff=dateAdd(date,-70),xs=cash.filter(x=>x.date<=cutoff&&(x.type==='CashFlowsFromOperatingActivities'||x.type==='NetCashInflowFromOperatingActivities')&&Number.isFinite(+x.value))
   .map(x=>({d:x.date,v:+x.value})).sort((a,b)=>a.d.localeCompare(b.d));
 if(xs.length<4)return null;
 const byYear={};for(const x of xs){const y=x.d.slice(0,4);(byYear[y]??=[]).push(x)};const qs=[];
 for(const y of Object.keys(byYear).sort()){const a=byYear[y].sort((x,z)=>x.d.localeCompare(z.d));let prev=0;for(const x of a){qs.push({d:x.d,v:x.v-prev});prev=x.v}}
 if(qs.length<4)return null;return qs.slice(-4).reduce((s,x)=>s+x.v,0);
}
function perm(vals,B=20000){let seed=112233;const r=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};const obs=mean(vals);let e=0;for(let b=0;b<B;b++)if(mean(vals.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function boot(vals,B=10000){let seed=332211;const r=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};const v=[];for(let b=0;b<B;b++){const a=[];for(let i=0;i<vals.length;i++)a.push(vals[Math.floor(r()*vals.length)]);v.push(mean(a))}return[q(v,.025),q(v,.975)]}
(async()=>{
 console.log('PROTOCOL',JSON.stringify({
  objective:'Validate executable individual-stock score against MOM6-alone on a new fresh universe',
  score:'MOM6 60 + risk 25 + fundamentals 10 + event-neutral 5',
  gate:'MOM6 top20% required; B-or-better total score >=75',
  event:'historical event confirmation cannot be reconstructed consistently, therefore fixed neutral 5 in backtest and retained as a live manual veto',
  risk:['volatility top10 -6','60d max drawdown >20% -6','20d liquidity bottom20 -5','20d >=10% daily move -4'],
  fundamental:['latest published revenue YoY >0 +2','YoY not below prior3-month median +2','latest available operating income >0 +2','net income >0 +2','TTM operating cash flow >0 +2'],
  primary:'future84 return >=20%, delisting before horizon stressed to -100%',
  compare:['MOM6 top20','score>=65 C+','score>=75 B+','score>=85 A']
 }));
 const raw=await info(),latest=new Map();
 for(const x of raw){if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||EX.has(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x)}
 const rr=rng(SEED),cand=[...latest.values()].sort(()=>rr()-.5),surv={};
 for(const s of cand){if(Object.keys(surv).length>=TARGET)break;try{const [px,rev,fin,cash]=await Promise.all([fm('TaiwanStockPrice',s.stock_id),fm('TaiwanStockMonthRevenue',s.stock_id),fm('TaiwanStockFinancialStatements',s.stock_id),fm('TaiwanStockCashFlowsStatement',s.stock_id)]);const p=P(px);if(p.length<900||p[0].date>'2021-01-15'||rev.length<24||fin.length<15||cash.length<10)continue;surv[s.stock_id]={p,map:new Map(p.map((x,i)=>[x.date,i])),rev,fin,cash,name:s.stock_name,type:s.type};}catch{} await sleep(60)}
 const [twD,tpD]=await Promise.all([twseDelisted(),tpexDelisted()]);const dels=[...new Map([...twD,...tpD].map(x=>[x.code,x])).values()],data={...surv};
 for(const d of dels){if(data[d.code])continue;try{const [px,rev,fin,cash]=await Promise.all([fm('TaiwanStockPrice',d.code),fm('TaiwanStockMonthRevenue',d.code),fm('TaiwanStockFinancialStatements',d.code),fm('TaiwanStockCashFlowsStatement',d.code)]);const p=P(px);if(p.length)data[d.code]={p,map:new Map(p.map((x,i)=>[x.date,i])),rev,fin,cash,name:d.name,type:d.market,delisted:true,delistDate:d.date};}catch{} await sleep(60)}
 console.log('LOCK',JSON.stringify({fresh:Object.keys(surv).length,delisted:dels.filter(x=>data[x.code]).length,total:Object.keys(data).length,codes:Object.keys(surv)}));
 const base=data[Object.keys(surv)[0]]?.p;if(!base)throw Error('no fresh stocks');const cal=base.map(x=>x.date),pos=new Map(cal.map((d,i)=>[d,i])),dates=[];
 for(let i=252;i<cal.length-H;i+=84){const d=cal[i];if(d>='2021-04-01'&&d<='2026-04-30')dates.push(d)}
 console.log('DATES',JSON.stringify(dates));
 const per=[];
 for(const date of dates){
   const rows=[],targetPos=(pos.get(date)??-999)+H;
   for(const [code,d] of Object.entries(data)){const i=d.map.get(date);if(i==null||i<126)continue;const m=mom6(d.p,i);if(!Number.isFinite(m))continue;let ret=null;if(d.p[i+H])ret=d.p[i+H].close/d.p[i].close-1;else{const lp=pos.get(d.p.at(-1).date);if(lp!=null&&lp<targetPos)ret=-1}if(!Number.isFinite(ret))continue;
     rows.push({code,m,ret,vol:annVol60(d.p,i),dd:maxDD60(d.p,i),liq:avgMoney20(d.p,i),extreme:extreme20(d.p,i),rev:d.rev,fin:d.fin,cash:d.cash});
   }
   if(rows.length<50)continue;
   const mr=pct(rows.map(x=>x.m)),vr=pct(rows.map(x=>x.vol)),lr=pct(rows.map(x=>x.liq));
   rows.forEach((x,j)=>{x.mPct=mr[j];x.vPct=vr[j];x.lPct=lr[j];
     x.momPts=x.mPct>=.90?60:x.mPct>=.80?50:x.mPct>=.70?35:x.mPct>=.50?20:0;
     x.riskPts=25-(x.vPct>=.90?6:0)-(x.dd>.20?6:0)-(x.lPct<=.20?5:0)-(x.extreme?4:0);
     const rs=latestRevScore(x.rev,date),fs=latestFinScore(x.fin,date),ocf=ttmOCF(x.cash,date);x.basicPts=(rs.score??0)+(fs.score??0)+(Number.isFinite(ocf)&&ocf>0?2:0);
     x.dataComplete=rs.score!=null&&fs.score!=null&&Number.isFinite(ocf);
     x.revPts=(rs.score??0);x.finPts=(fs.score??0);x.ocfPos=Number.isFinite(ocf)&&ocf>0;
     x.revPositive=Number.isFinite(rs.yoy)&&rs.yoy>0;x.revTrend=(rs.score??0)>=4;
     x.opPositive=Number.isFinite(fs.op)&&fs.op>0;x.niPositive=Number.isFinite(fs.ni)&&fs.ni>0;
     x.total=x.momPts+x.riskPts+x.basicPts+5;
     x.grade=x.momPts>=50?(x.total>=85?'A':x.total>=75?'B':x.total>=65?'C':'D'):'OUT';
   });
   const eligible=rows.filter(x=>x.dataComplete),mom=eligible.filter(x=>x.mPct>=.80),c=eligible.filter(x=>x.mPct>=.80&&x.total>=65),b=eligible.filter(x=>x.mPct>=.80&&x.total>=75),a=eligible.filter(x=>x.mPct>=.80&&x.total>=85);
   const stat=g=>({n:g.length,precision:g.length?mean(g.map(x=>x.ret>=.20?1:0)):null,meanRet:g.length?mean(g.map(x=>x.ret)):null,medianRet:g.length?median(g.map(x=>x.ret)):null});
   per.push({date,universe:stat(eligible),MOM20:stat(mom),Cplus:stat(c),Bplus:stat(b),A:stat(a)});
 }
 function summary(key){
   const usable=per.filter(x=>x[key].n>=3),lifts=usable.map(x=>x[key].precision-x.universe.precision),prec=usable.map(x=>x[key].precision),meanR=usable.map(x=>x[key].meanRet);
   return {nDates:usable.length,avgN:mean(usable.map(x=>x[key].n)),precision:mean(prec),liftVsUniverse:mean(lifts),positive:lifts.filter(x=>x>0).length/lifts.length,p:perm(lifts),ci:boot(lifts),meanReturn:mean(meanR),medianOfMedian:median(usable.map(x=>x[key].medianRet)),byDate:usable.map(x=>({date:x.date,n:x[key].n,precision:x[key].precision,lift:x[key].precision-x.universe.precision,meanRet:x[key].meanRet}))};
 }

 const S={MOM20:summary('MOM20'),Cplus:summary('Cplus'),Bplus:summary('Bplus'),A:summary('A')};
 const FILTERS={
   noHighVol:x=>x.vPct<.90,
   noDD20:x=>x.dd<=.20,
   liquid80:x=>x.lPct>.20,
   noExtreme20:x=>!x.extreme,
   risk20:x=>x.riskPts>=20,
   risk23:x=>x.riskPts>=23,
   revenuePositive:x=>x.revPositive,
   revenueTrend:x=>x.revTrend,
   opIncomePositive:x=>x.opPositive,
   netIncomePositive:x=>x.niPositive,
   ocfPositive:x=>x.ocfPos,
   fundamentals6:x=>x.basicPts>=6,
   fundamentals8:x=>x.basicPts>=8,
   risk20Fund6:x=>x.riskPts>=20&&x.basicPts>=6
 };
 const ablation={};
 for(const [name,fn] of Object.entries(FILTERS)){
   const dif=[],precs=[],ns=[];
   for(const date of dates){
     // rebuild rows identically for this date to inspect frozen component rules
     const rows=[],targetPos=(pos.get(date)??-999)+H;
     for(const [code,d] of Object.entries(data)){const i=d.map.get(date);if(i==null||i<126)continue;const m=mom6(d.p,i);if(!Number.isFinite(m))continue;let ret=null;if(d.p[i+H])ret=d.p[i+H].close/d.p[i].close-1;else{const lp=pos.get(d.p.at(-1).date);if(lp!=null&&lp<targetPos)ret=-1}if(!Number.isFinite(ret))continue;
       rows.push({code,m,ret,vol:annVol60(d.p,i),dd:maxDD60(d.p,i),liq:avgMoney20(d.p,i),extreme:extreme20(d.p,i),rev:d.rev,fin:d.fin,cash:d.cash});
     }
     if(rows.length<50)continue;
     const mr=pct(rows.map(x=>x.m)),vr=pct(rows.map(x=>x.vol)),lr=pct(rows.map(x=>x.liq));
     rows.forEach((x,j)=>{x.mPct=mr[j];x.vPct=vr[j];x.lPct=lr[j];x.riskPts=25-(x.vPct>=.90?6:0)-(x.dd>.20?6:0)-(x.lPct<=.20?5:0)-(x.extreme?4:0);
       const rs=latestRevScore(x.rev,date),fs=latestFinScore(x.fin,date),ocf=ttmOCF(x.cash,date);
       x.basicPts=(rs.score??0)+(fs.score??0)+(Number.isFinite(ocf)&&ocf>0?2:0);x.revPositive=Number.isFinite(rs.yoy)&&rs.yoy>0;x.revTrend=(rs.score??0)>=4;x.opPositive=Number.isFinite(fs.op)&&fs.op>0;x.niPositive=Number.isFinite(fs.ni)&&fs.ni>0;x.ocfPos=Number.isFinite(ocf)&&ocf>0;x.dataComplete=rs.score!=null&&fs.score!=null&&Number.isFinite(ocf);
     });
     const eligible=rows.filter(x=>x.dataComplete),mom=eligible.filter(x=>x.mPct>=.80),sub=mom.filter(fn);
     if(mom.length<3||sub.length<3)continue;
     const p0=mean(mom.map(x=>x.ret>=.20?1:0)),p1=mean(sub.map(x=>x.ret>=.20?1:0));dif.push(p1-p0);precs.push(p1);ns.push(sub.length);
   }
   ablation[name]={nDates:dif.length,avgN:mean(ns),precision:mean(precs),deltaVsMOM20:mean(dif),positive:dif.filter(x=>x>0).length/dif.length,p:perm(dif),ci:boot(dif)};
 }
 function pair(a,b){const vals=[];for(const x of per){if(x[a].n>=3&&x[b].n>=3)vals.push(x[a].precision-x[b].precision)}return{n:vals.length,mean:mean(vals),positive:vals.filter(x=>x>0).length/vals.length,p:perm(vals),ci:boot(vals)}}
 console.log('RESULT',JSON.stringify({summary:S,ablation,headToHead:{BplusVsMOM20:pair('Bplus','MOM20'),A_vs_MOM20:pair('A','MOM20')},eventBacktestLimitation:'5-point event component is neutral in historical validation; live use requires current-event veto rather than historical score inference.'}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
