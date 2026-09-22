const stocks=[
 {code:'2330',name:'台積電'},{code:'2454',name:'聯發科'},{code:'2409',name:'友達'},{code:'2881',name:'富邦金'},{code:'1301',name:'台塑'}
];
const START='2021-01-01',END='2026-09-22',SEED=20260923;
const USED=['2024-08-21','2025-08-21','2026-08-21','2023-05-16','2023-08-23','2023-11-13','2024-01-16','2024-03-25','2024-06-03','2024-10-23','2025-03-20','2025-07-03','2025-09-30','2026-01-08','2026-06-15'];
const API='https://api.finmindtrade.com/api/v4/data';
const H=[5,10,20];
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const q=(a,p)=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
const pct=(a,x)=>a.length?a.filter(v=>v<=x).length/a.length:null;
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
async function fm(dataset,id){
 const u=new URL(API);u.searchParams.set('dataset',dataset);if(id)u.searchParams.set('data_id',id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);
 const r=await fetch(u);if(!r.ok)throw Error(dataset+' '+id+' HTTP '+r.status);const j=await r.json();return j.data||[];
}
function prices(raw){return raw.map(r=>({date:r.date,open:+r.open,high:+r.max,low:+r.min,close:+r.close,vol:+r.Trading_Volume})).filter(r=>[r.open,r.high,r.low,r.close].every(Number.isFinite)).sort((a,b)=>a.date.localeCompare(b.date))}
function indexRows(raw){return raw.map(r=>({date:r.date,close:+r.price})).filter(r=>Number.isFinite(r.close)).sort((a,b)=>a.date.localeCompare(b.date))}
function ma(a,i,k,key='close'){if(i<k-1)return null;return mean(a.slice(i-k+1,i+1).map(x=>x[key]))}
function rv(a,i,k=20){if(i<k)return null;const rs=[];for(let j=i-k+1;j<=i;j++)rs.push(Math.log(a[j].close/a[j-1].close));const m=mean(rs);return Math.sqrt(mean(rs.map(x=>(x-m)**2)))*Math.sqrt(252)}
function marketFeatures(idx){
 const out=new Map();
 for(let i=120;i<idx.length;i++){
   const m=ma(idx,i,120),max120=Math.max(...idx.slice(i-119,i+1).map(x=>x.close)),v=rv(idx,i,20);
   const vh=[];for(let j=Math.max(20,i-119);j<i;j++){const z=rv(idx,j,20);if(Number.isFinite(z))vh.push(z)}
   out.set(idx[i].date,[idx[i].close/m-1,idx[i].close/max120-1,pct(vh,v)]);
 } return out;
}
function excludedDates(common){
 const pos=new Map(common.map((d,i)=>[d,i])),ex=new Set();
 for(const d of USED){const p=pos.get(d);if(p==null)continue;for(let j=Math.max(0,p-20);j<=Math.min(common.length-1,p+20);j++)ex.add(common[j])}
 return ex;
}
function outcome(p,i){
 if(i<0||!p[i+1])return null;
 const entry=p[i+1].open;if(!Number.isFinite(entry)||entry<=0)return null;
 const o={entryDate:p[i+1].date,entry};
 for(const h of H){
   if(!p[i+h])return null;
   const exit=p[i+h].close,seg=p.slice(i+1,i+h+1);
   o['r'+h]=exit/entry-1;o['mfe'+h]=Math.max(...seg.map(x=>x.high))/entry-1;o['mae'+h]=Math.min(...seg.map(x=>x.low))/entry-1;
 } return o;
}
function revenueSignals(p,rev,ex){
 const byYM=new Map(rev.map(r=>[r.revenue_year+'-'+String(r.revenue_month).padStart(2,'0'),+r.revenue]));
 const rows=[...rev].sort((a,b)=>a.date.localeCompare(b.date)),events=[];
 for(let n=24;n<rows.length;n++){
   const r=rows[n],ym=r.revenue_year+'-'+String(r.revenue_month).padStart(2,'0'),prev=(r.revenue_year-1)+'-'+String(r.revenue_month).padStart(2,'0');
   const last=byYM.get(prev);if(!last||last<=0)continue;
   const yoy=r.revenue/last-1,hist=[];
   for(let k=Math.max(12,n-24);k<n;k++){const rr=rows[k],pv=byYM.get((rr.revenue_year-1)+'-'+String(rr.revenue_month).padStart(2,'0'));if(pv>0)hist.push(rr.revenue/pv-1)}
   if(hist.length<12||pct(hist,yoy)<.8||yoy<=0)continue;
   const reportMonth=r.date.slice(0,7),cut=reportMonth+'-11';
   const i=p.findIndex(x=>x.date>=cut);if(i<20||ex.has(p[i].date))continue;
   const ma20=ma(p,i,20);if(!(p[i].close>ma20))continue;
   const o=outcome(p,i);if(o)events.push({signalDate:p[i].date,meta:{yoy,yoyPct:pct(hist,yoy)},...o});
 } return events;
}
function breakoutRetestSignals(p,ex){
 const events=[];
 for(let i=252;i<p.length-25;i++){
   const prevHigh=Math.max(...p.slice(i-252,i).map(x=>x.close));
   if(!(p[i].close>prevHigh))continue;
   const level=prevHigh;let r=-1;
   for(let j=i+1;j<=Math.min(i+5,p.length-21);j++){if(p[j].low<=level*1.02&&p[j].close>=level*.99){r=j;break}}
   if(r<0||ex.has(p[r].date))continue;
   const o=outcome(p,r);if(o)events.push({signalDate:p[r].date,meta:{breakoutDate:p[i].date,level},...o});
   i=r;
 } return events;
}
function valueTrendSignals(p,per,ex){
 const pm=new Map(per.map(x=>[x.date,+x.PER])),vals=[];
 for(let i=253;i<p.length-21;i++){
   const pe=pm.get(p[i].date);if(!(pe>0))continue;
   const hist=[];
   for(let j=Math.max(0,i-252);j<i;j++){const x=pm.get(p[j].date);if(x>0)hist.push(x)}
   if(hist.length<120||pct(hist,pe)>.3)continue;
   const m=ma(p,i,60),mp=ma(p,i-1,60);if(!(p[i].close>m&&p[i-1].close<=mp))continue;
   if(ex.has(p[i].date))continue;
   const o=outcome(p,i);if(o)vals.push({signalDate:p[i].date,meta:{PER:pe,perPct:pct(hist,pe)},...o});
 } return vals;
}
function sampleEvents(all,common,seed){
 const pos=new Map(common.map((d,i)=>[d,i])),r=rng(seed),a=[...all].sort(()=>r()-.5),chosen=[];
 for(const e of a){
   const p=pos.get(e.signalDate);if(p==null)continue;
   if(chosen.every(x=>x.code!==e.code||Math.abs(pos.get(x.signalDate)-p)>=40)){chosen.push(e);if(chosen.length===20)break}
 } return chosen.sort((a,b)=>a.signalDate.localeCompare(b.signalDate)||a.code.localeCompare(b.code));
}
function dist(a,b){return Math.sqrt(a.reduce((s,x,i)=>s+(x-b[i])**2,0))}
function controlsFor(sample,data,mkt,ex){
 const used=new Set(),pairs=[];
 for(const e of sample){
   const p=data[e.code].p,year=e.signalDate.slice(0,4),mi=mkt.get(e.signalDate);if(!mi)continue;
   const cand=[];
   for(let i=120;i<p.length-21;i++){
     if(p[i].date.slice(0,4)!==year||ex.has(p[i].date)||used.has(e.code+'|'+p[i].date))continue;
     if(Math.abs(new Date(p[i].date)-new Date(e.signalDate))<35*86400000)continue;
     const mf=mkt.get(p[i].date);if(!mf)continue;const o=outcome(p,i);if(o)cand.push({i,date:p[i].date,d:dist(mf,mi),o});
   }
   cand.sort((a,b)=>a.d-b.d);if(!cand.length)continue;
   const c=cand[0];used.add(e.code+'|'+c.date);pairs.push({t:e,c:{code:e.code,signalDate:c.date,...c.o},distance:c.d});
 } return pairs;
}
function stats(sample){
 const o={n:sample.length};
 for(const h of H){
   const r=sample.map(x=>x['r'+h]),mfe=sample.map(x=>x['mfe'+h]),mae=sample.map(x=>x['mae'+h]);
   o[h]={mean:mean(r),median:median(r),positive:r.filter(x=>x>0).length/r.length,q25:q(r,.25),q75:q(r,.75),mfeMedian:median(mfe),maeMedian:median(mae)};
 } return o;
}
function pairStats(pairs){
 const o={n:pairs.length};
 for(const h of H){const d=pairs.map(x=>x.t['r'+h]-x.c['r'+h]);o[h]={upliftMean:mean(d),upliftMedian:median(d),positive:d.filter(x=>x>0).length/d.length}}
 return o;
}
function placeboP(sample,data,ex,B=5000){
 const r=rng(998877),res={};
 for(const h of H){
   const obs=mean(sample.map(x=>x['r'+h])),sim=[];let extreme=0;
   for(let b=0;b<B;b++){
     let s=0,n=0;
     for(const e of sample){
       const p=data[e.code].p,year=e.signalDate.slice(0,4),cand=[];
       for(let i=120;i<p.length-21;i++)if(p[i].date.slice(0,4)===year&&!ex.has(p[i].date)){const o=outcome(p,i);if(o)cand.push(o)}
       if(cand.length){s+=cand[Math.floor(r()*cand.length)]['r'+h];n++}
     }
     const v=n?s/n:0;sim.push(v);if(v>=obs)extreme++;
   }
   res[h]={observedMean:obs,placeboMean:mean(sim),empiricalP:(extreme+1)/(B+1)};
 } return res;
}
(async()=>{
 console.log('METHOD_LOCK',JSON.stringify({
   seed:SEED,
   contaminationControl:'exclude all previously used validation dates +/-20 common trading days; sample signal dates before evaluating outcomes; >=40 trading-day spacing per stock',
   A:'Revenue momentum: YoY revenue >0 and >= own prior-24-month 80th percentile; on/after calendar 11th close > MA20; enter next trading-day open',
   B:'52-week breakout+retest: close > prior252 close high; within next5 days low <= breakout level*1.02 and close >= level*0.99; enter next open',
   C:'Value+trend: positive PER <= own prior252-trading-day 30th percentile and close crosses above MA60; enter next open',
   horizons:H,selection:'fixed-seed max20 events/strategy, same-stock events >=40 trading days apart',controls:'same stock + same year nearest market trend/drawdown/volatility date',placebo:5000
 },null,2));
 const idx=indexRows(await fm('TaiwanStockTotalReturnIndex','TAIEX')),mkt=marketFeatures(idx);
 const data={},sets=[];
 for(const s of stocks){
   const [pr,rev,per]=await Promise.all([fm('TaiwanStockPrice',s.code),fm('TaiwanStockMonthRevenue',s.code),fm('TaiwanStockPER',s.code)]);
   const p=prices(pr);data[s.code]={p,rev,per,name:s.name};sets.push(new Set(p.map(x=>x.date)));
 }
 const common=[...sets[0]].filter(d=>sets.every(s=>s.has(d))).sort(),ex=excludedDates(common);
 const methods={A_REVENUE:[],B_BREAKOUT_RETEST:[],C_VALUE_TREND:[]};
 for(const s of stocks){
   const d=data[s.code];
   for(const x of revenueSignals(d.p,d.rev,ex))methods.A_REVENUE.push({code:s.code,name:s.name,...x});
   for(const x of breakoutRetestSignals(d.p,ex))methods.B_BREAKOUT_RETEST.push({code:s.code,name:s.name,...x});
   for(const x of valueTrendSignals(d.p,d.per,ex))methods.C_VALUE_TREND.push({code:s.code,name:s.name,...x});
 }
 let seed=SEED;
 for(const [name,events] of Object.entries(methods)){
   const sample=sampleEvents(events,common,seed++);
   console.log('LOCKED_SAMPLE',JSON.stringify({method:name,availableEvents:events.length,selected:sample.map(x=>({code:x.code,date:x.signalDate,entryDate:x.entryDate,meta:x.meta}))}));
   const pairs=controlsFor(sample,data,mkt,ex);
   console.log('METHOD_RESULT',JSON.stringify({method:name,stats:stats(sample),matched:pairStats(pairs),placebo:placeboP(sample,data,ex)}));
 }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
