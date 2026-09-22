const stocks=[
  {code:'2330',name:'台積電'},
  {code:'2454',name:'聯發科'},
  {code:'2409',name:'友達'},
  {code:'2881',name:'富邦金'},
  {code:'1301',name:'台塑'}
];
const START='2022-01-01', END='2026-09-22';
const API='https://api.finmindtrade.com/api/v4/data';
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const pct=(a,x)=>a.length?a.filter(v=>v<=x).length/a.length:null;
const wilson=(k,n)=>{if(!n)return [null,null];const z=1.95996398454,p=k/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt((p*(1-p)+z*z/(4*n))/n)/d;return [Math.max(0,c-h),Math.min(1,c+h)]};
async function fm(dataset,data_id){
  const u=new URL(API);u.searchParams.set('dataset',dataset);if(data_id)u.searchParams.set('data_id',data_id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);
  const r=await fetch(u);if(!r.ok)throw Error(dataset+' '+data_id+' HTTP '+r.status);
  const j=await r.json();if(j.status!==200 && !Array.isArray(j.data)) throw Error(dataset+' '+data_id+' '+JSON.stringify(j).slice(0,200));
  return j.data||[];
}
function rv(vals,i,k=20){if(i<k)return null;const rs=[];for(let j=i-k+1;j<=i;j++)rs.push(Math.log(vals[j]/vals[j-1]));const m=mean(rs);return Math.sqrt(mean(rs.map(x=>(x-m)**2)))*Math.sqrt(252)}
function regimeMap(idx){
  const out=new Map();
  const vals=idx.map(x=>Number(x.price));
  for(let i=120;i<idx.length;i++){
    const ma120=mean(vals.slice(i-119,i+1)), vol=rv(vals,i,20), hist=[];
    for(let j=Math.max(120,i-119);j<=i;j++){const z=rv(vals,j,20);if(Number.isFinite(z))hist.push(z)}
    out.set(idx[i].date,{trend:vals[i]>=ma120?'UP':'DOWN',vol:vol>=median(hist)?'HIGHVOL':'LOWVOL'});
  }
  return out;
}
function buildRows(adj,raw,sh,rm){
  const rawMap=new Map(raw.map(x=>[x.date,x]));
  const shares=[...sh].sort((a,b)=>a.date.localeCompare(b.date));
  let si=0,lastShares=null;
  const merged=[];
  for(const a of adj.sort((x,y)=>x.date.localeCompare(y.date))){
    while(si<shares.length && shares[si].date<=a.date){const q=Number(shares[si].NumberOfSharesIssued);if(Number.isFinite(q)&&q>0)lastShares=q;si++}
    const r=rawMap.get(a.date),close=Number(a.close),vol=Number(r?.Trading_Volume);
    if(Number.isFinite(close)&&Number.isFinite(vol)&&Number.isFinite(lastShares)&&lastShares>0){
      merged.push({date:a.date,c:close,turnover:vol/lastShares});
    }
  }
  const histEvents=[];
  function stateAt(i){
    if(i<252)return null;
    const r20=merged[i].c/merged[i-20].c-1;
    const r20hist=[];for(let j=i-251;j<i;j++){if(j>=20)r20hist.push(merged[j].c/merged[j-20].c-1)}
    const mp=pct(r20hist,r20),mstate=mp>=.8?'MOM_UP':mp<=.2?'MOM_DOWN':'MID';
    const t5=mean(merged.slice(i-4,i+1).map(x=>x.turnover));
    const ratios=[];
    for(let j=Math.max(59,i-119);j<i;j++){
      const a5=mean(merged.slice(j-4,j+1).map(x=>x.turnover));
      const med60=median(merged.slice(j-59,j+1).map(x=>x.turnover));
      if(Number.isFinite(a5)&&Number.isFinite(med60)&&med60>0)ratios.push(a5/med60)
    }
    const med60=median(merged.slice(i-59,i+1).map(x=>x.turnover));
    const ratio=t5/med60,tp=pct(ratios,ratio),tstate=tp>=.8?'TURN_HIGH':tp<=.2?'TURN_LOW':'TURN_MID';
    const m=rm.get(merged[i].date);if(!m)return null;
    return {date:merged[i].date,r20,mstate,tstate,market:m.trend+'_'+m.vol,turnover5:t5};
  }
  for(let i=252;i<merged.length-10;i++){
    const st=stateAt(i);if(!st)continue;
    const f10=merged[i+10].c/merged[i].c-1;
    histEvents.push({...st,f10,positive:f10>0});
  }
  return {events:histEvents,current:stateAt(merged.length-1),bars:merged.length};
}
function stat(a){
  const n=a.length,k=a.filter(x=>x.positive).length,ci=wilson(k,n);
  return {n,hit:n?k/n:null,ci95:ci,avg:n?mean(a.map(x=>x.f10)):null,med:n?median(a.map(x=>x.f10)):null};
}
(async()=>{
  console.log('PRE-REGISTERED RULES',JSON.stringify({
    sample:[START,END],
    momentum:'20d adjusted return percentile vs prior 252 observations: top20% MOM_UP, bottom20% MOM_DOWN',
    turnover:'5d avg (Trading_Volume / point-in-time NumberOfSharesIssued), normalized by trailing 60d median; top20%/bottom20% vs prior 120 ratios',
    regime:'TAIEX total-return index above/below MA120 x 20d realized vol above/below prior-120 median',
    outcome:'10-trading-day forward raw-price return > 0',
    noOptimization:true,
    limitation:'raw close is used in this pilot; ex-dividend/corporate-action windows may distort some return observations'
  },null,2));
  const idx=await fm('TaiwanStockTotalReturnIndex','TAIEX');
  const rm=regimeMap(idx);
  const all=[];
  const results=[];
  for(const s of stocks){
    const [raw,sh]=await Promise.all([
      fm('TaiwanStockPrice',s.code),
      fm('TaiwanStockShareholding',s.code)
    ]);
    const b=buildRows(raw,raw,sh,rm);
    const key=b.current?b.current.mstate+'|'+b.current.tstate+'|'+b.current.market:null;
    const own=b.events.filter(x=>(x.mstate+'|'+x.tstate+'|'+x.market)===key);
    for(const e of b.events)all.push({...e,code:s.code,name:s.name});
    results.push({stock:s,bars:b.bars,current:b.current,key,own:stat(own)});
  }
  const base=stat(all);
  console.log('BASELINE',JSON.stringify(base));
  for(const r of results){
    const agg=all.filter(x=>(x.mstate+'|'+x.tstate+'|'+x.market)===r.key);
    const a=stat(agg);
    console.log('RESULT',JSON.stringify({
      code:r.stock.code,name:r.stock.name,bars:r.bars,current:r.current,state:r.key,
      own:r.own,aggregate:a,
      upliftVsBaseline:a.hit==null||base.hit==null?null:a.hit-base.hit,
      evidence:a.n>=100?'pilot-moderate':a.n>=30?'pilot-low':'insufficient'
    }));
  }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
