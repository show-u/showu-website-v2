
const API='https://api.finmindtrade.com/api/v4/data';
const START='2019-01-01', END='2026-09-24', SEED=20260929;
const TARGET_SECTORS=['食品工業','化學工業','半導體業','電腦及週邊設備業','航運業','金融保險業','建材營造','生技醫療業'];
function rng(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}}
async function info(){const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');const r=await fetch(u);if(!r.ok)throw new Error('stock info '+r.status);return (await r.json()).data||[]}
async function fm(ds,id){
 const u=new URL(API);u.searchParams.set('dataset',ds);u.searchParams.set('data_id',id);u.searchParams.set('start_date',START);u.searchParams.set('end_date',END);
 const r=await fetch(u);let j={};try{j=await r.json()}catch{};
 if(!r.ok)return {ok:false,status:r.status,msg:j.msg||'',data:[]};
 return {ok:true,status:r.status,msg:j.msg||'',data:j.data||[]};
}
function range(a,dateKey='date'){
 const vals=a.map(x=>x[dateKey]).filter(Boolean).sort();
 return vals.length?{first:vals[0],last:vals.at(-1)}:{first:null,last:null};
}
(async()=>{
 const raw=await info(), latest=new Map();
 for(const x of raw){
   if(!['twse','tpex'].includes(x.type)||!/^[0-9]{4}$/.test(x.stock_id)||x.stock_name.includes('創')) continue;
   const old=latest.get(x.stock_id); if(!old||x.date>old.date) latest.set(x.stock_id,x);
 }
 const all=[...latest.values()], r=rng(SEED), picks=[];
 for(const sec of TARGET_SECTORS){
   const c=all.filter(x=>x.industry_category===sec).sort((a,b)=>a.stock_id.localeCompare(b.stock_id));
   if(!c.length){picks.push({sector:sec,error:'no candidates'});continue}
   const pick=c[Math.floor(r()*c.length)];
   picks.push({sector:sec,code:pick.stock_id,name:pick.stock_name,type:pick.type});
 }
 const out=[];
 for(const p of picks){
   if(p.error){out.push(p);continue}
   const datasets=[
     ['price','TaiwanStockPrice'],
     ['revenue','TaiwanStockMonthRevenue'],
     ['financials','TaiwanStockFinancialStatements'],
     ['cashflow','TaiwanStockCashFlowsStatement'],
     ['perpbr','TaiwanStockPER'],
     ['institutional','TaiwanStockInstitutionalInvestorsBuySell']
   ];
   const res={...p};
   for(const [key,ds] of datasets){
     const z=await fm(ds,p.code), rg=range(z.data, key==='revenue'?'create_time':'date');
     res[key]={ok:z.ok,count:z.data.length,first:rg.first,last:rg.last,status:z.status,msg:z.msg};
   }
   out.push(res);
 }
 console.log('RESULT '+JSON.stringify({start:START,end:END,seed:SEED,picks:out}));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
