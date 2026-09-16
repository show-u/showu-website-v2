// Online-only compatibility shim.
// Persistent repository snapshots are prohibited by StockLab policy.
// Existing network fetchers remain untouched; missing/blocked data must fail closed.
(function(){
  window.StockLabSameOrigin={
    mode:'online-only',
    persistentMirror:false,
    remoteFallback:false,
    cacheIsSource:false,
    missingDataFallback:false,
    loadSnapshot:async()=>{throw Error('持久資料鏡像已停用；請直接使用合法網路來源')},
    verifiedSnapshot:async()=>{throw Error('持久資料鏡像已停用；請直接使用合法網路來源')}
  };
})();
