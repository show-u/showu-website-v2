const stocks=[
  {code:'2330',name:'台積電'},
  {code:'2454',name:'聯發科'},
  {code:'2409',name:'友達'},
  {code:'2881',name:'富邦金'},
  {code:'1301',name:'台塑'}
];
const SNAPSHOTS=['2024-08-21','2025-08-21','2026-08-21'];
const START='2021-01-01',END='2026-09-22',K=30,EMBARGO=20,DIVERSIFY=10;
const API='https://api.finmindtrade.com/api/v4/data';
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
const std=a=>{const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)))||1};
const pct=(a,x)=>a.length?a.filter(v=>v<=x).length/a.length:null;
async function fm(dataset,data_id){
  const u=new URL(API);u.searchParams.set('dataset',dataset);if(data_id)u.searchParams.set('data_id',data_id);
  u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);
  const r=await fetch(u);if(!r.ok)throw Error(dataset+' '+data_id+' HTTP '+r.status);
  const j=await r.json();return j.data||[];
}
function buildStock(raw,sh){
  const shares=[...sh].sort((a,b)=>a.date.localeCompare(b.date));let si=0,last=null,out=[];
  for(const r of [...raw].sort((a,b)=>a.date.localeCompare(b.date))){
    while(si<shares.length&&shares[si].date<=r.date){const q=Number(shares[si].NumberOfSharesIssued);if(Number.isFinite(q)&&q>0)last=q;si++}
    const c=Number(r.close),v=Number(r.Trading_Volume);
    if(Number.isFinite(c)&&Number.isFinite(v)&&Number.isFinite(last)&&last>0)out.push({date:r.date,c,turnover:v/last});
  } return out;
}
function buildIndex(idx){return idx.map(x=>({date:x.date,c:Number(x.price)})).filter(x=>Number.isFinite(x.c)).sort((a,b)=>a.date.localeCompare(b.date))}
const ret=(a,i,k)=>i>=k?a[i].c/a[i-k].c-1:null;
function rv(a,i,k=20){if(i<k)return null;const rs=[];for(let j=i-k+1;j<=i;j++)rs.push(Math.log(a[j].c/a[j-1].c));const m=mean(rs);return Math.sqrt(mean(rs.map(x=>(x-m)**2)))*Math.sqrt(252)}
function rowsFor(stock,index){
  const im=new Map(index.map((x,i)=>[x.date,i])),rows=[];
  for(let i=252;i<stock.length-20;i++){
    const ii=im.get(stock[i].date);if(ii==null||ii<252||ii>=index.length-20)continue;
    const m20=ret(stock,i,20),mh=[];for(let j=i-251;j<i;j++){const x=ret(stock,j,20);if(Number.isFinite(x))mh.push(x)}
    const momPct=pct(mh,m20);
    const t5=mean(stock.slice(i-4,i+1).map(x=>x.turnover)),ths=[];
    for(let j=Math.max(59,i-119);j<i;j++){
      const a5=mean(stock.slice(j-4,j+1).map(x=>x.turnover)),med60=median(stock.slice(j-59,j+1).map(x=>x.turnover));
      if(Number.isFinite(a5)&&Number.isFinite(med60)&&med60>0)ths.push(a5/med60)
    }
    const med60=median(stock.slice(i-59,i+1).map(x=>x.turnover)),turnPct=pct(ths,t5/med60);
    const idx20=ret(index,ii,20),relStrength=m20-idx20,ma120=mean(index.slice(ii-119,ii+1).map(x=>x.c));
    const trendStrength=index[ii].c/ma120-1,max120=Math.max(...index.slice(ii-119,ii+1).map(x=>x.c)),drawdown=index[ii].c/max120-1;
    const vol=rv(index,ii,20),vh=[];for(let j=Math.max(20,ii-119);j<ii;j++){const z=rv(index,j,20);if(Number.isFinite(z))vh.push(z)}
    const volPct=pct(vh,vol);
    rows.push({date:stock[i].date,x:[momPct,turnPct,relStrength,trendStrength,drawdown,volPct],
      f:{5:stock[i+5].c/stock[i].c-1,10:stock[i+10].c/stock[i].c-1,20:stock[i+20].c/stock[i].c-1}});
  } return rows;
}
function prep(rows,snap){
  const ti=rows.findIndex(r=>r.date===snap);if(ti<0)throw Error('snapshot missing '+snap);
  const target=rows[ti],cands=rows.slice(0,Math.max(0,ti-EMBARGO)),sds=[0,1,2,3,4,5].map(j=>std(cands.map(r=>r.x[j])));
  return {target,cands,sds};
}
function selectM3(p){
  const idx=[2,3,4];
  const dist=r=>Math.sqrt(idx.reduce((s,j)=>s+((r.x[j]-p.target.x[j])/p.sds[j])**2,0));
  const ranked=p.cands.map((r,i)=>({...r,_i:i,d:dist(r)})).sort((a,b)=>a.d-b.d),chosen=[];
  for(const r of ranked){if(chosen.every(c=>Math.abs(r._i-c._i)>=DIVERSIFY)){chosen.push(r);if(chosen.length===K)break}}
  return chosen;
}
const sgn=x=>x>0?1:x<0?-1:0;
(async()=>{
  console.log('BASELINE CHALLENGE LOCK',JSON.stringify({
    snapshots:SNAPSHOTS,stocks:stocks.map(x=>x.code),horizons:[5,10,20],
    models:['ALWAYS_UP','TAIEX_TREND_ONLY','RS_ONLY','M3'],
    M3features:['relStrength','trendStrength','drawdown'],noTuning:true,antiLookahead:true
  },null,2));
  const idx=buildIndex(await fm('TaiwanStockTotalReturnIndex','TAIEX'));
  const results={ALWAYS_UP:[],TAIEX_TREND_ONLY:[],RS_ONLY:[],M3:[]};
  for(const s of stocks){
    const [raw,sh]=await Promise.all([fm('TaiwanStockPrice',s.code),fm('TaiwanStockShareholding',s.code)]);
    const rows=rowsFor(buildStock(raw,sh),idx);
    for(const snap of SNAPSHOTS){
      const p=prep(rows,snap),m3=selectM3(p);
      const preds={
        ALWAYS_UP:{5:1,10:1,20:1},
        TAIEX_TREND_ONLY:{5:sgn(p.target.x[3]),10:sgn(p.target.x[3]),20:sgn(p.target.x[3])},
        RS_ONLY:{5:sgn(p.target.x[2]),10:sgn(p.target.x[2]),20:sgn(p.target.x[2])},
        M3:{
          5:sgn(median(m3.map(x=>x.f[5]))),
          10:sgn(median(m3.map(x=>x.f[10]))),
          20:sgn(median(m3.map(x=>x.f[20])))
        }
      };
      for(const name of Object.keys(preds)){
        const row={code:s.code,snapshot:snap};
        for(const h of [5,10,20])row[h]={pred:preds[name][h],actual:sgn(p.target.f[h]),ret:p.target.f[h],correct:preds[name][h]===sgn(p.target.f[h])?1:0};
        results[name].push(row);
      }
    }
  }
  for(const [name,rows] of Object.entries(results)){
    const out={model:name,horizons:{}};
    for(const h of [5,10,20]){
      const c=rows.map(r=>r[h].correct), actualPos=rows.filter(r=>r[h].actual>0).length/rows.length;
      out.horizons[h]={
        n:rows.length,
        correct:c.reduce((a,b)=>a+b,0),
        accuracy:c.reduce((a,b)=>a+b,0)/c.length,
        actualPositiveRate:actualPos,
        byYear:Object.fromEntries(SNAPSHOTS.map(snap=>{
          const y=rows.filter(r=>r.snapshot===snap),yc=y.map(r=>r[h].correct);
          return [snap,{n:y.length,correct:yc.reduce((a,b)=>a+b,0),accuracy:yc.reduce((a,b)=>a+b,0)/yc.length}]
        }))
      }
    }
    console.log('BASELINE_RESULT',JSON.stringify(out));
  }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
