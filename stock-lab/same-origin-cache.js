// Same-origin verified data adapter. Avoids browser CORS failures for official snapshot-style datasets.
(function(){
  const MAP=new Map([
    [U.snap,'twse_snapshot'],[U.val,'twse_valuation'],[U.rev,'twse_revenue'],
    [FIN_URL?.listedIncome,'twse_income'],[FIN_URL?.listedBalance,'twse_balance'],
    [TPU?.snap,'tpex_snapshot'],[TPU?.val,'tpex_valuation'],[TPU?.inst,'tpex_institution'],[TPU?.rev,'tpex_revenue'],
    [FIN_URL?.otcIncome,'tpex_income'],[FIN_URL?.otcBalance,'tpex_balance']
  ].filter(([u])=>!!u));
  let cachePromise=null;
  async function loadCache(){
    if(!cachePromise)cachePromise=fetch('./browser-data.json',{cache:'no-store'}).then(async r=>{
      if(!r.ok)throw Error(`同網域資料快照讀取失敗 ${r.status}`);
      const x=await r.json();
      const age=x.generated_at?(Date.now()-new Date(x.generated_at).getTime())/864e5:999;
      if(x.schema_version!==1||x.source!=='official-mirror'||age>4)throw Error('同網域資料快照過期或格式錯誤');
      return x;
    }).catch(e=>{cachePromise=null;throw e});
    return cachePromise;
  }
  async function mirrored(url){const key=MAP.get(url);if(!key)return null;const x=await loadCache();const rows=x.datasets?.[key];if(!Array.isArray(rows)||!rows.length)throw Error(`${key} 快照缺漏`);return rows;}
  const remoteJget=jget;
  jget=async function(url){const rows=await mirrored(url);return rows||remoteJget(url)};
  if(typeof tpGet==='function'){
    const remoteTpGet=tpGet;
    tpGet=async function(url){await requireTpexHealth();const rows=await mirrored(url);return rows||remoteTpGet(url)};
  }
  if(typeof finFetch==='function'){
    const remoteFinFetch=finFetch;
    finFetch=async function(url){const rows=await mirrored(url);return rows||remoteFinFetch(url)};
  }
  window.StockLabSameOrigin={loadCache,mirrored,mode:'same-origin-first'};
})();
