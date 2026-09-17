// Licensed normalized market-facts adapter.
// Source rows are produced only from explicitly OGDL-licensed official datasets; no missing-value fallback.
(function(){
  const URL='./market-facts.json';let factsPromise=null;
  const req=(o,k)=>Object.prototype.hasOwnProperty.call(o,k)&&o[k]!==null&&o[k]!==undefined&&String(o[k]).trim()!=='';
  function validRow(r){
    if(!r||r.provenance!=='observed'||r.licence!=='OGDL-1.0')return false;
    if(!['TWSE','TPEx'].includes(r.market)||!/^[0-9]{4,6}$/.test(String(r.ticker||''))||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(r.date||'')))return false;
    for(const k of ['open','high','low','close'])if(!Number.isFinite(Number(r[k]))||Number(r[k])<=0)return false;
    if(Number(r.high)<Math.max(Number(r.open),Number(r.low),Number(r.close)))return false;
    if(Number(r.low)>Math.min(Number(r.open),Number(r.high),Number(r.close)))return false;
    return !!String(r.name||'').trim()&&!!String(r.source_id||'').trim()&&!!String(r.raw_sha256||'').match(/^[a-f0-9]{64}$/i);
  }
  async function loadMarketFacts(){
    if(factsPromise)return factsPromise;
    factsPromise=fetch(URL,{cache:'no-store'}).then(async r=>{
      if(!r.ok)throw Error('合法市場事實檔暫時無法讀取');
      const x=await r.json();
      if(x.schema_version!==1||x.source!=='ogdl-normalized-market-facts'||x.licence!=='OGDL-1.0'||x.no_imputation!==true)throw Error('市場事實檔授權／版本驗證未通過');
      if(!Array.isArray(x.rows)||!x.rows.length)throw Error('市場事實檔沒有可用資料');
      for(const z of x.rows)if(!validRow(z))throw Error('市場事實檔存在未通過 schema／來源驗證的列');
      return x;
    }).catch(e=>{factsPromise=null;throw e});
    return factsPromise;
  }
  async function universe(){const x=await loadMarketFacts();return x.rows.map(r=>({code:String(r.ticker),name:String(r.name),market:r.market,date:r.date}));}
  async function latest(code,market=null){
    const x=await loadMarketFacts(),c=String(code||'').trim();
    const a=x.rows.filter(r=>String(r.ticker)===c&&(!market||r.market===market));
    if(!a.length)throw Error('合法 OGDL 市場事實中找不到此股票代號');
    a.sort((p,q)=>String(q.date).localeCompare(String(p.date)));
    return a[0];
  }
  function twseRaw(r){return{Date:r.date.replaceAll('-',''),Code:r.ticker,Name:r.name,TradeVolume:r.volume,TradeValue:r.trade_value,OpeningPrice:r.open,HighestPrice:r.high,LowestPrice:r.low,ClosingPrice:r.close};}
  function tpexRaw(r){return{Date:r.date.replaceAll('-',''),SecuritiesCompanyCode:r.ticker,CompanyName:r.name,TradingShares:r.volume,TransactionAmount:r.trade_value,Open:r.open,High:r.high,Low:r.low,Close:r.close};}
  // Compatibility is intentionally limited to daily snapshots. Missing datasets remain unavailable.
  if(typeof jget==='function'){
    jget=async function(url){if(typeof U!=='undefined'&&url===U.snap){const x=await loadMarketFacts();return x.rows.filter(r=>r.market==='TWSE').map(twseRaw)}throw Error('此合法資料集尚未提供到公開前端；禁止以其他來源補值')};
  }
  if(typeof tpGet==='function'){
    tpGet=async function(url){if(typeof TPU!=='undefined'&&url===TPU.snap){const x=await loadMarketFacts();return x.rows.filter(r=>r.market==='TPEx').map(tpexRaw)}throw Error('此合法 TPEx 資料集尚未提供到公開前端；禁止以其他來源補值')};
  }
  window.StockLabSameOrigin={loadMarketFacts,universe,latest,mode:'licensed-normalized-market-facts',persistentMirror:true,rawDatasetMirror:false,remoteFallback:false,cacheIsSource:true,missingDataFallback:false};
})();