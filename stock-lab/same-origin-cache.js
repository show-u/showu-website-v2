// Same-origin licensed open-data adapter. A verified snapshot is only a retained copy of a legally permitted source response; it is never a substitute for missing data.
(function(){
  const MAP=new Map([
    [U.snap,'twse_snapshot'],[U.val,'twse_valuation'],[U.rev,'twse_revenue'],
    [TPU.snap,'tpex_snapshot'],[TPU.val,'tpex_valuation'],[TPU.inst,'tpex_institution'],[TPU.rev,'tpex_revenue']
  ]);
  let snapshotPromise=null;
  async function loadSnapshot(){
    if(!snapshotPromise)snapshotPromise=fetch('./browser-data.json',{cache:'no-store'}).then(async r=>{
      if(!r.ok)throw Error(`已驗證公開資料快照不存在或讀取失敗 ${r.status}`);
      const x=await r.json(),age=x.generated_at?(Date.now()-new Date(x.generated_at).getTime())/864e5:999;
      if(x.schema_version!==2||x.source!=='licensed-open-data-cache'||x.licence!=='政府資料開放授權條款-第1版 / OGDL-1.0'||age>4)throw Error('已驗證快照未通過版本／授權／時效驗證');
      for(const [k,m] of Object.entries(x.meta||{}))if(m?.licence_verified!==true||m?.licence!=='OGDL-1.0'||!m?.data_gov_dataset||!m?.attribution)throw Error(`${k} 缺少可追溯開放資料授權`);
      return x;
    }).catch(e=>{snapshotPromise=null;throw e});
    return snapshotPromise;
  }
  async function verifiedSnapshot(url){
    const key=MAP.get(url);
    if(!key)throw Error(`資料集未登錄合法可重用來源：${String(url)}`);
    const x=await loadSnapshot(),rows=x.datasets?.[key],meta=x.meta?.[key];
    if(meta?.licence_verified!==true)throw Error(`${key} 授權驗證未通過`);
    if(!Array.isArray(rows)||!rows.length)throw Error(`${key} 沒有可用的已驗證資料；不得以舊值、0、估計值或其他來源補值`);
    return rows;
  }
  // Browser layer is fail-closed. Absence of a verified snapshot remains absence; there is no remote or stale-data fallback here.
  jget=async function(url){return verifiedSnapshot(url)};
  tpGet=async function(url){await requireTpexHealth();return verifiedSnapshot(url)};
  window.StockLabSameOrigin={loadSnapshot,verifiedSnapshot,mode:'licensed-verified-snapshot-only',remoteFallback:false,cacheIsSource:false,missingDataFallback:false};
})();
