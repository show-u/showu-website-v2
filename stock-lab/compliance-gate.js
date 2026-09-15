// Final production gate. Loaded last so no renderer can bypass legality/integrity policy.
(function(){
  const rt=window.STOCKLAB_RUNTIME||{};
  const analyze=document.querySelector('#analyzeBtn'),scan=document.querySelector('#scanBtn');
  const blockedReasons=()=>Array.isArray(rt.blockers)&&rt.blockers.length?rt.blockers:['預測必要 Gate 尚未全部通過'];
  const gateList=()=>Object.entries(rt.gates||{}).filter(([,v])=>v!==true).map(([k])=>k);
  function blockedHtml(title){
    const reasons=blockedReasons(),gates=gateList();
    return `<div class=toprow><div><h2>${title}</h2><div class=muted>StockLab Hard Policy v${rt.hardPolicyVersion||'—'}｜FAIL CLOSED</div></div></div>
      <h3 class=bad>⛔ 暫不輸出任何預測價格／推薦</h3>
      <p>必要資料的合法性、正確性或模型驗證只要有一項尚未確認，就必須停止數字預測。未知不視為通過，也不以假資料、舊資料、0、平均值或推測值補齊。</p>
      <div class=sourcegrid>${reasons.map(x=>`<div class=sourceitem><b>BLOCKER</b>${x}</div>`).join('')}</div>
      ${gates.length?`<p class=mini>未通過 Gate：${gates.join('｜')}</p>`:''}
      <div class=disclaimer><b>不可違反規則</b>沒有合法且已驗證的必要資料＝沒有預測。頁面只能顯示明確標示的已驗證觀測資料或「資料未取得／未通過驗證」，不得生成看似合理的替代數字。</div>`;
  }
  function renderBlock(target,title){const box=document.querySelector(target);if(!box)return;box.innerHTML=blockedHtml(title);box.classList.remove('hidden');}
  async function hardReady(){const p=await window.STOCKLAB_HARD_READY;if(!p||!window.StockLabHardPolicy)throw Error('Hard Policy 無法載入');return window.StockLabHardPolicy;}

  // Any private backend numeric result must carry its own legal-source and price-verification audit.
  if(window.StockLabAPI){
    const api=window.StockLabAPI,origAnalyze=api.analyze?.bind(api),origScan=api.scan?.bind(api);
    api.config.allowLocalFallback=false;
    if(origAnalyze)api.analyze=async function(code,h){const j=await origAnalyze(code,h),hp=await hardReady(),v=hp.backendResult(j,'analysis');if(!v.ok)throw Error(`後端稽核未通過：${v.blockers.join('；')}`);return j;};
    if(origScan)api.scan=async function(h){const j=await origScan(h),hp=await hardReady(),items=Array.isArray(j?.data?.items)?j.data.items:[];if(j?.ok!==true||!j?.model_version||!j?.data?.data_date||j?.data?.audit?.legal_source_verified!==true||j?.data?.audit?.price_verified!==true)throw Error('TOP10 後端缺少合法來源／價格驗證稽核');for(const x of items){if(x?.audit?.legal_source_verified!==true||x?.audit?.price_verified!==true)throw Error(`TOP10 ${x?.ticker||'項目'} 稽核未通過`);}return j;};
  }

  if(analyze){
    const original=analyze.onclick;
    analyze.onclick=async function(ev){
      try{await hardReady();}catch(e){renderBlock('#result','單股分析');return;}
      const apiReady=window.StockLabAPI?.config?.enabled===true;
      if(!apiReady&&rt.productionPredictionReady!==true){renderBlock('#result','單股分析');return;}
      if(apiReady||rt.productionPredictionReady===true)return original?.call(this,ev);
      renderBlock('#result','單股分析');
    };
  }
  if(scan){
    const original=scan.onclick;
    scan.onclick=async function(ev){
      try{await hardReady();}catch(e){renderBlock('#top10','TOP 10');return;}
      const apiReady=window.StockLabAPI?.config?.enabled===true;
      if(!apiReady&&rt.productionPredictionReady!==true){renderBlock('#top10','TOP 10');return;}
      if(apiReady||rt.productionPredictionReady===true)return original?.call(this,ev);
      renderBlock('#top10','TOP 10');
    };
  }

  window.StockLabCompliance={
    productionReady:()=>rt.productionPredictionReady===true,
    unresolvedGates:gateList,
    blockers:blockedReasons,
    renderBlock
  };
})();
