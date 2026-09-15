// Public runtime switch only. Never place secrets here.
// Hard policy is loaded before users can request analysis; failure is fail-closed at prediction gates.
window.STOCKLAB_RUNTIME={
  apiBase:'',
  allowLocalFallback:true,
  architecture:'backend-first-migration',
  hardPolicyVersion:4
};
window.STOCKLAB_HARD_READY=import('./hard-policy.js')
  .then(()=>window.StockLabHardPolicy.ready())
  .catch(e=>{console.error('StockLab hard policy unavailable',e);return null});
