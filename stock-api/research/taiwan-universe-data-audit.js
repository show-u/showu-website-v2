
const API='https://api.finmindtrade.com/api/v4/data';
const START='2019-01-02', END='2026-09-24';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function getJSON(url, opts={}) {
  const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0',...(opts.headers||{})},...opts});
  if(!r.ok) throw new Error(url+' '+r.status);
  return await r.json();
}
async function finmind(ds,id,start=START,end=END){
  for(let a=0;a<4;a++){
    const u=new URL(API);u.searchParams.set('dataset',ds);
    if(id)u.searchParams.set('data_id',id);
    u.searchParams.set('start_date',start);u.searchParams.set('end_date',end);
    const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
    if(r.ok){const j=await r.json();return j.data||[]}
    await sleep(300*(a+1));
  }
  return [];
}
async function stockInfo(){
  const u=new URL(API);u.searchParams.set('dataset','TaiwanStockInfo');
  const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
  if(!r.ok) throw new Error('TaiwanStockInfo '+r.status);
  return (await r.json()).data||[];
}
async function yahoo(code,type){
  const suf=type==='twse'?'.TW':'.TWO';
  const p1=Math.floor(Date.parse(START+'T00:00:00Z')/1000);
  const p2=Math.floor(Date.parse('2026-09-26T00:00:00Z')/1000);
  const u='https://query1.finance.yahoo.com/v8/finance/chart/'+code+suf+'?period1='+p1+'&period2='+p2+'&interval=1d&events=div%2Csplits&includeAdjustedClose=true';
  for(let a=0;a<3;a++){
    const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});
    if(r.ok){
      const j=await r.json(),x=j?.chart?.result?.[0],ts=x?.timestamp||[],q=x?.indicators?.quote?.[0];
      if(!x||!q)return [];
      return ts.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),close:+q.close?.[i]})).filter(z=>z.close>0);
    }
    await sleep(200*(a+1));
  }
  return [];
}
async function pool(items,limit,fn){
  const out=new Array(items.length);let idx=0;
  async function worker(){
    while(true){
      const i=idx++; if(i>=items.length)return;
      try{out[i]=await fn(items[i])}catch(e){out[i]={error:String(e)}}
    }
  }
  await Promise.all(Array.from({length:limit},worker));
  return out;
}
function latestByCode(raw){
  const latest=new Map();
  for(const x of raw){
    if(!['twse','tpex'].includes(x.type))continue;
    if(!/^[0-9]{4}$/.test(x.stock_id))continue;
    if(x.industry_category==='ETF')continue;
    if((x.stock_name||'').includes('創'))continue;
    const o=latest.get(x.stock_id);
    if(!o||x.date>o.date)latest.set(x.stock_id,x);
  }
  return latest;
}
async function twseDelisted(){
  try{
    const j=await getJSON('https://www.twse.com.tw/rwd/zh/company/suspendListing?response=json');
    const fields=j.fields||[];
    const codeIdx=fields.findIndex(x=>/公司代號|證券代號/.test(x));
    const dateIdx=fields.findIndex(x=>/終止上市日期|停止買賣日期/.test(x));
    const rows=j.data||[];
    return rows.map(r=>({code:String(r[codeIdx]||'').trim(),date:String(r[dateIdx]||''),market:'twse'}))
      .filter(x=>/^[0-9]{4}$/.test(x.code));
  }catch{return []}
}
async function tpexDelisted(){
  const all=[];
  for(let y=2019;y<=2026;y++){
    try{
      const j=await getJSON('https://www.tpex.org.tw/www/zh-tw/company/deListed?code=&date='+y+'&reason=-1');
      const rows=j.tables?.[0]?.data||j.data||[];
      for(const r of rows){
        const vals=Array.isArray(r)?r:Object.values(r);
        const code=vals.map(String).find(v=>/^[0-9]{4}$/.test(v.trim()));
        const date=vals.map(String).find(v=>/\d{3,4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(v))||'';
        if(code)all.push({code:code.trim(),date,market:'tpex'});
      }
    }catch{}
  }
  const m=new Map();for(const x of all)m.set(x.market+':'+x.code,x);return [...m.values()];
}
function yrCoverage(p){
  const ys={};for(let y=2019;y<=2026;y++)ys[y]=0;
  for(const x of p){const y=+x.date.slice(0,4);if(ys[y]!=null)ys[y]++}
  return ys;
}
(async()=>{
  const raw=await stockInfo();
  const current=latestByCode(raw);
  const currentArr=[...current.values()].map(x=>({code:x.stock_id,name:x.stock_name,type:x.type,industry:x.industry_category,date:x.date}));
  const [twseD,tpexD]=await Promise.all([twseDelisted(),tpexDelisted()]);
  const delistedMap=new Map();
  for(const x of [...twseD,...tpexD])if(!current.has(x.code))delistedMap.set(x.market+':'+x.code,x);
  const delisted=[...delistedMap.values()];

  const priceRes=await pool(currentArr,20,async s=>{
    const p=await yahoo(s.code,s.type);
    return {code:s.code,type:s.type,n:p.length,start:p[0]?.date||null,end:p.at(-1)?.date||null,years:yrCoverage(p)};
  });
  const usable=priceRes.filter(x=>x&&x.n>=126);
  const fullSpan=priceRes.filter(x=>x&&x.start&&x.start<='2019-02-01'&&x.end>='2026-09-23');
  const endCurrent=priceRes.filter(x=>x&&x.end>='2026-09-23');
  const startsAfter2019=priceRes.filter(x=>x&&x.start>'2019-02-01');

  const yearSummary={};
  for(let y=2019;y<=2026;y++){
    const counts=priceRes.filter(x=>x&&x.years&&x.years[y]>0).length;
    yearSummary[y]={stocksWithAnyPrice:counts};
  }

  // point-in-time auxiliary coverage audit on deterministic cross-market sample
  const sample=currentArr.filter((_,i)=>i%Math.max(1,Math.floor(currentArr.length/60))===0).slice(0,60);
  const aux=await pool(sample,6,async s=>{
    const [rev,fin,cf,per,inst]=await Promise.all([
      finmind('TaiwanStockMonthRevenue',s.code),
      finmind('TaiwanStockFinancialStatements',s.code),
      finmind('TaiwanStockCashFlowsStatement',s.code),
      finmind('TaiwanStockPER',s.code),
      finmind('TaiwanStockInstitutionalInvestorsBuySell',s.code)
    ]);
    return {code:s.code,type:s.type,rev:rev.length,fin:fin.length,cf:cf.length,per:per.length,inst:inst.length,
      revLatest:rev.at(-1)?.create_time||rev.at(-1)?.date||null,
      finLatest:fin.at(-1)?.date||null,
      perLatest:per.at(-1)?.date||null,
      instLatest:inst.at(-1)?.date||null};
  });

  const auxSummary={
    sampleN:aux.length,
    revenueNonEmpty:aux.filter(x=>x.rev>0).length,
    financialNonEmpty:aux.filter(x=>x.fin>0).length,
    cashflowNonEmpty:aux.filter(x=>x.cf>0).length,
    perNonEmpty:aux.filter(x=>x.per>0).length,
    institutionalNonEmpty:aux.filter(x=>x.inst>0).length
  };

  console.log('RESULT',JSON.stringify({
    asof:END,
    currentUniverse:currentArr.length,
    currentByMarket:{
      twse:currentArr.filter(x=>x.type==='twse').length,
      tpex:currentArr.filter(x=>x.type==='tpex').length
    },
    officialDelistedFound:{twse:twseD.length,tpex:tpexD.length,notCurrent:delisted.length},
    priceAudit:{
      tested:priceRes.length,
      usable126:usable.length,
      endsNearAsOf:endCurrent.length,
      full2019to2026:fullSpan.length,
      startsAfter2019:startsAfter2019.length,
      failedOrEmpty:priceRes.filter(x=>!x||!x.n).length,
      yearSummary,
      earliestStarts:priceRes.filter(x=>x&&x.start).sort((a,b)=>a.start.localeCompare(b.start)).slice(0,5),
      latestStarts:priceRes.filter(x=>x&&x.start).sort((a,b)=>b.start.localeCompare(a.start)).slice(0,10)
    },
    auxCoverage:auxSummary,
    auxSample:aux
  }));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
