
const API='https://api.finmindtrade.com/api/v4/data';
const END='2026-09-24', START='2019-01-02';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function info(){
  const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');
  const r=await fetch(u); if(!r.ok) throw Error('info '+r.status);
  return (await r.json()).data||[];
}
async function yahoo(code,type){
  const suf=type==='twse'?'.TW':'.TWO';
  const p1=Math.floor(Date.parse(START+'T00:00:00Z')/1000),p2=Math.floor(Date.parse('2026-09-25T00:00:00Z')/1000);
  const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suf+'?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';
  for(let a=0;a<3;a++){
    const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
    if(r.ok){const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],q=x?.indicators?.quote?.[0],adj=x?.indicators?.adjclose?.[0]?.adjclose||q?.close||[];
      return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),close:+adj[i]})).filter(x=>x.close>0);
    }
    await sleep(200*(a+1));
  }
  return [];
}
async function fm(ds,id,start='2024-01-01',end=END){
  for(let a=0;a<3;a++){
    const u=new URL(API);u.searchParams.set('dataset',ds);u.searchParams.set('data_id',id);u.searchParams.set('start_date',start);u.searchParams.set('end_date',end);
    const r=await fetch(u); if(r.ok) return (await r.json()).data||[];
    await sleep(200*(a+1));
  }
  return [];
}
async function pool(items,limit,fn){
  const out=new Array(items.length);let idx=0;
  async function w(){while(true){const i=idx++;if(i>=items.length)return;try{out[i]=await fn(items[i])}catch{out[i]=null}}}
  await Promise.all(Array.from({length:limit},w));return out;
}
(async()=>{
  const raw=await info(),latest=new Map();
  for(const x of raw){
    if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創')) continue;
    const o=latest.get(x.stock_id); if(!o||x.date>o.date) latest.set(x.stock_id,x);
  }
  const universe=[...latest.values()];
  const price=await pool(universe,24,async s=>{
    const p=await yahoo(s.stock_id,s.type);
    return {code:s.stock_id,n:p.length,first:p[0]?.date||null,last:p.at(-1)?.date||null,ok126:p.length>=126,ok504:p.length>=504};
  });
  const priceMap=new Map(price.filter(Boolean).map(x=>[x.code,x]));
  const priceEligible=universe.filter(s=>priceMap.get(s.stock_id)?.ok126);
  const sample=priceEligible.slice(0,Math.min(300,priceEligible.length));
  const rev=await pool(sample,12,async s=>{
    const r=await fm('TaiwanStockMonthRevenue',s.stock_id,'2024-01-01',END);
    return {code:s.stock_id,n:r.length,last:r.at(-1)?.create_time||r.at(-1)?.date||null,ok:r.length>=12};
  });
  const revOk=rev.filter(x=>x?.ok).length;
  console.log('RESULT',JSON.stringify({
    asof:END,
    universe:universe.length,
    price:{tested:universe.length,ok126:price.filter(x=>x?.ok126).length,ok504:price.filter(x=>x?.ok504).length},
    revenuePilot:{tested:sample.length,ok12:revOk,coverage:sample.length?revOk/sample.length:null},
    implication:'Stage 1 can be computed market-wide from price history; revenue/fundamental data should be fetched only after Stage 1 shortlist, not for all 1900 names.'
  }));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
