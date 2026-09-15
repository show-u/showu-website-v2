// Backend-first API client. Core algorithms can move server-side without changing the UI.
(function(){
  const rt=window.STOCKLAB_RUNTIME||{};
  const base=String(rt.apiBase||'').replace(/\/$/,'');
  const CFG={
    base,
    enabled:/^https:\/\//i.test(base),
    allowLocalFallback:rt.allowLocalFallback!==false,
    timeoutMs:12000,
    version:'2026.09-api-v1'
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
  async function analyze(code,horizon){return request('/v1/analyze',{ticker:String(code),horizon});}
  async function scan(horizon){return request('/v1/scan',{horizon});}
  function mode(){return CFG.enabled?'private-backend':'local-fallback'}
  window.StockLabAPI={config:CFG,request,analyze,scan,mode};
})();
