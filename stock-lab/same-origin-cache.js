// Same-origin licensed open-data adapter. Never treats an unlabeled mirror as legally usable.
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
      const x=await r.json(),age=x.generated_at?(Date.now()-new Date(x.generated_at).getTime())/864e5:999;
      if(x.schema_version!==2||x.source!=='licensed-open-data-cache'||x.licence!=='政府資料開放授權條款-第1版 / OGDL-1.0'||age>4)throw Error('同網域資料快照未通過版本／授權／時效驗證');
      for(const [k,m] of Object.entries(x.meta||{})){
        if(m?.licence_verified!==true||m?.licence!=='OGDL-1.0'||!m?.data_gov_dataset||!m?.attribution)throw Error(`${k} 缺少可追溯開放資料授權`);
      }
      return x;
    }).catch(e=>{cachePromise=null;throw e});
    return cachePromise;
  }
  async function mirrored(url){const key=MAP.get(url);if(!key)return null;const x=await loadCache(),rows=x.datasets?.[key];if(!Array.isArray(rows)||!rows.length)throw Error(`${key} 快照缺漏`);return rows;}
  const remoteJget=jget;
  jget=async function(url){try{const rows=await mirrored(url);return rows||remoteJget(url)}catch(e){return remoteJget(url)}};
  if(typeof tpGet==='function'){
    const remoteTpGet=tpGet;
    tpGet=async function(url){await requireTpexHealth();try{const rows=await mirrored(url);return rows||remoteTpGet(url)}catch{return remoteTpGet(url)}};
  }
  if(typeof finFetch==='function'){
    const remoteFinFetch=finFetch;
    finFetch=async function(url){try{const rows=await mirrored(url);return rows||remoteFinFetch(url)}catch{return remoteFinFetch(url)}};
  }
  window.StockLabSameOrigin={loadCache,mirrored,mode:'licensed-open-data-first'};
})();
