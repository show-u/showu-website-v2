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
const q=(a,p)=>{const x=[...a].sort((a,b)=>a-b),z=(x.length-1)*p,l=Math.floor(z),h=Math.ceil(z);return l===h?x[l]:x[l]+(x[h]-x[l])*(z-l)};
async function fm(dataset,data_id){
  const u=new URL(API);u.searchParams.set('dataset',dataset);if(data_id)u.searchParams.set('data_id',data_id);
  u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);
  const r=await fetch(u);if(!r.ok)throw Error(dataset+' '+data_id+' HTTP '+r.status);
  const j=await r.json();return j.data||[];
}
function buildStock(raw,sh){
  const shares=[...sh].sort((a,b)=>a.date.localeCompare(b.date));let si=0,last=null,out=[];
  for(const r of [...raw].sort((a,b)=>a.date.localeCompare(b.date))){
    while(si<shares.length&&shares[si].date<=r.date){const z=Number(shares[si].NumberOfSharesIssued);if(Number.isFinite(z)&&z>0)last=z;si++}
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
    for(let j=Math.max(59,i-119);j<i;j++){const a5=mean(stock.slice(j-4,j+1).map(x=>x.turnover)),med60=median(stock.slice(j-59,j+1).map(x=>x.turnover));if(Number.isFinite(a5)&&Number.isFinite(med60)&&med60>0)ths.push(a5/med60)}
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
function choose(n,k){let r=1;for(let i=1;i<=k;i++)r=r*(n-k+i)/i;return r}
function exactMcNemar(b,c){
  const n=b+c;if(n===0)return 1;
  const k=Math.min(b,c);let tail=0;
  for(let i=0;i<=k;i++)tail+=choose(n,i)*Math.pow(.5,n);
  return Math.min(1,2*tail);
}
function rng(seed=20260922){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
function pairedBootstrapDiff(a,b,B=10000){
  const r=rng(),out=[];
  for(let z=0;z<B;z++){let sa=0,sb=0;for(let i=0;i<a.length;i++){const j=Math.floor(r()*a.length);sa+=a[j];sb+=b[j]}out.push(sa/a.length-sb/b.length)}
  return [q(out,.025),q(out,.975)];
}
function exactPermutationP(a,b){
  const d=a.map((x,i)=>x-b[i]); const obs=Math.abs(mean(d));
  const nz=d.filter(x=>x!==0),m=nz.length;
  if(m===0)return 1;
  if(m<=20){
    let extreme=0,total=1<<m;
    for(let mask=0;mask<total;mask++){let s=0,k=0;for(const x of d){if(x===0)continue;s+=((mask>>k)&1)?x:-x;k++}const md=Math.abs(s/d.length);if(md>=obs-1e-12)extreme++}
    return extreme/total;
  }
  const r=rng(987654321);let ex=0,B=100000;
  for(let z=0;z<B;z++){let s=0;for(const x of d)s+=(x===0?0:(r()<.5?x:-x));if(Math.abs(s/d.length)>=obs-1e-12)ex++}
  return (ex+1)/(B+1);
}
(async()=>{
  const idx=buildIndex(await fm('TaiwanStockTotalReturnIndex','TAIEX'));
  const cases=[];
  for(const s of stocks){
    const [raw,sh]=await Promise.all([fm('TaiwanStockPrice',s.code),fm('TaiwanStockShareholding',s.code)]);
    const rows=rowsFor(buildStock(raw,sh),idx);
    for(const snap of SNAPSHOTS){
      const p=prep(rows,snap),m3=selectM3(p);
      for(const h of [5,10,20]){
        const actual=sgn(p.target.f[h]);
        const preds={
          ALWAYS_UP:1,
          TAIEX_TREND_ONLY:sgn(p.target.x[3]),
          RS_ONLY:sgn(p.target.x[2]),
          M3:sgn(median(m3.map(x=>x.f[h])))
        };
        cases.push({code:s.code,snapshot:snap,h,actual,preds});
      }
    }
  }
  for(const h of [5,10,20]){
    const rows=cases.filter(x=>x.h===h),m3=rows.map(x=>x.preds.M3===x.actual?1:0);
    for(const base of ['ALWAYS_UP','TAIEX_TREND_ONLY','RS_ONLY']){
      const b=rows.map(x=>x.preds[base]===x.actual?1:0);
      let m3Only=0,baseOnly=0,both=0,neither=0;
      for(let i=0;i<rows.length;i++){
        if(m3[i]&&b[i])both++;
        else if(m3[i]&&!b[i])m3Only++;
        else if(!m3[i]&&b[i])baseOnly++;
        else neither++;
      }
      const diff=mean(m3)-mean(b),ci=pairedBootstrapDiff(m3,b),mcn=exactMcNemar(m3Only,baseOnly),perm=exactPermutationP(m3,b);
      console.log('PAIRED_RESULT',JSON.stringify({
        horizon:h,baseline:base,n:rows.length,m3Accuracy:mean(m3),baselineAccuracy:mean(b),accuracyDiff:diff,
        discordant:{m3Only,baseOnly,both,neither},mcnemarExactP:mcn,pairedPermutationP:perm,pairedBootstrap95:ci
      }));
    }
  }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
