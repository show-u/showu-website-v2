// StockLab Taiwan analyst 9+3 contract.
// Visible 9 sections match the decision questions a Taiwan-stock investor actually needs.
// Technical indicators live inside section ③; data legality/integrity gates sit outside the visible 9.
(function(){
  const SECTIONS=[
    ['priceVolume','① 價格與成交量'],
    ['taiwanMarket','② 台股大盤／市場環境'],
    ['technical','③ 技術面'],
    ['chips','④ 籌碼／法人／融資融券'],
    ['valuation','⑤ 估值'],
    ['revenue','⑥ 月營收'],
    ['quarterly','⑦ 季報／獲利'],
    ['financialQuality','⑧ 財務品質'],
    ['industryTrend','⑨ 產業／產品／公司動能']
  ];
  const CONTEXTS=[['us','＋1 美股／SOX'],['tx','＋2 台指期 TX'],['events','＋3 國際事件']];
  const MISSING='資料未取得／未通過驗證';
  function section(key,label,verified,state,evidence,provenance='derived',meta={}){
    return{key,label,verified:verified===true,state:verified===true?state:'unavailable',evidence:verified===true?evidence:MISSING,provenance:verified===true?provenance:'unavailable',...meta};
  }
  function marketContexts(sectorFamily='general'){
    const us=window.StockLabExternalMarket?.context?window.StockLabExternalMarket.context(sectorFamily):{verified:false,state:'unknown',reason:'美股資料層未接入',provenance:'unavailable'};
    const tx=window.StockLabTX?.context?window.StockLabTX.context():{verified:false,state:'unknown',reason:'台指期資料屈未接入',provenance:'unavailable'};
    const events=window.StockLabEvents?.context?window.StockLabEvents.context():{verified:false,state:'unknown',reason:'國際事件資料層未接入',provenance:'unavailable'};
    return{us,tx,events};
  }
  function summarize(sections,contexts){
    const vals=SECTIONS.map(([k])=>sections?.[k]),missing=vals.filter(x=>x?.verified!==true);
    const contextMissing=CONTEXTS.map(([k])=>k).filter(k=>contexts?.[k]?.verified!==true);
    const positive=vals.filter(x=>x?.state==='positive').length,negative=vals.filter(x=>x?.state==='negative').length,neutral=vals.filter(x=>x?.state==='neutral').length;
    return{
      complete:missing.length===0&&contextMissing.length===0,
      positive,negative,neutral,
      missingSections:missing.map(x=>x?.label||'未知項目'),
      missingContexts:contextMissing,
      decision:missing.length||contextMissing.length?'9+3 尚未完整；只顯示已驗證事實與條件，不補值':'9+3 資料完整，可交由已通過驗證的決策模型'
    };
  }
  function factorList(){return SECTIONS.map(([key,label])=>({key,label}))}
  function contextList(){return CONTEXTS.map(([key,label])=>({key,label}))}
  window.StockLabEntryDecision={section,marketContexts,summarize,factorList,contextList,MISSING,model:'TW-analyst-9plus3-contract-v2'};
})();