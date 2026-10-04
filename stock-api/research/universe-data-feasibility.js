
const API='https://api.finmindtrade.com/api/v4/data';
const START='2019-01-01', END='2026-09-24';
const datasets=[
  'TaiwanStockPrice',
  'TaiwanStockMonthRevenue',
  'TaiwanStockFinancialStatements',
  'TaiwanStockCashFlowsStatement',
  'TaiwanStockPER',
  'TaiwanStockInstitutionalInvestorsBuySell'
];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function req(dataset,id,start=START,end=END){
  for(let a=0;a<3;a++){
    const u=new URL(API);u.searchParams.set('dataset',dataset);
    if(id)u.searchParams.set('data_id',id);
    u.searchParams.set('start_date',start);u.searchParams.set('end_date',end);
    const r=await fetch(u);
    if(r.ok){const j=await r.json();return j.data||[];}
    await sleep(300*(a+1));
  }
  return [];
}
async function pool(items,limit,fn){
  const out=new Array(items.length);let i=0;
  async function w(){while(true){const k=i++;if(k>=items.length)return;try{out[k]=await fn(items[k])}catch{out[k]=null}}}
  await Promise.all(Array.from({length:limit},w));return out;
}
(async()=>{
  const ui=new URL(API);ui.searchParams.set('dataset','TaiwanStockInfo');
  const ir=await fetch(ui); const ij=await ir.json(); const info=ij.data||[];
  const latest=new Map();
  for(const x of info){
    if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||x.industry_category==='ETF'||x.stock_name.includes('創')) continue;
    const o=latest.get(x.stock_id); if(!o||x.date>o.date) latest.set(x.stock_id,x);
  }
  const universe=[...latest.values()];
  console.log('UNIVERSE',JSON.stringify({count:universe.length,twse:universe.filter(x=>x.type==='twse').length,tpex:universe.filter(x=>x.type==='tpex').length}));

  // deterministic 30-stock spread across code-sorted universe, not a single-stock example
  const sorted=[...universe].sort((a,b)=>a.stock_id.localeCompare(b.stock_id));
  const sample=[]; for(let j=0;j<30;j++) sample.push(sorted[Math.floor(j*(sorted.length-1)/29)]);
  const results=await pool(sample,6,async s=>{
    const counts={};
    for(const ds of datasets){
      const rows=await req(ds,s.stock_id);
      counts[ds]=rows.length;
    }
    return {code:s.stock_id,name:s.stock_name,type:s.type,counts};
  });
  const valid=results.filter(Boolean);
  const coverage={};
  for(const ds of datasets){
    const nonzero=valid.filter(x=>x.counts[ds]>0).length;
    const counts=valid.map(x=>x.counts[ds]).filter(n=>n>0).sort((a,b)=>a-b);
    coverage[ds]={nonzero,total:valid.length,min:counts[0]??0,median:counts.length?counts[Math.floor(counts.length/2)]:0,max:counts.at(-1)??0};
  }
  console.log('SAMPLE',JSON.stringify(valid));
  console.log('COVERAGE',JSON.stringify(coverage));

  // Verify whether all-market direct query works without data_id.
  const direct={};
  for(const ds of datasets){
    const rows=await req(ds,null,'2026-08-01','2026-09-24');
    direct[ds]={rows:rows.length,uniqueStocks:new Set(rows.map(x=>x.stock_id)).size};
  }
  console.log('DIRECT',JSON.stringify(direct));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
