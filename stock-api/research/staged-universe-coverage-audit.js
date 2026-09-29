
const API='https://api.finmindtrade.com/api/v4/data';
const ASOF='2026-09-24';
const PRICE_START='2026-02-01';
const HISTORY_START='2024-01-01';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;

async function info(){
  const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');
  const r=await fetch(u); if(!r.ok) throw new Error('TaiwanStockInfo '+r.status);
  return (await r.json()).data||[];
}
async function fm(ds,id,start=HISTORY_START,end=ASOF){
  for(let a=0;a<4;a++){
    const u=new URL(API);u.searchParams.set('dataset',ds);u.searchParams.set('data_id',id);
    u.searchParams.set('start_date',start);u.searchParams.set('end_date',end);
    const r=await fetch(u);
    if(r.ok) return (await r.json()).data||[];
    await sleep(250*(a+1));
  }
  return [];
}
async function yahoo(code,type){
  const suf=type==='twse'?'.TW':'.TWO';
  const p1=Math.floor(Date.parse(PRICE_START+'T00:00:00Z')/1000);
  const p2=Math.floor(Date.parse('2026-09-26T00:00:00Z')/1000);
  const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suf+
    '?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';
  for(let a=0;a<3;a++){
    const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
    if(r.ok){
      const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],
        q=x?.indicators?.quote?.[0],adj=x?.indicators?.adjclose?.[0]?.adjclose||q?.close||[];
      return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),close:+adj[i]}))
        .filter(z=>z.close>0);
    }
    await sleep(200*(a+1));
  }
  return [];
}
async function pool(items,limit,fn){
  const out=new Array(items.length);let idx=0;
  async function w(){while(true){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i],i)}catch(e){out[i]={error:String(e)}}}}
  await Promise.all(Array.from({length:limit},w));return out;
}
function revFeat(rows){
  const a=rows.filter(x=>(x.create_time||x.date)<=ASOF&&+x.revenue>0)
    .map(x=>({y:+x.revenue_year,m:+x.revenue_month,v:+x.revenue,ct:x.create_time||x.date}))
    .sort((x,z)=>x.ct.localeCompare(z.ct));
  if(!a.length) return null;
  const cur=a.at(-1), get=(Y,M)=>a.find(x=>x.y===Y&&x.m===M)?.v??null, ys=[];
  for(let k=0;k<4;k++){
    let M=cur.m-k,Y=cur.y; while(M<=0){M+=12;Y--}
    const v=get(Y,M),py=get(Y-1,M); if(!(v>0&&py>0)) return null;
    ys.push(v/py-1);
  }
  return {latestMonth:cur.y+'-'+String(cur.m).padStart(2,'0'),yoy:ys[0],accel:ys[0]-mean(ys.slice(1))};
}
function latestDate(rows){return rows.length?[...rows].sort((a,b)=>(a.date||a.create_time||'').localeCompare(b.date||b.create_time||'')).at(-1).date:null}
(async()=>{
  const raw=await info(), latest=new Map();
  for(const x of raw){
    if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創')) continue;
    const o=latest.get(x.stock_id); if(!o||x.date>o.date) latest.set(x.stock_id,x);
  }
  const universe=[...latest.values()];
  const price=await pool(universe,24,async s=>{
    const p=await yahoo(s.stock_id,s.type);
    if(p.length<126) return {code:s.stock_id,name:s.stock_name,type:s.type,industry:s.industry_category,ok:false,n:p.length};
    const i=p.length-1;
    return {code:s.stock_id,name:s.stock_name,type:s.type,industry:s.industry_category,ok:true,n:p.length,lastDate:p[i].date,mom6:p[i-21].close/p[i-126].close-1};
  });
  const priceOK=price.filter(x=>x?.ok).sort((a,b)=>b.mom6-a.mom6);
  priceOK.forEach((x,i)=>x.rank=i+1);
  const momN=Math.ceil(priceOK.length*.20), mom20=priceOK.slice(0,momN);

  const rev=await pool(mom20,12,async x=>{
    const rows=await fm('TaiwanStockMonthRevenue',x.code,'2024-01-01',ASOF);
    const f=revFeat(rows);
    return {...x,revenueRows:rows.length,revenueLatest:latestDate(rows),revOK:!!f,...(f||{})};
  });
  const revOK=rev.filter(x=>x.revOK).sort((a,b)=>b.accel-a.accel);
  const accelN=Math.ceil(revOK.length/3), accel=revOK.slice(0,accelN);

  const deep=await pool(accel,8,async x=>{
    const [fin,cash,per,inst,margin]=await Promise.all([
      fm('TaiwanStockFinancialStatements',x.code,'2024-01-01',ASOF),
      fm('TaiwanStockCashFlowsStatement',x.code,'2024-01-01',ASOF),
      fm('TaiwanStockPER',x.code,'2024-01-01',ASOF),
      fm('TaiwanStockInstitutionalInvestorsBuySell',x.code,'2024-01-01',ASOF),
      fm('TaiwanStockMarginPurchaseShortSale',x.code,'2024-01-01',ASOF)
    ]);
    return {...x,
      financialRows:fin.length,cashflowRows:cash.length,perRows:per.length,instRows:inst.length,marginRows:margin.length,
      financialOK:fin.length>0,cashflowOK:cash.length>0,perOK:per.length>0,instOK:inst.length>0,marginOK:margin.length>0
    };
  });

  const count=k=>deep.filter(x=>x[k]).length;
  const result={
    asof:ASOF,
    architecture:'staged; no requirement that every dataset exist for all ~1900 stocks',
    stage0:{universe:universe.length,twse:universe.filter(x=>x.type==='twse').length,tpex:universe.filter(x=>x.type==='tpex').length},
    stage1_price:{requested:universe.length,eligible126:priceOK.length,coverage:priceOK.length/universe.length,missing:price.filter(x=>!x?.ok).slice(0,50)},
    stage2_mom6:{top20: mom20.length},
    stage3_revenue:{requested:mom20.length,usable:revOK.length,coverage:revOK.length/mom20.length,topThird:accel.length,missing:rev.filter(x=>!x.revOK).map(x=>({code:x.code,name:x.name,revenueRows:x.revenueRows,revenueLatest:x.revenueLatest}))},
    stage4_deep_data:{requested:deep.length,
      financial:{usable:count('financialOK'),coverage:count('financialOK')/deep.length},
      cashflow:{usable:count('cashflowOK'),coverage:count('cashflowOK')/deep.length},
      per:{usable:count('perOK'),coverage:count('perOK')/deep.length},
      institutional:{usable:count('instOK'),coverage:count('instOK')/deep.length},
      margin:{usable:count('marginOK'),coverage:count('marginOK')/deep.length}},
    auditSample:deep.slice(0,20).map(x=>({code:x.code,name:x.name,momRank:x.rank,revAccel:x.accel,revenueRows:x.revenueRows,financialRows:x.financialRows,cashflowRows:x.cashflowRows,perRows:x.perRows,instRows:x.instRows,marginRows:x.marginRows}))
  };
  console.log('RESULT',JSON.stringify(result));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
