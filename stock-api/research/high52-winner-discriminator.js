
const API='https://api.finmindtrade.com/api/v4/data';
const START_TS=Math.floor(new Date('2020-01-01T00:00:00Z').getTime()/1000);
const END_TS=Math.floor(new Date('2026-09-23T00:00:00Z').getTime()/1000);
const SEED=20261008, TARGET=80, H=84;

// All stocks used in earlier research are excluded.
const EX=new Set([
'2330','2454','2409','2881','1301','2434','1454','3419','4938','8499','4581','6525','6831','2009','8473','1437','6164','5264','6965','9942','2437','6153','5471','9938','5285','6541','4441','1262','4989','1618','6281','7765','6202','6919','7795','4566','1721','6230',
'8464','1512','3026','3593','2385','3168','3494','4169','2340','1101','3266','2316','3296','3346','4137','1465','2362','2033','2017','1475','1216','1220','1477','2321','3257','3596','3356','2328','1102','4164','2387','2236','3376','3532','3711','8021','2072','2630','6206','1605',
'2312','2443','3652','2497','2402','4915','3030','6438','1723','3563','6176','3583','9919','2485','2543','8110','2606','2480','2547','9935','3645','6906','2509','2498','2607','3686','8462','3543','2603','4763','2404','2530','2504','8443','6005','8438','3673','2495','4771','6592',
'4564','6213','6589','3706','6405','9937','6719','1722','6278','6443','6257','6183','8261','6152','9917','6531','6243','1707','1608','6272','1434','9902','6282','1453','1714','8466','6285','6689','6239','6177','1612','2816','6271','8131','2393','4414','3708','6796','6657','1110',
'2923','3380','1210','1304','2022','3164','2062','1808','3209','2365','3515','2233','2109','3406','2317','1529','2324','2373','1526','1905','1537','2354','1449','4562','2114','5521','2101','2305','4439','5258','4935','6117','3311','5007','1521','3557','6142','6136','2426','2484','2419','2323','4104','2540','4930','2453','5469','5538','2476','1103',
'3054','6550','3682','2867','2358','1701','2601','1441','8480','1589','2888','6806','3454','2809',
'1104','1203','1225','1231','1234','1256','1307','1321','1341','1413','1414','1416','1417','1443','1466','1471','1531','1583','1590','1597','1614','2208','2228','2243','2247','2302','2303','2327','2332','2356','2368','2374','2383','2408','2417','2428','2466','2534','2613','2614','2633','2727','3518','3679','3701','4532','4583','5906','6416','6431','6581','6691','6706','8249','8454','8940','9136','9912','9926','9930'
]);

