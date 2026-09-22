const stocks=[
  {code:'2330',name:'台積電'},
  {code:'2454',name:'聯發科'},
  {code:'2409',name:'友達'},
  {code:'2881',name:'富邦金'},
  {code:'1301',name:'台塑'}
];
const SNAPSHOTS=['2024-08-21','2025-08-21','2026-08-21'];
const START='2021-01-01', END='2026-09-22', K=30, EMBARGO=20, DIVERSIFY=10;
const API='https://api.finmindtrade.com/api/v4/data';
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const std=a=>{const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)))||1};
const pct=(a,x)=>a.length?a.filter(v=>v<=x).length/a.length:null;
const ret=(a,i,k,key='c')=>i>=k?a[i][key]/a[i-k][key]-1:null;
async function fm(dataset,data_id){
  const u=new URL(API);u.searchParams.set('dataset',dataset);if(data_id)u.searchParams.set('data_id',data_id);
  u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);
  const r=await fetch(u);if(!r.ok)throw Error(dataset+' '+data_id+' HTTP '+r.status);
  const j=await r.json();return j.data||[];
}
function buildStock(raw,sh){
  const shares=[...sh].sort((a,b)=>a.date.localeCompare(b.date));let si=0,last=null,out=[];
  for(const r of [...raw].sort((a,b)=>a.date.localeCompare(b.date))){
    while(si<shares.length&&shares[si].date<=r.date){
      const q=Number(shares[si].NumberOfSharesIssued);if(Number.isFinite(q)&&q>0)last=q;si++;
    }
    const c=Number(r.close),v=Number(r.Trading_Volume);
    if(Number.isFinite(c)&&Number.isFinite(v)&&Number.isFinite(last)&&last>0)out.push({date:r.date,c,turnover:v/last});
  }
  return out;
}
function buildIndex(idx){
  return idx.map(x=>({date:x.date,c:Number(x.price)})).filter(x=>Number.isFinite(x.c)).sort((a,b)=>a.date.localeCompare(b.date));
}
function rv(a,i,k=20){if(i<k)return null;const rs=[];for(let j=i-k+1;j<=i;j++)rs.push(Math.log(a[j].c/a[j-1].c));const m=mean(rs);return Math.sqrt(mean(rs.map(x=>(x-m)**2)))*Math.sqrt(252)}
function featureRows(stock,index){
  const im=new Map(index.map((x,i)=>[x.date,i])),rows=[];
  for(let i=252;i<stock.length-20;i++){
    const ii=im.get(stock[i].date); if(ii==null||ii<252||ii>=index.length-20)continue;
    const m20=ret(stock,i,20);
    const mh=[];for(let j=i-251;j<i;j++){const x=ret(stock,j,20);if(Number.isFinite(x))mh.push(x)}
    const momPct=pct(mh,m20);
    const t5=mean(stock.slice(i-4,i+1).map(x=>x.turnover));
    const trHist=[];
    for(let j=Math.max(59,i-119);j<i;j++){
      const a5=mean(stock.slice(j-4,j+1).map(x=>x.turnover));
      const med60=median(stock.slice(j-59,j+1).map(x=>x.turnover));
      if(Number.isFinite(a5)&&Number.isFinite(med60)&&med60>0)trHist.push(a5/med60);
    }
    const med60=median(stock.slice(i-59,i+1).map(x=>x.turnover));
    const tratio=t5/med60,turnPct=pct(trHist,tratio);

    const idx20=ret(index,ii,20), relStrength=m20-idx20;
    const ma120=mean(index.slice(ii-119,ii+1).map(x=>x.c));
    const trendStrength=index[ii].c/ma120-1;
    const max120=Math.max(...index.slice(ii-119,ii+1).map(x=>x.c));
    const drawdown=index[ii].c/max120-1;
    const vol=rv(index,ii,20),vh=[];
    for(let j=Math.max(20,ii-119);j<ii;j++){const z=rv(index,j,20);if(Number.isFinite(z))vh.push(z)}
    const volPct=pct(vh,vol);

    const f1=stock[i+1].c/stock[i].c-1,f3=stock[i+3].c/stock[i].c-1,f5=stock[i+5].c/stock[i].c-1,
          f10=stock[i+10].c/stock[i].c-1,f20=stock[i+20].c/stock[i].c-1;
    rows.push({date:stock[i].date,price:stock[i].c,
      x:[momPct,turnPct,relStrength,trendStrength,drawdown,volPct],
      names:['momPct','turnPct','relStrength','trendStrength','drawdown','volPct'],
      f:{1:f1,3:f3,5:f5,10:f10,20:f20}
    });
  }
  return rows;
}
function selectAnalogues(rows,snap){
  const target=rows.find(r=>r.date===snap);if(!target)throw Error('snapshot feature missing '+snap);
  const ti=rows.findIndex(r=>r.date===snap);
  const candidates=rows.slice(0,Math.max(0,ti-EMBARGO));
  if(candidates.length<K)throw Error('not enough candidates '+snap);
  const mus=target.x.map((_,j)=>mean(candidates.map(r=>r.x[j])));
  const sds=target.x.map((_,j)=>std(candidates.map(r=>r.x[j])));
  const dist=r=>Math.sqrt(r.x.reduce((sum,v,j)=>sum+((v-target.x[j])/sds[j])**2,0));
  const ranked=candidates.map((r,i)=>({...r,_i:i,d:dist(r)})).sort((a,b)=>a.d-b.d);
  const chosen=[];
  for(const r of ranked){
    if(chosen.every(c=>Math.abs(r._i-c._i)>=DIVERSIFY)){chosen.push(r);if(chosen.length===K)break}
  }
  return {target,chosen,mus,sds};
}
function stats(vals){return {n:vals.length,positive:vals.filter(x=>x>0).length,hit:vals.filter(x=>x>0).length/vals.length,avg:mean(vals),median:median(vals),q25:quantile(vals,.25),q75:quantile(vals,.75)}}
function quantile(a,q){const x=[...a].sort((a,b)=>a-b),p=(x.length-1)*q,l=Math.floor(p),h=Math.ceil(p);return l===h?x[l]:x[l]+(x[h]-x[l])*(p-l)}
(async()=>{
  console.log('ANALOGUE MODEL LOCK',JSON.stringify({
    snapshots:SNAPSHOTS,stocks:stocks.map(x=>x.code),K,embargoTradingRows:EMBARGO,diversifyTradingRows:DIVERSIFY,
    features:['20d momentum percentile','turnover percentile','20d relative strength vs TAIEX','TAIEX distance to MA120','TAIEX 120d drawdown','TAIEX 20d volatility percentile'],
    weights:'equal after z-standardization on candidate history only',
    breadth:'excluded from this pilot because a reliable point-in-time historical breadth series is not yet in the data pipeline',
    antiLookahead:'candidate features and scaling use dates before snapshot; candidate forward 20d outcome must finish before snapshot'
  },null,2));
  const idx=buildIndex(await fm('TaiwanStockTotalReturnIndex','TAIEX'));
  let aggregate={};
  for(const s of stocks){
    const [raw,sh]=await Promise.all([fm('TaiwanStockPrice',s.code),fm('TaiwanStockShareholding',s.code)]);
    const series=buildStock(raw,sh),rows=featureRows(series,idx);
    for(const snap of SNAPSHOTS){
      const {target,chosen}=selectAnalogues(rows,snap);
      const result={code:s.code,name:s.name,snapshot:snap,price:target.price,
        feature:Object.fromEntries(target.names.map((n,i)=>[n,target.x[i]])),
        analogueDates:chosen.map(x=>({date:x.date,distance:x.d})),
        outcomes:{}};
      for(const h of [1,3,5,10,20]){
        const vals=chosen.map(x=>x.f[h]);
        result.outcomes[h]=stats(vals);
        (aggregate[snap+'|'+h]??=[]).push(...vals);
      }
      console.log('ANALOGUE',JSON.stringify(result));
    }
  }
  for(const snap of SNAPSHOTS)for(const h of [1,3,5,10,20]){
    console.log('AGG',JSON.stringify({snapshot:snap,horizon:h,...stats(aggregate[snap+'|'+h])}));
  }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
