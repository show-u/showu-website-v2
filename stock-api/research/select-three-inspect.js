
const API='https://api.finmindtrade.com/api/v4/data';
const EX=new Set(['2330','2454','2409','2881','1301']);
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
async function fm(dataset,id,start='2022-01-01',end='2026-09-22'){
 const u=new URL(API);u.searchParams.set('dataset',dataset);if(id)u.searchParams.set('data_id',id);u.searchParams.set('start_date',start);u.searchParams.set('end_date',end);
 const r=await fetch(u);console.log('HTTP',dataset,id||'',r.status);if(!r.ok)return[];const j=await r.json();return j.data||[];
}
(async()=>{
 const info=await fm('TaiwanStockInfo','', '2026-01-01','2026-09-22');
 const c=info.filter(x=>/^[0-9]{4}$/.test(x.stock_id)&&!EX.has(x.stock_id)&&x.type==='twse');
 const rr=rng(20260924),s=[...c].sort(()=>rr()-.5).slice(0,3);
 console.log('SELECTED',JSON.stringify(s));
 for(const x of s){
   for(const d of ['TaiwanStockFinancialStatements','TaiwanStockBalanceSheet','TaiwanStockCashFlowsStatement']){
     const rows=await fm(d,x.stock_id,'2025-01-01','2026-09-22');
     console.log('SAMPLE',d,x.stock_id,JSON.stringify(rows.slice(0,8)));
   }
 }
})()