
const API='https://api.finmindtrade.com/api/v4/data';
const START='2020-01-01',END='2026-09-22',SEED=20261004;
const HORIZONS=[21,63,126];
const STOCKS=[...new Set([
'2330','2454','2409','2881','1301','2434','1454','3419','4938','8499','4581','6525','6831','2009','8473','1437','6164','5264','6965','9942','2437','6153','5471','9938','5285','6541','4441','1262','4989','1618','6281','7765','6202','6919','7795','4566','1721','6230',
'8464','1512','3026','3593','2385','3168','3494','4169','2340','1101','3266','2316','3296','3346','4137','1465','2362','2033','2017','1475','1216','1220','1477','2321','3257','3596','3356','2328','1102','4164','2387','2236','3376','3532','3711','8021','2072','2630','6206','1605',
'2312','2443','3652','2497','2402','4915','3030','6438','1723','3563','6176','3583','9919','2485','2543','8110','2606','2480','2547','9935','3645','6906','2509','2498','2607','3686','8462','3543','2603','4763','2404','2530','2504','8443','6005','8438','3673','2495','4771','6592',
'4564','6213','6589','3706','6405','9937','6719','1722','6278','6443','6257','6183','8261','6152','9917','6531','6243','1707','1608','6272','1434','9902','6282','1453','1714','8466','6285','6689','6239','6177','1612','2816','6271','8131','2393','4414','3708','6796','6657','1110',
'2923','3380','1210','1304','2022','3164','2062','1808','3209','2365','3515','2233','2109','3406','2317','1529','2324','2373','1526','1905','1537','2354','1449','4562','2114','5521','2101','2305','4439','5258','4935','6117','3311','5007','1521','3557','6142','6136','2426','2484','2419','2323','4104','2540','4930','2453','5469','5538','2476','1103',
'3054','6550','3682','2867','2358','1701','2601','1441','8480','1589','2888','6806','3454','2809'
])];
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const sd=a=>{if(a.length<2)return null;const m=mean(a);return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1))}
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
async function fm(dataset,id){const u=new URL(API);u.searchParams.set('dataset',dataset);if(id)u.searchParams.set('data_id',id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);const r=await fetch(u);if(!r.ok)throw Error(dataset+' '+(id||'')+' '+r.status);const j=await r.json();return j.data||[]}
function P(raw){return raw.map(r=>({date:r.date,close:+r.close})).filter(x=>Number.isFinite(x.close)&&x.close>0).sort((a,b)=>a.date.localeCompare(b.date))}
function latestShares(rows,date){let best=null;for(const r of rows)if(r.date<=date&&(!best||r.date>best.date)){const v=+r.NumberOfSharesIssued;if(Number.isFinite(v)&&v>0)best={date:r.date,v}}return best?.v??null}
function pastRet(p,i,a,b=0){const i1=i-b,i0=i-a;if(i0<0||i1<0)return null;return p[i1].close/p[i0].close-1}
function high52(p,i){if(i<251)return null;const m=Math.max(...p.slice(i-251,i+1).map(x=>x.close));return p[i].close/m}
function outcome(p,date,h){const i=p.findIndex(x=>x.date===date);return i>=0&&p[i+h]?p[i+h].close/p[i].close-1:null}
function rank(vals){const idx=vals.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]),r=new Array(vals.length);let k=0;while(k<idx.length){let j=k;while(j+1<idx.length&&idx[j+1][0]===idx[k][0])j++;const rr=(k+j)/2+1;for(let z=k;z<=j;z++)r[idx[z][1]]=rr;k=j+1}return r}
function corr(a,b){if(a.length<3)return null;const ma=mean(a),mb=mean(b),sa=Math.sqrt(a.reduce((s,x)=>s+(x-ma)**2,0)),sb=Math.sqrt(b.reduce((s,x)=>s+(x-mb)**2,0));if(!sa||!sb)return null;return a.reduce((s,x,i)=>s+(x-ma)*(b[i]-mb),0)/(sa*sb)}
function z(a){const m=mean(a),s=sd(a);return s?a.map(x=>(x-m)/s):a.map(()=>0)}
function residualize(y, xs){ // y and each xs standardized; Gram-Schmidt via normal equations small k
 const n=y.length,k=xs.length; const X=Array.from({length:n},(_,i)=>[1,...xs.map(a=>a[i])]);
 const A=Array.from({length:k+1},()=>Array(k+1).fill(0)),b=Array(k+1).fill(0);
 for(let i=0;i<n;i++)for(let a=0;a<=k;a++){b[a]+=X[i][a]*y[i];for(let c=0;c<=k;c++)A[a][c]+=X[i][a]*X[i][c]}
 for(let i=0;i<=k;i++){let piv=i;for(let r=i+1;r<=k;r++)if(Math.abs(A[r][i])>Math.abs(A[piv][i]))piv=r;[A[i],A[piv]]=[A[piv],A[i]];[b[i],b[piv]]=[b[piv],b[i]];const d=A[i][i];if(Math.abs(d)<1e-10)continue;for(let c=i;c<=k;c++)A[i][c]/=d;b[i]/=d;for(let r=0;r<=k;r++)if(r!==i){const f=A[r][i];for(let c=i;c<=k;c++)A[r][c]-=f*A[i][c];b[r]-=f*b[i]}}
 return y.map((v,i)=>v-X[i].reduce((s,x,j)=>s+x*b[j],0));
}
function fmbJoint(rows){
 const r=rows.filter(x=>['HIGH52','MOM6','cap','ret'].every(k=>Number.isFinite(x[k])));if(r.length<40)return null;
 const H=z(r.map(x=>x.HIGH52)),M=z(r.map(x=>x.MOM6)),S=z(r.map(x=>Math.log(x.cap))),Y=r.map(x=>x.ret);
 const Hr=residualize(H,[M,S]),mr=mean(Hr),my=mean(Y),den=Hr.reduce((s,x)=>s+(x-mr)**2,0),num=Hr.reduce((s,x,i)=>s+(x-mr)*(Y[i]-my),0);
 return den?num/den:null;
}
function industryNeutral(rows,infoMap){
 const groups=new Map();for(const x of rows){const ind=infoMap.get(x.code)||'UNKNOWN';if(!groups.has(ind))groups.set(ind,[]);groups.get(ind).push(x)}
 const out=[];for(const [ind,g] of groups){if(g.length<3)continue;const rh=rank(g.map(x=>x.HIGH52));for(let i=0;i<g.length;i++)out.push({...g[i],IND_HIGH:rh[i]/g.length})}return out;
}
function longShort(rows,field){
 const r=rows.filter(x=>Number.isFinite(x[field])&&Number.isFinite(x.cap)).sort((a,b)=>a.cap-b.cap);if(r.length<40)return null;
 const cuts=[0,Math.floor(r.length/3),Math.floor(2*r.length/3),r.length],T=[],B=[];
 for(let c=0;c<3;c++){const bucket=r.slice(cuts[c],cuts[c+1]).sort((a,b)=>b[field]-a[field]),k=Math.max(3,Math.floor(bucket.length*.2));T.push(...bucket.slice(0,k));B.push(...bucket.slice(-k))}
 return {spread:mean(T.map(x=>x.ret))-mean(B.map(x=>x.ret)),top:mean(T.map(x=>x.ret)),bottom:mean(B.map(x=>x.ret)),topR:T.map(x=>x.ret),bottomR:B.map(x=>x.ret)};
}
function nonOverlapDates(cal){const out=[];for(const d of cal){if(d<'2021-01-01'||d>'2026-05-31'||+d.slice(8,10)<10||+d.slice(8,10)>20)continue;if(!out.length){out.push(d);continue}const i=cal.indexOf(d),j=cal.indexOf(out[out.length-1]);if(i-j>=63)out.push(d)}return out}
function perm(vals,B=20000){const obs=mean(vals),r=rng(9087);let e=0;for(let b=0;b<B;b++)if(mean(vals.map(x=>r()<.5?x:-x))>=obs)e++;return(e+1)/(B+1)}
function boot(vals,B=10000){const r=rng(7766),v=[];for(let b=0;b<B;b++){const a=[];for(let i=0;i<vals.length;i++)a.push(vals[Math.floor(r()*vals.length)]);v.push(mean(a))}return[q(v,.025),q(v,.975)]}
function winsor(a,p=.1){const lo=q(a,p),hi=q(a,1-p);return a.map(x=>Math.max(lo,Math.min(hi,x)))}
(async()=>{
 const info=await fm('TaiwanStockInfo','');const im=new Map();for(const x of info){if(STOCKS.includes(x.stock_id))im.set(x.stock_id,x.industry_category||'UNKNOWN')}
 const data={};for(const code of STOCKS){let pr=[],sh=[];try{pr=await fm('TaiwanStockPrice',code)}catch(e){console.log('PRICE_SKIP',code);continue}try{sh=await fm('TaiwanStockShareholding',code)}catch(e){console.log('SH_SKIP',code)}const p=P(pr);if(p.length<400)continue;data[code]={p,sh}}
 const cal=(await fm('TaiwanStockTotalReturnIndex','TAIEX')).map(x=>x.date).sort(),dates=nonOverlapDates(cal);
 const all={};
 for(const h of HORIZONS){
   const rec=[];
   for(const date of dates){
     const rows=[];
     for(const code of Object.keys(data)){const d=data[code],i=d.p.findIndex(x=>x.date===date);if(i<252)continue;const sh=latestShares(d.sh,date),ret=outcome(d.p,date,h);if(!sh||ret==null)continue;rows.push({code,HIGH52:high52(d.p,i),MOM6:pastRet(d.p,i,126,21),cap:d.p[i].close*sh,ret})}
     if(rows.length<50)continue;
     const ir=industryNeutral(rows,im),ls=longShort(rows,'HIGH52'),ils=longShort(ir,'IND_HIGH'),coef=fmbJoint(rows);
     if(ls)rec.push({date,n:rows.length,spread:ls.spread,top:ls.top,bottom:ls.bottom,coef,indSpread:ils?.spread??null,wSpread:mean(winsor(ls.topR))-mean(winsor(ls.bottomR)),conservative:mean([...ls.topR].sort((a,b)=>a-b).slice(0,-1))-mean(ls.bottomR)});
   }
   const s=rec.map(x=>x.spread),is=rec.map(x=>x.indSpread).filter(Number.isFinite),co=rec.map(x=>x.coef).filter(Number.isFinite),ws=rec.map(x=>x.wSpread),cs=rec.map(x=>x.conservative);
   const years={};for(const y of ['2021','2022','2023','2024','2025','2026']){const a=rec.filter(x=>x.date.startsWith(y)).map(x=>x.spread);if(a.length)years[y]={n:a.length,mean:mean(a),positive:a.filter(x=>x>0).length/a.length}}
   all[h]={n:rec.length,spread:{mean:mean(s),median:median(s),positive:s.filter(x=>x>0).length/s.length,permP:perm(s),ci:boot(s)},industryNeutral:{mean:mean(is),positive:is.filter(x=>x>0).length/is.length,permP:perm(is),ci:boot(is)},jointFMB:{mean:mean(co),positive:co.filter(x=>x>0).length/co.length,ci:boot(co)},winsor:{mean:mean(ws),permP:perm(ws),ci:boot(ws)},removeBestTop:{mean:mean(cs),permP:perm(cs),ci:boot(cs)},years,byDate:rec}
 }
 console.log('RESULT',JSON.stringify({nStocks:STOCKS.length,results:all}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
