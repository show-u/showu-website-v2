const stocks=[
  {code:'2330',name:'台積電'},
  {code:'2454',name:'聯發科'},
  {code:'2409',name:'友達'},
  {code:'2881',name:'富邦金'},
  {code:'1301',name:'台塑'}
];
const SNAPSHOT='2026-08-21';
const START='2022-01-01', END='2026-09-22';
const API='https://api.finmindtrade.com/api/v4/data';
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const pct=(a,x)=>a.length?a.filter(v=>v<=x).length/a.length:null;

async function fm(dataset,data_id){
  const u=new URL(API);
  u.searchParams.set('dataset',dataset);
  if(data_id) u.searchParams.set('data_id',data_id);
  u.searchParams.set('start_date',START);
  u.searchParams.set('end_date',END);
  const r=await fetch(u);
  if(!r.ok) throw Error(dataset+' '+data_id+' HTTP '+r.status);
  const j=await r.json();
  return j.data||[];
}
function rv(vals,i,k=20){
  if(i<k)return null;
  const rs=[];
  for(let j=i-k+1;j<=i;j++) rs.push(Math.log(vals[j]/vals[j-1]));
  const m=mean(rs);
  return Math.sqrt(mean(rs.map(x=>(x-m)**2)))*Math.sqrt(252);
}
function regimeMap(idxCut){
  const out=new Map(), vals=idxCut.map(x=>Number(x.price));
  for(let i=120;i<idxCut.length;i++){
    const ma120=mean(vals.slice(i-119,i+1));
    const vol=rv(vals,i,20), hist=[];
    for(let j=Math.max(120,i-119);j<=i;j++){
      const z=rv(vals,j,20); if(Number.isFinite(z))hist.push(z);
    }
    out.set(idxCut[i].date,{
      trend:vals[i]>=ma120?'UP':'DOWN',
      vol:vol>=median(hist)?'HIGHVOL':'LOWVOL',
      close:vals[i],ma120,rv20:vol
    });
  }
  return out;
}
function buildSeries(raw,sh){
  const shares=[...sh].sort((a,b)=>a.date.localeCompare(b.date));
  let si=0,lastShares=null;
  const out=[];
  for(const r of [...raw].sort((a,b)=>a.date.localeCompare(b.date))){
    while(si<shares.length && shares[si].date<=r.date){
      const q=Number(shares[si].NumberOfSharesIssued);
      if(Number.isFinite(q)&&q>0) lastShares=q;
      si++;
    }
    const c=Number(r.close),v=Number(r.Trading_Volume);
    if(Number.isFinite(c)&&Number.isFinite(v)&&Number.isFinite(lastShares)&&lastShares>0){
      out.push({date:r.date,c,turnover:v/lastShares});
    }
  }
  return out;
}
function stateAt(cut,rm){
  const i=cut.length-1;
  if(i<252) throw Error('insufficient history');
  const r20=cut[i].c/cut[i-20].c-1;
  const hist=[];
  for(let j=i-251;j<i;j++) if(j>=20) hist.push(cut[j].c/cut[j-20].c-1);
  const mp=pct(hist,r20);
  const mstate=mp>=.8?'MOM_UP':mp<=.2?'MOM_DOWN':'MID';

  const t5=mean(cut.slice(i-4,i+1).map(x=>x.turnover));
  const ratios=[];
  for(let j=Math.max(59,i-119);j<i;j++){
    const a5=mean(cut.slice(j-4,j+1).map(x=>x.turnover));
    const med60=median(cut.slice(j-59,j+1).map(x=>x.turnover));
    if(Number.isFinite(a5)&&Number.isFinite(med60)&&med60>0) ratios.push(a5/med60);
  }
  const med60=median(cut.slice(i-59,i+1).map(x=>x.turnover));
  const ratio=t5/med60, tp=pct(ratios,ratio);
  const tstate=tp>=.8?'TURN_HIGH':tp<=.2?'TURN_LOW':'TURN_MID';

  const m=rm.get(cut[i].date);
  if(!m) throw Error('market regime missing');
  return {
    snapshotDate:cut[i].date,
    price:cut[i].c,
    r20,
    momentumPercentile:mp,
    mstate,
    turnover5:t5,
    turnoverRatio:ratio,
    turnoverPercentile:tp,
    tstate,
    market:m.trend+'_'+m.vol,
    taiex:m.close,
    taiexMA120:m.ma120,
    taiexRV20:m.rv20
  };
}
function futureReturns(full,snapDate){
  const i=full.findIndex(x=>x.date===snapDate);
  if(i<0) throw Error('snapshot missing');
  const base=full[i].c;
  const hs=[1,3,5,10,20],out={};
  for(const h of hs){
    if(full[i+h]) out[h]={date:full[i+h].date,price:full[i+h].c,ret:full[i+h].c/base-1};
  }
  return out;
}

(async()=>{
  console.log('BLIND REPLAY PROTOCOL',JSON.stringify({
    snapshot:SNAPSHOT,
    rule:'all feature construction is restricted to date <= snapshot; future outcomes are read only after snapshot object is created',
    horizons:[1,3,5,10,20],
    parameters:{momentumWindow:20,momentumHistory:252,turnoverAvg:5,turnoverMedian:60,turnoverHistory:120,percentile:[0.2,0.8],marketMA:120,marketRV:20}
  },null,2));

  const idxAll=await fm('TaiwanStockTotalReturnIndex','TAIEX');
  const idxCut=idxAll.filter(x=>x.date<=SNAPSHOT);
  const rm=regimeMap(idxCut);

  for(const s of stocks){
    const [raw,sh]=await Promise.all([
      fm('TaiwanStockPrice',s.code),
      fm('TaiwanStockShareholding',s.code)
    ]);
    const full=buildSeries(raw,sh);
    const cut=full.filter(x=>x.date<=SNAPSHOT);
    if(cut.at(-1)?.date!==SNAPSHOT) throw Error(s.code+' snapshot is not a trading day');
    const snapshot=stateAt(cut,rm); // future inaccessible here by construction
    const future=futureReturns(full,SNAPSHOT); // reveal only after snapshot frozen
    console.log('SNAPSHOT',JSON.stringify({code:s.code,name:s.name,...snapshot}));
    console.log('OUTCOME',JSON.stringify({code:s.code,name:s.name,future}));
  }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
