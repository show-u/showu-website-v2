// StockLab hard policy: non-negotiable legality, integrity and no-fabrication gates.
(function(){
  const URL='./verification-policy.json';
  let POLICY=null,promise=null;
  const MISSING='資料未取得／未通過驗證';
  function ready(){
    if(!promise)promise=fetch(URL,{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('verification-policy unavailable');const x=await r.json();if(x.version<5)throw Error('verification-policy version too old');POLICY=x;return x;});
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
    if(mode==='preopen'){
      if(ctx.sufficientHistory!==true)blockers.push('盤前模型歷史 OHLC 樣本不足');
      if(ctx.corporateActionKnown!==true)blockers.push('除權息／減資／新上市等參考價事件尚未完整驗證');
      if(ctx.preopenSessionValid===false)blockers.push('已超過開盤前委託有效時段');
      if(ctx.eventFeedAvailable!==true)warnings.push('重大事件自動資料流未完整接入；未知不得寫成「無事件」');
    }else if(mode==='1m'){
      if(!q.revenue?.ok)blockers.push('月營收資料缺漏／期別過舊');
      if(!q.institution?.ok)warnings.push('法人資料不可用／日期不一致；該因子保持缺失且不計分');
    }else if(mode==='3m'){
      if(!q.revenue?.ok)blockers.push('月營收資料缺漏／期別過舊');
      if(ctx.financialSchemaSupported===true&&!q.quarterly?.ok)blockers.push('季報資料缺漏／期別不合格');
      if(ctx.financialSchemaSupported!==true)warnings.push('該會計類型尚未支援完整財務模型；不得套用一般業分數');
      if(!q.institution?.ok)warnings.push('法人資料不可用／日期不一致；該因子保持缺失且不計分');
    }else if(mode==='long'){
      if(!q.valuation?.ok)blockers.push('估值資料缺漏／日期不合格');
      if(!q.revenue?.ok)blockers.push('月營收資料缺漏／期別過舊');
      if(ctx.financialSchemaSupported===true&&!q.quarterly?.ok)blockers.push('季報資料缺漏／期別不合格');
      if(ctx.financialSchemaSupported!==true)blockers.push('該會計類型尚未支援完整長期財務模型');
    }
    if(ctx.modelValidationStatus&&ctx.modelValidationStatus!=='PASS')warnings.push(`模型樣本外驗證：${ctx.modelValidationStatus}；只能標示研究估算，不能標示已驗證推薦`);
    return{ok:blockers.length===0,blockers,warnings,mode};
  }
  function backendResult(j,kind='analysis'){
    const d=j?.data||{},blockers=[];
    if(j?.ok!==true)blockers.push('後端回應非成功');
    if(!j?.model_version)blockers.push('缺少模型版本');
    if(!d?.data_date)blockers.push('缺少資料日期');
    if(!d?.audit||d.audit.legal_source_verified!==true||d.audit.price_verified!==true)blockers.push('缺少合法來源／價格驗證稽核');
    if(d?.audit?.imputation_used===true)blockers.push('後端使用了補值，違反 NO_IMPUTATION');
    if(kind==='analysis'&&(!d.ticker||d.entry_low==null||d.entry_high==null))blockers.push('分析必要欄位缺漏');
    return{ok:blockers.length===0,blockers};
  }
  function value(v){return v==null||v===''?MISSING:v}
  function isObserved(v){return v!=null&&v!==''&&Number.isFinite(Number(v))}
  function resultLabel(validationStatus){return validationStatus==='PASS'?'已通過樣本外驗證的模型參考':'研究模型估計（尚未取得有效樣本外 PASS，不得視為推薦）'}
  window.StockLabHardPolicy={ready,req,backendResult,value,isObserved,commonStockCode,MISSING,resultLabel,get policy(){return POLICY}};
})();
