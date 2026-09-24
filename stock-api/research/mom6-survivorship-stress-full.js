
const API='https://api.finmindtrade.com/api/v4/data';
const START='2020-01-01', END='2026-09-22', H=84;
const CURRENT=["1259","1418","1468","1809","2014","2027","2103","2345","2349","2399","2704","2705","2707","2739","2937","3131","3512","3703","3710","4109","4129","4956","4999","5203","5228","5278","5283","5356","5475","5514","5522","5601","5703","5704","5706","6124","6140","6147","6210","6220","6485","6494","6496","6499","6508","6517","6526","6532","6574","6576","6667","8042","8049","8279","8424","8482","8908","8937","9929","9962"];
const DATES=["2021-02-17","2021-05-24","2021-08-20","2021-11-22","2022-03-02","2022-06-02","2022-08-31","2022-11-30","2023-03-14","2023-06-15","2023-09-15","2023-12-18","2024-03-27","2024-06-28","2024-09-30","2025-01-02","2025-04-15","2025-07-15","2025-10-16","2026-01-16","2026-04-29"];
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const q=(a,p)=>{const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
function perm(vals,B=20000){let seed=20261019;const r=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};const obs=mean(vals);let e=0;for(let b=0;b<B;b++)if(mean(vals.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function boot(vals,B=10000){let seed=20261020;const r=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};const v=[];for(let b=0;b<B;b++){const a=[];for(let i=0;i<vals.length;i++)a.push(vals[Math.floor(r()*vals.length)]);v.push(mean(a))}return[q(v,.025),q(v,.975)]}
async function fmPrice(code){
 const u=new URL(API);u.searchParams.set('dataset','TaiwanStockPrice');u.searchParams.set('data_id',code);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);
 const r=await fetch(u);if(!r.ok)throw Error(code+' '+r.status);const j=await r.json();return (j.data||[]).map(x=>({date:x.date,close:+x.close})).filter(x=>x.close>0).sort((a,b)=>a.date.localeCompare(b.date));
}
async function tpexDelisted(){
 const out=[];
 for(const year of [2021,2022,2023,2024,2025,2026]){
   const r=await fetch('https://www.tpex.org.tw/www/zh-tw/company/deListed?code=&date='+year+'&reason=-1',{headers:{'User-Agent':'Mozilla/5.0','Referer':'https://www.tpex.org.tw/zh-tw/mainboard/listed/delisted.html'}});
   const j=await r.json();const rows=j?.tables?.[0]?.data||[];
   for(const x of rows){const code=x[0],name=x[1],roc=x[2];const p=roc.split('-').map(Number);if(/^[0-9]{4}$/.test(code)&&p.length===3)out.push({code,name,date:(p[0]+1911)+'-'+String(p[1]).padStart(2,'0')+'-'+String(p[2]).padStart(2,'0'),market:'tpex'});}
 }
 return out.filter(x=>x.date>='2021-01-01'&&x.date<='2026-09-22');
}
async function twseDelisted(){
 const r=await fetch('https://www.twse.com.tw/rwd/zh/company/suspendListing?response=json',{headers:{'User-Agent':'Mozilla/5.0'}});
 const j=await r.json();return (j.data||[]).map(x=>{const [roc,name,code]=x,parts=roc.split('/').map(Number);return {code,name,date:(parts[0]+1911)+'-'+String(parts[1]).padStart(2,'0')+'-'+String(parts[2]).padStart(2,'0')}})
  .filter(x=>/^[0-9]{4}$/.test(x.code)&&x.date>='2021-01-01'&&x.date<='2026-09-22').map(x=>({...x,market:'twse'}));
}
function mom6(p,i){return i>=126?p[i-21].close/p[i-126].close-1:null}
(async()=>{
 console.log('PROTOCOL',JSON.stringify({
  objective:'Comprehensive TWSE+TPEx survivorship-bias stress test of MOM6 right-tail selection',
  universe:'same 60 fresh stocks plus every 4-digit TWSE and TPEx company officially delisted during 2021-2026 with FinMind historical prices',
  priceSource:'FinMind TaiwanStockPrice raw close for both surviving and delisted stocks',
  pointInTime:'stock eligible only if it traded on snapshot date and had 126 prior observations',
  primary:'top 20% MOM6; winner = future 84 trading-day return >=20%',
  delistStress:['observed-last-price if delisted before 84d','worst-case -100% if delisted before 84d'],
  compare:'current-only raw-price baseline versus augmented delisted universe'
 }));
 const [twseD,tpexD]=await Promise.all([twseDelisted(),tpexDelisted()]);const dels=[...new Map([...twseD,...tpexD].map(x=>[x.code,x])).values()];console.log('OFFICIAL_DELISTED',JSON.stringify({twse:twseD.length,tpex:tpexD.length,unique:dels.length,rows:dels}));
 const allCodes=[...new Set([...CURRENT,...dels.map(x=>x.code)])],data={};
 for(const code of allCodes){try{const p=await fmPrice(code);if(p.length)data[code]={p,map:new Map(p.map((x,i)=>[x.date,i]))};}catch(e){console.log('SKIP',code,e.message)}}
 console.log('COVERAGE',JSON.stringify({current:CURRENT.filter(x=>data[x]).length,delisted:dels.filter(x=>data[x.code]).length,total:Object.keys(data).length}));
 const cal=data[CURRENT.find(x=>data[x])].p.map(x=>x.date),calPos=new Map(cal.map((d,i)=>[d,i]));
 function evaluate(includeDelisted,worstCase){
  const per=[];let selN=0,selW=0,allW=0,allN=0,delSel=0;
  for(const date of DATES){
   const rows=[];
   const codes=includeDelisted?[...new Set([...CURRENT,...dels.map(x=>x.code)])]:CURRENT;
   for(const code of codes){
    const d=data[code];if(!d)continue;const i=d.map.get(date);if(i==null||i<126)continue;const m=mom6(d.p,i);if(!Number.isFinite(m))continue;
    const targetCal=(calPos.get(date)??-999)+H;
    let ret=null,forced=false;
    if(d.p[i+H]) ret=d.p[i+H].close/d.p[i].close-1;
    else{
      const last=d.p[d.p.length-1],lp=calPos.get(last.date);
      if(lp!=null&&lp<targetCal){forced=true;ret=worstCase?-1:last.close/d.p[i].close-1;}
    }
    if(!Number.isFinite(ret))continue;
    rows.push({code,m,ret,winner:ret>=.20,delisted:dels.some(x=>x.code===code),forced});
   }
   if(rows.length<20)continue;
   const k=Math.max(4,Math.floor(rows.length*.20)),sel=[...rows].sort((a,b)=>b.m-a.m).slice(0,k);
   const br=mean(rows.map(x=>x.winner?1:0)),pr=mean(sel.map(x=>x.winner?1:0)),lift=pr-br;
   per.push({date,n:rows.length,k,baseRate:br,precision:pr,lift,delistedEligible:rows.filter(x=>x.delisted).length,delistedSelected:sel.filter(x=>x.delisted).length,forcedEligible:rows.filter(x=>x.forced).length});
   allN+=rows.length;allW+=rows.filter(x=>x.winner).length;selN+=sel.length;selW+=sel.filter(x=>x.winner).length;delSel+=sel.filter(x=>x.delisted).length;
  }
  const L=per.map(x=>x.lift);
  return {nDates:per.length,avgUniverseSize:mean(per.map(x=>x.n)),avgBaseRate:mean(per.map(x=>x.baseRate)),avgPrecision:mean(per.map(x=>x.precision)),winnerLift:mean(L),positive:L.filter(x=>x>0).length/L.length,p:perm(L),ci:boot(L),pooledBaseRate:allW/allN,pooledPrecision:selW/selN,delistedSelections:delSel,perDate:per};
 }
 const currentRaw=evaluate(false,false),augObserved=evaluate(true,false),augWorst=evaluate(true,true);
 const diffObs=augObserved.perDate.map((x,i)=>x.lift-currentRaw.perDate[i].lift),diffWorst=augWorst.perDate.map((x,i)=>x.lift-currentRaw.perDate[i].lift);
 console.log('RESULT',JSON.stringify({
  currentOnlyRaw:currentRaw,
  augmentedObservedLastPrice:augObserved,
  augmentedWorstCaseDelistMinus100:augWorst,
  changeObserved:{mean:mean(diffObs),ci:boot(diffObs)},
  changeWorst:{mean:mean(diffWorst),ci:boot(diffWorst)},
  residualLimitation:'Historical universe is still a stress augmentation rather than a full census of every stock that was listed at every snapshot; however both official TWSE and TPEx delisted-company lists for 2021-2026 are incorporated.'
 }));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
