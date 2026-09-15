// StockLab hard policy: non-negotiable legality, integrity and no-fabrication gates.
(function(){
  const URL='./verification-policy.json';
  let POLICY=null,promise=null;
  const MISSING='資料未取得／未通過驗證';
  function ready(){
    if(!promise)promise=fetch(URL,{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('verification-policy unavailable');const x=await r.json();if(x.version<6)throw Error('verification-policy version too old');POLICY=x;return x;});
    return promise;
  }
  function commonStockCode(code){const s=String(code||'').trim();return /^\d{4}$/.test(s)&&!s.startsWith('00')}
  function req(mode,a,vf,ctx={}){
    const blockers=[],warnings=[];
    if(ctx.legalSource!==true)blockers.push('資料來源授權／合法使用狀態未通過');
    if(ctx.securitySupported!==true)blockers.push('商品類型不在目前台股普通股模型支援範圍');
    if(!vf?.complete)blockers.push('官方價格日期／收盤價交叉驗證未通過');
    const q=a?.integrity||{};
    if(!q.price?.ok)blockers.push('價格資料未通過完整性驗證');
    if(ctx.activeDispositionKnown!==true)blockers.push('目標交易日處置／特殊交易狀態尚未完整驗證');
    if(a?.riskBlocked)blockers.push('處置或交易風險 Gate 阻擋');

    if(mode==='buy'){
      if(ctx.sufficientHistory!==true)blockers.push('買入模型歷史 OHLC 樣本不足或來源未授權');
      if(ctx.corporateActionKnown!==true)blockers.push('除權息／減資／新上市等參考價事件尚未完整驗證');
      if(ctx.modelValidationStatus!=='PASS')blockers.push(`買入模型樣本外驗證未通過：${ctx.modelValidationStatus||'UNKNOWN'}`);
      if(ctx.liveFeed===true)warnings.push('即時行情只可在另行取得合法授權後使用');
      if(ctx.preopenSessionValid===false)warnings.push('目前不是 08:30–09:00，盤前 ROD 價格只能作原始計畫／研究參考，不是目前可下單報價');
      if(ctx.eventFeedAvailable!==true)warnings.push('重大事件自動資料流未完整接入；未知不得寫成「無事件」');
    }else if(mode==='holding'){
      if(!(ctx.userAverageCost>0))blockers.push('缺少使用者輸入的有效成本均價');
      if(!(ctx.userShares>0))blockers.push('缺少使用者輸入的有效持有股數');
      if(ctx.sufficientHistory!==true)blockers.push('持股出場模型歷史 OHLC 樣本不足或來源未授權');
      if(ctx.corporateActionKnown!==true)blockers.push('公司行動／參考價事件尚未完整驗證');
      if(ctx.holdingExitValidationStatus!=='PASS')blockers.push(`持股出場模型樣本外驗證未通過：${ctx.holdingExitValidationStatus||'UNKNOWN'}`);
    }else if(mode.startsWith('scanner_')){
      if(ctx.modelValidationStatus!=='PASS')blockers.push(`選股模型樣本外驗證未通過：${ctx.modelValidationStatus||'UNKNOWN'}`);
      if(mode==='scanner_short'&&!q.revenue?.ok)blockers.push('月營收資料缺漏／期別過舊');
      if(mode==='scanner_swing'){
        if(!q.revenue?.ok)blockers.push('月營收資料缺漏／期別過舊');
        if(ctx.financialSchemaSupported===true&&!q.quarterly?.ok)blockers.push('季報資料缺漏／期別不合格');
        if(ctx.financialSchemaSupported!==true)warnings.push('該會計類型尚未支援完整財務模型；不得套用一般業分數');
      }
      if(mode==='scanner_long'){
        if(!q.valuation?.ok)blockers.push('估值資料缺漏／日期不合格');
        if(!q.revenue?.ok)blockers.push('月營收資料缺漏／期別過舊');
        if(ctx.financialSchemaSupported!==true)blockers.push('該會計類型尚未支援完整長期財務模型');
        else if(!q.quarterly?.ok)blockers.push('季報資料缺漏／期別不合格');
      }
    }
    return{ok:blockers.length===0,blockers,warnings,mode};
  }
  function backendResult(j,kind='analysis'){
    const d=j?.data||{},blockers=[];
    if(j?.ok!==true)blockers.push('後端回應非成功');
    if(!j?.model_version)blockers.push('缺少模型版本');
    if(!d?.data_date)blockers.push('缺少資料日期');
    if(!d?.audit||d.audit.legal_source_verified!==true||d.audit.price_verified!==true)blockers.push('缺少合法來源／價格驗證稽核');
    if(d?.audit?.imputation_used===true)blockers.push('後端使用了補值，違反 NO_IMPUTATION');
    if(d?.audit?.oos_validation_passed!==true)blockers.push('模型尚未取得正式樣本外 PASS，禁止輸出可執行數字預測');
    if(d?.audit?.corporate_action_checked===false)blockers.push('公司行動／參考價事件未完成檢查');
    if(d?.audit?.active_risk_status_checked===false)blockers.push('注意／處置／特殊交易狀態未完成檢查');
    if(kind==='analysis'&&(!d.ticker||d.entry_price==null&&d.entry_low==null))blockers.push('買入分析必要欄位缺漏');
    if(kind==='holding'&&(!d.ticker||!d.position_audit||d.position_audit.user_input_verified!==true))blockers.push('持股分析缺少使用者持倉稽核');
    return{ok:blockers.length===0,blockers};
  }
  function value(v){return v==null||v===''?MISSING:v}
  function isObserved(v){return v!=null&&v!==''&&Number.isFinite(Number(v))}
  function resultLabel(validationStatus){return validationStatus==='PASS'?'已通過樣本外驗證的模型參考':'研究模型估計（尚未取得有效樣本外 PASS，不得視為推薦）'}
  window.StockLabHardPolicy={ready,req,backendResult,value,isObserved,commonStockCode,MISSING,resultLabel,get policy(){return POLICY}};
})();
