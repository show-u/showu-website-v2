// Backend-first API client. Public UI exposes only the three current decision contracts.
(function(){
  const rt=window.STOCKLAB_RUNTIME||{};
  const base=String(rt.apiBase||'').replace(/\/$/,'');
  const CFG={
    base,
    enabled:/^https:\/\//i.test(base),
    allowLocalFallback:rt.allowLocalFallback!==false,
    timeoutMs:12000,
    version:'2026.09-api-v3'
  };
  async function request(path,payload){
    if(!CFG.enabled)throw Object.assign(new Error('private backend not configured'),{code:'BACKEND_DISABLED'});
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),CFG.timeoutMs);
    try{
      const r=await fetch(`${CFG.base}${path}`,{
        method:'POST',headers:{'content-type':'application/json','accept':'application/json'},
        body:JSON.stringify(payload),signal:ctrl.signal,credentials:'omit',cache:'no-store',redirect:'error'
      });
      if(!r.ok)throw new Error(`backend ${r.status}`);
      const j=await r.json();
      if(!j||j.ok!==true)throw new Error(j?.error||'backend response rejected');
      return j;
    }finally{clearTimeout(timer)}
  }
  async function analyze(code){return request('/v1/analyze',{ticker:String(code),strategy:'entry'});}
  async function scan(){return request('/v1/scan',{strategy:'entry'});}
  async function holding(code,position){return request('/v1/holding',{ticker:String(code),position});}
  function mode(){return CFG.enabled?'private-backend':'local-fallback'}
  window.StockLabAPI={config:CFG,request,analyze,scan,holding,mode};
})();