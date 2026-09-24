
const API='https://api.finmindtrade.com/api/v4/data';
const START='2020-01-01',END='2026-09-22',H=84,SEED=20261021,TARGET=150;
const EX=new Set(["2330","2454","2409","2881","1301","2434","1454","3419","4938","8499","4581","6525","6831","2009","8473","1437","6164","5264","6965","9942","2437","6153","5471","9938","5285","6541","4441","1262","4989","1618","6281","7765","6202","6919","7795","4566","1721","6230","8464","1512","3026","3593","2385","3168","3494","4169","2340","1101","3266","2316","3296","3346","4137","1465","2362","2033","2017","1475","1216","1220","1477","2321","3257","3596","3356","2328","1102","4164","2387","2236","3376","3532","3711","8021","2072","2630","6206","1605","2312","2443","3652","2497","2402","4915","3030","6438","1723","3563","6176","3583","9919","2485","2543","8110","2606","2480","2547","9935","3645","6906","2509","2498","2607","3686","8462","3543","2603","4763","2404","2530","2504","8443","6005","8438","3673","2495","4771","6592","4564","6213","6589","3706","6405","9937","6719","1722","6278","6443","6257","6183","8261","6152","9917","6531","6243","1707","1608","6272","1434","9902","6282","1453","1714","8466","6285","6689","6239","6177","1612","2816","6271","8131","2393","4414","3708","6796","6657","1110","2923","3380","1210","1304","2022","3164","2062","1808","3209","2365","3515","2233","2109","3406","2317","1529","2324","2373","1526","1905","1537","2354","1449","4562","2114","5521","2101","2305","4439","5258","4935","6117","3311","5007","1521","3557","6142","6136","2426","2484","2419","2323","4104","2540","4930","2453","5469","5538","2476","1103","3054","6550","3682","2867","2358","1701","2601","1441","8480","1589","2888","6806","3454","2809","1104","1203","1225","1231","1234","1256","1307","1321","1341","1413","1414","1416","1417","1443","1466","1471","1531","1583","1590","1597","1614","2208","2228","2243","2247","2302","2303","2327","2332","2356","2368","2374","2383","2408","2417","2428","2466","2534","2613","2614","2633","2727","3518","3679","3701","4532","4583","5906","6416","6431","6581","6691","6706","8249","8454","8940","9136","9912","9926","9930","1456","1504","1524","1584","1586","1784","1786","2064","2106","2221","2231","2308","2342","2352","2405","2412","2421","2429","2460","2643","2701","2726","2736","2754","2812","2910","2924","3081","3171","3219","3434","3483","3498","3558","3577","4168","4401","4406","4506","4572","4702","4907","5220","5340","5347","5353","5388","5484","5490","5512","5536","5607","6026","6113","6118","6134","6143","6158","6161","6165","6235","6275","6462","6625","6637","6732","8011","8024","8044","8048","8059","8071","8076","8077","8080","8114","8210","8222","8426","9907","1439","1455","1515","1516","1536","1708","1730","1810","1815","1903","2065","2364","2471","2849","2880","3432","3580","4131","4157","4502","4523","4934","5291","5355","5483","5488","5520","5604","6109","6122","6128","6151","6168","6171","6179","6186","6212","6223","6226","6261","6264","6269","6279","6412","6506","8043","8074","8083","8105","8933","1264","1325","1326","1336","1436","1438","1444","1446","1611","1734","1735","1762","1805","1813","1817","1909","2010","2031","2038","2059","2070","2102","2436","2718","3005","3622","3630","3675","3687","3694","3702","3704","3709","4107","4108","4419","5009","5013","5474","5523","5530","6023","6115","6116","6129","6191","6556","6590","6664","6671","6693","6703","6712","6716","6728","6752","8039","8171","8234","9918","1452","1472","1532","1593","2204","2235","2377","2414","2423","2425","2442","2489","2537","2608","2615","2634","2641","2724","2731","2801","3029","3031","3032","3036","3085","3094","3227","3260","3276","3285","3289","3317","3324","3325","3354","3363","3441","3450","3465","4142","4190","4306","4413","4545","4558","4609","4768","4905","4960","4974","5284","5457","5516","6016","6114","6163","6197","6204","6233","6415","6504","6584","6613","8066","8081","8086","8088","8101","8284","8354","1310","1312","1315","1324","1410","1435","1442","1445","1599","1717","1726","2006","2061","2227","2375","2379","2449","2472","2496","2528","2542","2723","2752","2820","2852","3149","3226","3230","3252","3265","3455","3508","3541","3548","3628","3672","4105","4160","4171","4175","4205","4432","4534","4549","4551","4736","4745","4754","4906","4916","4946","4951","4979","5215","5227","5310","5348","5403","5487","5533","5534","6108","6120","6126","6139","6199","6227","6283","6432","6442","6456","6464","6486","6552","6577","6578","6661","6683","6803","8033","8050","8069","8070","8096","8478","8905","8921","8926","9921","9944","1464","1474","1476","1503","1582","1615","1616","1709","1710","1732","1737","1777","1795","1799","2067","2108","2207","2313","2314","2337","2344","2357","2359","2360","2367","2376","2392","2406","2413","2420","2431","2438","2439","2441","2444","2478","2486","2515","2545","2596","2636","2884","2885","2897","3006","3022","3035","3152","3189","3402","3520","3537","3552","3564","3576","3611","3624","3625","4138","4192","4729","4743","4927","5880","6642","6643","6654","6695","6721","6733","8155","8240","8444","8450","8488","8906","8917","8929","9906","9928"]);
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function fm(dataset,id){
 for(let a=0;a<3;a++){const u=new URL(API);u.searchParams.set('dataset',dataset);if(id)u.searchParams.set('data_id',id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);const r=await fetch(u);if(r.ok)return (await r.json()).data||[];if(a===2)throw Error(dataset+' '+(id||'')+' '+r.status);await sleep(300*(a+1))}
}
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);if(!r.ok)throw Error('info '+r.status);return (await r.json()).data||[]}
async function twseDelisted(){
 const r=await fetch('https://www.twse.com.tw/rwd/zh/company/suspendListing?response=json',{headers:{'User-Agent':'Mozilla/5.0'}});const j=await r.json();
 return (j.data||[]).map(x=>{const [roc,name,code]=x,p=roc.split('/').map(Number);return{code,name,date:(p[0]+1911)+'-'+String(p[1]).padStart(2,'0')+'-'+String(p[2]).padStart(2,'0'),market:'twse'}}).filter(x=>/^[0-9]{4}$/.test(x.code)&&x.date>='2021-01-01'&&x.date<='2026-09-22');
}
async function tpexDelisted(){
 const out=[];for(const year of [2021,2022,2023,2024,2025,2026]){
  const r=await fetch('https://www.tpex.org.tw/www/zh-tw/company/deListed?code=&date='+year+'&reason=-1',{headers:{'User-Agent':'Mozilla/5.0','Referer':'https://www.tpex.org.tw/zh-tw/mainboard/listed/delisted.html'}});
  const j=await r.json();for(const x of j?.tables?.[0]?.data||[]){const p=x[2].split('-').map(Number);if(/^[0-9]{4}$/.test(x[0])&&p.length===3)out.push({code:x[0],name:x[1],date:(p[0]+1911)+'-'+String(p[1]).padStart(2,'0')+'-'+String(p[2]).padStart(2,'0'),market:'tpex'});}
 }
 return out.filter(x=>x.date>='2021-01-01'&&x.date<='2026-09-22');
}
function P(rows){return rows.map(x=>({date:x.date,close:+x.close})).filter(x=>x.close>0).sort((a,b)=>a.date.localeCompare(b.date))}
function mom6(p,i){return i>=126?p[i-21].close/p[i-126].close-1:null}
function rank(vals){const idx=vals.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),r=new Array(vals.length);let k=0;while(k<idx.length){let j=k;while(j+1<idx.length&&idx[j+1][0]===idx[k][0])j++;const rr=(k+j)/2+1;for(let z=k;z<=j;z++)r[idx[z][1]]=rr;k=j+1}return r}
function pct(vals){const r=rank(vals);return r.map(x=>(x-1)/(vals.length-1||1))}
function perm(vals,B=20000){let seed=919191;const r=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};const obs=mean(vals);let e=0;for(let b=0;b<B;b++)if(mean(vals.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function boot(vals,B=10000){let seed=818181;const r=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};const v=[];for(let b=0;b<B;b++){const a=[];for(let i=0;i<vals.length;i++)a.push(vals[Math.floor(r()*vals.length)]);v.push(mean(a))}return[q(v,.025),q(v,.975)]}
(async()=>{
 console.log('PROTOCOL',JSON.stringify({
  objective:'Broad fresh-universe validation of MOM6 right-tail effect with delistings and sector-neutral check',
  freshUniverse:'150 current TWSE/TPEx stocks not used in any prior research round',
  survivorship:'all official 2021-2026 TWSE+TPEx delistings added',
  source:'FinMind TaiwanStockPrice raw close for every stock',
  horizon:'84 trading days',winner:'>=20%',
  tests:['raw top10/20/30%','sector-neutral top20%','1% cost stress','15/20/30% winner thresholds','pre/post-2024 stability']
 }));
 const raw=await info(),latest=new Map();
 for(const x of raw){if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||EX.has(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x)}
 const rr=rng(SEED),cand=[...latest.values()].sort(()=>rr()-.5),surv={};
 for(const s of cand){if(Object.keys(surv).length>=TARGET)break;try{const p=P(await fm('TaiwanStockPrice',s.stock_id));if(p.length<900||p[0].date>'2021-01-15')continue;surv[s.stock_id]={p,map:new Map(p.map((x,i)=>[x.date,i])),industry:s.industry_category||'UNKNOWN',name:s.stock_name,type:s.type};}catch{} await sleep(60)}
 const [twseD,tpexD]=await Promise.all([twseDelisted(),tpexDelisted()]);const dels=[...new Map([...twseD,...tpexD].map(x=>[x.code,x])).values()];
 const infoMap=new Map(raw.map(x=>[x.stock_id,x.industry_category||'UNKNOWN']));
 const data={...surv};
 for(const d of dels){if(data[d.code])continue;try{const p=P(await fm('TaiwanStockPrice',d.code));if(p.length)data[d.code]={p,map:new Map(p.map((x,i)=>[x.date,i])),industry:infoMap.get(d.code)||'UNKNOWN',name:d.name,type:d.market,delisted:true,delistDate:d.date};}catch{} await sleep(60)}
 console.log('LOCK',JSON.stringify({freshSurvivors:Object.keys(surv).length,delisted:dels.length,total:Object.keys(data).length}));
 const base=data[Object.keys(surv)[0]].p,cal=base.map(x=>x.date),pos=new Map(cal.map((d,i)=>[d,i])),dates=[];
 for(let i=252;i<cal.length-H;i+=63){const d=cal[i];if(d>='2021-02-01'&&d<='2026-04-30')dates.push(d)}
 console.log('DATES',JSON.stringify(dates));
 function snapshot(date,worst=false){
  const rows=[];const targetPos=(pos.get(date)??-999)+H;
  for(const [code,d] of Object.entries(data)){const i=d.map.get(date);if(i==null||i<126)continue;const m=mom6(d.p,i);if(!Number.isFinite(m))continue;let ret=null;
   if(d.p[i+H])ret=d.p[i+H].close/d.p[i].close-1;else{const lp=pos.get(d.p.at(-1).date);if(lp!=null&&lp<targetPos)ret=worst?-1:d.p.at(-1).close/d.p[i].close-1}
   if(Number.isFinite(ret))rows.push({code,m,ret,industry:d.industry,delisted:!!d.delisted});
  }return rows;
 }

 function buildScores(rows){
   const sectorGroups=new Map();
   for(const x of rows){const sec=x.industry||'UNKNOWN';if(!sectorGroups.has(sec))sectorGroups.set(sec,[]);sectorGroups.get(sec).push(x)}
   const eligibleSectors=[...sectorGroups.entries()].filter(([s,g])=>g.length>=3);
   const sectorMom=new Map(eligibleSectors.map(([s,g])=>[s,median(g.map(x=>x.m))]));
   const secs=[...sectorMom.keys()],secRanks=pct(secs.map(s=>sectorMom.get(s))),sectorScore=new Map(secs.map((s,i)=>[s,secRanks[i]]));
   const withinScore=new Map();
   for(const [s,g] of eligibleSectors){const pr=pct(g.map(x=>x.m));g.forEach((x,i)=>withinScore.set(x.code,pr[i]));}
   return {sectorGroups,sectorScore,withinScore};
 }
 function evalMode(mode,frac=.20,cost=0,thr=.20,worst=true){
   const per=[];let total=0,winners=0,selN=0,selW=0,sectorShares=[],sectorCount=[];
   for(const date of dates){
     const rows=snapshot(date,worst);if(rows.length<80)continue;
     const {sectorScore,withinScore}=buildScores(rows);
     const vals=[];
     for(const x of rows){
       let score=null;
       if(mode==='TOTAL') score=x.m;
       if(mode==='SECTOR') score=sectorScore.get(x.industry);
       if(mode==='WITHIN') score=withinScore.get(x.code);
       if(mode==='COMBINED'){const a=sectorScore.get(x.industry),b=withinScore.get(x.code);score=Number.isFinite(a)&&Number.isFinite(b)?(a+b)/2:null}
       if(Number.isFinite(score)) vals.push({...x,score});
     }
     if(vals.length<60)continue;
     const k=Math.max(5,Math.floor(vals.length*frac)),sel=[...vals].sort((a,b)=>b.score-a.score).slice(0,k);
     const baseRate=mean(vals.map(x=>x.ret>=thr?1:0)),precision=mean(sel.map(x=>x.ret-cost>=thr?1:0)),lift=precision-baseRate;
     const counts={};for(const x of sel)counts[x.industry]=(counts[x.industry]||0)+1;
     const maxShare=Math.max(...Object.values(counts))/sel.length;
     sectorShares.push(maxShare);sectorCount.push(Object.keys(counts).length);
     per.push({date,n:vals.length,k,baseRate,precision,lift,maxSectorShare:maxShare,nSectors:Object.keys(counts).length});
     total+=vals.length;winners+=vals.filter(x=>x.ret>=thr).length;selN+=sel.length;selW+=sel.filter(x=>x.ret-cost>=thr).length;
   }
   const L=per.map(x=>x.lift);
   return {mode,nDates:per.length,baseRate:mean(per.map(x=>x.baseRate)),precision:mean(per.map(x=>x.precision)),lift:mean(L),positive:L.filter(x=>x>0).length/L.length,p:perm(L),ci:boot(L),
     pooledBase:winners/total,pooledPrecision:selW/selN,avgMaxSectorShare:mean(sectorShares),avgSelectedSectorCount:mean(sectorCount),perDate:per};
 }
 function evalSectorCap(capShare=.25,frac=.20,cost=0,thr=.20,worst=true){
   const per=[];
   for(const date of dates){
     const rows=snapshot(date,worst);if(rows.length<80)continue;
     const k=Math.max(5,Math.floor(rows.length*frac)),cap=Math.max(1,Math.floor(k*capShare)),sorted=[...rows].sort((a,b)=>b.m-a.m),sel=[],cnt={};
     for(const x of sorted){const s=x.industry||'UNKNOWN';if((cnt[s]||0)>=cap)continue;sel.push(x);cnt[s]=(cnt[s]||0)+1;if(sel.length>=k)break}
     if(sel.length<Math.floor(k*.8))continue;
     const br=mean(rows.map(x=>x.ret>=thr?1:0)),pr=mean(sel.map(x=>x.ret-cost>=thr?1:0)),lift=pr-br;
     per.push({date,n:rows.length,k:sel.length,baseRate:br,precision:pr,lift,maxSectorShare:Math.max(...Object.values(cnt))/sel.length,nSectors:Object.keys(cnt).length});
   }
   const L=per.map(x=>x.lift);return{capShare,nDates:per.length,baseRate:mean(per.map(x=>x.baseRate)),precision:mean(per.map(x=>x.precision)),lift:mean(L),positive:L.filter(x=>x>0).length/L.length,p:perm(L),ci:boot(L),avgMaxSectorShare:mean(per.map(x=>x.maxSectorShare)),avgSelectedSectorCount:mean(per.map(x=>x.nSectors)),perDate:per};
 }
 const modes={TOTAL:evalMode('TOTAL'),SECTOR:evalMode('SECTOR'),WITHIN:evalMode('WITHIN'),COMBINED:evalMode('COMBINED')};
 const capped={cap20:evalSectorCap(.20),cap25:evalSectorCap(.25),cap33:evalSectorCap(.33)};
 const split={};
 for(const [k,v] of Object.entries(modes)){
   const e=v.perDate.filter(x=>x.date<'2024-01-01').map(x=>x.lift),l=v.perDate.filter(x=>x.date>='2024-01-01').map(x=>x.lift);
   split[k]={early:{n:e.length,mean:mean(e),p:perm(e),ci:boot(e)},late:{n:l.length,mean:mean(l),p:perm(l),ci:boot(l)}};
 }
 console.log('RESULT',JSON.stringify({modes,capped,split}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