const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
async function info(){
 const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');
 const r=await fetch(u);if(!r.ok)throw Error('info '+r.status);return (await r.json()).data||[];
}
async function yahoo(code,sfx){
 const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+sfx+'?period1='+START_TS+'&period2='+END_TS+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';
 const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(!r.ok)throw Error(code+' '+r.status);
 const j=await r.json(),x=j?.chart?.result?.[0];if(!x)return [];
 const t=x.timestamp||[],adj=x.indicators?.adjclose?.[0]?.adjclose||[],cl=x.indicators?.quote?.[0]?.close||[],vol=x.indicators?.quote?.[0]?.volume||[],a=[];
 for(let i=0;i<t.length;i++){const v=Number.isFinite(adj[i])?adj[i]:cl[i];if(Number.isFinite(v)&&v>0)a.push({date:new Date(t[i]*1000).toISOString().slice(0,10),close:v,vol:Number.isFinite(vol[i])?vol[i]:null})}
 return a;
}
function highN(p,i,n){if(i<n-1)return null;return p[i].close/Math.max(...p.slice(i-n+1,i+1).map(x=>x.close))}
function pastRet(p,i,n,b=0){const a=i-n,c=i-b;if(a<0||c<0)return null;return p[c].close/p[a].close-1}
function vol60(p,i){if(i<60)return null;const rs=[];for(let j=i-59;j<=i;j++)rs.push(Math.log(p[j].close/p[j-1].close));const m=mean(rs);return Math.sqrt(mean(rs.map(x=>(x-m)**2)))*Math.sqrt(252)}
function avgTurn(p,i,n=20){if(i<n-1)return null;const xs=p.slice(i-n+1,i+1).map(x=>x.vol).filter(Number.isFinite);return xs.length?mean(xs):null}
function rank(vals){const idx=vals.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),r=new Array(vals.length);let k=0;while(k<idx.length){let j=k;while(j+1<idx.length&&idx[j+1][0]===idx[k][0])j++;const rr=(k+j)/2+1;for(let z=k;z<=j;z++)r[idx[z][1]]=rr;k=j+1}return r}
function corr(a,b){if(a.length<3)return null;const ma=mean(a),mb=mean(b),sa=Math.sqrt(a.reduce((s,x)=>s+(x-ma)**2,0)),sb=Math.sqrt(b.reduce((s,x)=>s+(x-mb)**2,0));if(!sa||!sb)return null;return a.reduce((s,x,i)=>s+(x-ma)*(b[i]-mb),0)/(sa*sb)}
function perm(vals,B=20000){let seed=661123;const r=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};const obs=mean(vals);let e=0;for(let b=0;b<B;b++)if(mean(vals.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function boot(vals,B=10000){let seed=771233;const r=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};const v=[];for(let b=0;b<B;b++){const a=[];for(let i=0;i<vals.length;i++)a.push(vals[Math.floor(r()*vals.length)]);v.push(mean(a))}return[q(v,.025),q(v,.975)]}

(async()=>{
 const candidates=[
   {key:'MOM6_1',desc:'6-to-1 month momentum',dir:1},
   {key:'MOM3',desc:'3 month momentum',dir:1},
   {key:'MOM1',desc:'1 month momentum',dir:1},
   {key:'LOWVOL',desc:'lower 60d volatility',dir:1},
   {key:'HIGH20',desc:'closer to 20d high',dir:1},
   {key:'VOL20',desc:'higher 20d turnover proxy',dir:1}
 ];
 console.log('PROTOCOL',JSON.stringify({
   objective:'Among stocks already in HIGH52 top quintile, find a second-stage discriminator of 84d winners',
   sample:'fresh stocks not used previously; fresh non-overlapping dates',
   candidateFactors:candidates,
   primaryMetric:'within HIGH52-top-quintile, factor top half minus bottom half future 84d return',
   winnerMetric:'future 84d return >= +20%',
   correction:'Holm adjustment across 6 candidate factors',
   passRule:'candidate must have positive mean spread, Holm p<0.05, bootstrap lower>0, positive IC, and winner-rate uplift positive'
 }));
 const raw=await info(),latest=new Map();
 for(const x of raw){
   if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||EX.has(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創'))continue;
   const o=latest.get(x.stock_id);if(!o||x.date>o.date)latest.set(x.stock_id,x);
 }
 const rsel=rng(SEED),cand=[...latest.values()].sort(()=>rsel()-.5),data={};
 for(const s of cand){
   if(Object.keys(data).length>=TARGET)break;
   const sfx=s.type==='tpex'?'.TWO':'.TW';
   try{
     const p=await yahoo(s.stock_id,sfx);
     if(p.length<850||p[0].date>'2021-01-15')continue;
     data[s.stock_id]={p,map:new Map(p.map((x,i)=>[x.date,i])),type:s.type,name:s.stock_name};
   }catch(e){}
   await new Promise(r=>setTimeout(r,70));
 }
 console.log('LOCKED_STOCKS',JSON.stringify(Object.entries(data).map(([code,d])=>({code,name:d.name,type:d.type}))));
 const base=data[Object.keys(data)[0]]?.p;if(!base)throw Error('no stocks');
 const calendar=base.map(x=>x.date),dates=[];
 for(let i=252;i<calendar.length-H;i+=84){
   const d=calendar[i];if(d>='2021-01-01'&&d<='2026-04-30')dates.push(d);
 }
 console.log('LOCKED_DATES',JSON.stringify(dates));
 const perFactor={};for(const c of candidates)perFactor[c.key]=[];
 for(const date of dates){
   const rows=[];
   for(const [code,d] of Object.entries(data)){
     const i=d.map.get(date);if(i==null||i<252||!d.p[i+H])continue;
     const h52=highN(d.p,i,252),ret=d.p[i+H].close/d.p[i].close-1;
     const f={
       MOM6_1:pastRet(d.p,i,126,21),
       MOM3:pastRet(d.p,i,63,0),
       MOM1:pastRet(d.p,i,21,0),
       LOWVOL:(()=>{const v=vol60(d.p,i);return v==null?null:-v})(),
       HIGH20:highN(d.p,i,20),
       VOL20:(()=>{const v=avgTurn(d.p,i,20);return v==null?null:Math.log(1+v)})()
     };
     if(Number.isFinite(h52)&&Number.isFinite(ret))rows.push({code,h52,ret,...f});
   }
   if(rows.length<40)continue;
   const sorted=[...rows].sort((a,b)=>b.h52-a.h52),k=Math.max(10,Math.floor(sorted.length*.2)),pool=sorted.slice(0,k);
   for(const c of candidates){
     const rr=pool.filter(x=>Number.isFinite(x[c.key])).sort((a,b)=>b[c.key]-a[c.key]);if(rr.length<10)continue;
     const mid=Math.floor(rr.length/2),hi=rr.slice(0,mid),lo=rr.slice(mid);
     const hs=mean(hi.map(x=>x.ret)),ls=mean(lo.map(x=>x.ret)),hitHi=hi.filter(x=>x.ret>=.20).length/hi.length,hitLo=lo.filter(x=>x.ret>=.20).length/lo.length;
     perFactor[c.key].push({date,n:rr.length,spread:hs-ls,ic:corr(rank(rr.map(x=>x[c.key])),rank(rr.map(x=>x.ret))),winnerUplift:hitHi-hitLo,hitHi,hitLo});
   }
 }
 const result={},plist=[];
 for(const c of candidates){
   const a=perFactor[c.key],S=a.map(x=>x.spread),IC=a.map(x=>x.ic).filter(Number.isFinite),WU=a.map(x=>x.winnerUplift),p=perm(S);plist.push([c.key,p]);
   result[c.key]={desc:c.desc,n:a.length,spread:{mean:mean(S),median:median(S),positive:S.filter(x=>x>0).length/S.length,p,ci:boot(S)},IC:{mean:mean(IC),positive:IC.filter(x=>x>0).length/IC.length,ci:boot(IC)},winnerUplift:{mean:mean(WU),positive:WU.filter(x=>x>0).length/WU.length,ci:boot(WU)},byDate:a};
 }
 const ord=[...plist].sort((a,b)=>a[1]-b[1]);let prev=0;
 for(let i=0;i<ord.length;i++){const [k,p]=ord[i],adj=Math.max(prev,Math.min(1,p*(ord.length-i)));result[k].holmP=adj;prev=adj}
 for(const c of candidates){
   const r=result[c.key];
   r.pass=r.spread.mean>0&&r.holmP<.05&&r.spread.ci[0]>0&&r.IC.mean>0&&r.winnerUplift.mean>0;
 }
 console.log('RESULT',JSON.stringify({nStocks:Object.keys(data).length,nDates:dates.length,result}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
