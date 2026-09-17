// Operational continuity controller. It never unlocks predictions by itself.
// It selects the safest usable mode when a primary source/model gate fails.
(function(){
  const POLICY_URL='./operational-fallback-policy.json';
  let state={mode:'INPUT_ONLY',reason:'尚未檢查',policy:null,readiness:null};
  async function j(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(`${url} ${r.status}`);return r.json()}
  async function factsReady(){
    try{
      const c=await window.StockLabSameOrigin?.loadCache?.();
      if(!c)return false;
      const legal=(c.schema_version===2&&c.source==='licensed-open-data-cache'&&String(c.licence||'').includes('OGDL'));
      const d=c.datasets||{};
      const tw=Array.isArray(d.twse_snapshot)&&d.twse_snapshot.length>0;
      const tp=Array.isArray(d.tpex_snapshot)&&d.tpex_snapshot.length>0;
      return legal&&(tw||tp);
    }catch{return false}
  }
  function paint(){
    const el=document.querySelector('#readinessDetails');if(!el)return;
    let box=document.querySelector('#operationalMode');
    if(!box){box=document.createElement('div');box.id='operationalMode';box.className='source-note compact-note';el.insertAdjacentElement('beforebegin',box)}
    const map={FULL_MODEL:['完整模型','所有正式 Gate 已通過'],VERIFIED_FACTS_ONLY:['已驗證事實模式','程式可正常查詢與管理部位，但不捏造進出場價格'],INPUT_ONLY:['輸入保存模式','市場資料尚未通過驗證；僅保留使用者輸入與本地計算']};
    const x=map[state.mode]||map.INPUT_ONLY;
    box.innerHTML=`<b>目前運行模式：${x[0]}</b><div class=mini>${x[1]}。${state.reason||''}</div>`;
  }
  async function refresh(){
    let policy=null,readiness=null;try{policy=await j(POLICY_URL)}catch{}
    try{readiness=await j('./holding-readiness.json')}catch{}
    const full=readiness?.overall_status==='PASS'&&readiness?.executable_exit_output===true;
    if(full){state={mode:'FULL_MODEL',reason:'正式歷史、OOS 與出場執行 Gate 已通過',policy,readiness};paint();return state}
    if(await factsReady())state={mode:'VERIFIED_FACTS_ONLY',reason:'完整模型尚未解鎖，已自動降級而非停止程式',policy,readiness};
    else state={mode:'INPUT_ONLY',reason:'目前沒有可用的已驗證市場快照，禁止以其他來源或舊值補洞',policy,readiness};
    paint();return state
  }
  window.StockLabOperational={refresh,get state(){return state},get mode(){return state.mode}};
  refresh();
})();
