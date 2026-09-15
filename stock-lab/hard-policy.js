// StockLab hard policy: non-negotiable legality, integrity and no-fabrication gates.
(function(){
  const URL='./verification-policy.json';
  let POLICY=null,promise=null;
  const MISSING='資料未取得／未通過驗證';
  function ready(){
    if(!promise)promise=fetch(URL,{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('verification-policy unavailable');const x=await r.json();if(x.version<8)throw Error('verification-policy version too old');POLICY=x;return x;});
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
      if(ctx.targetInputsComplete!==true)blockers.push('目標交易時段必要資料尚未全部更新並通過驗證');
      if(ctx.modelValidationStatus!=='PASS')blockers.push(`買入模型樣本外驗證未通過：${ctx.modelValidationStatus||'UNKNOWN'}`);
      if(ctx.requestKind==='intraday_reprice'&&ctx.liveFeed!==true)blockers.push('沒有合法即時／延遲行情授權，禁止 09:00 後重算當日可執行價格');
      if(ctx.liveFeed===true)warnings.push('即時行情只可在另行取得合法授權後使用');
      if(ctx.preopenSessionValid===false)warnings.push('目前不是 08:30–09:00；原盤前 ROD 計畫只能作參考／稽核紀錄，不是目前即時報價');
      if(ctx.eventFeedAvailable!==true)warnings.push('重大事件自動資料流未完整接入；未知不得寫成「無事件」');
    }else if(mode==='holding'){
      if(!(ctx.userAverageCost>0))blockers.push('缺少使用者輸入的有效成本均價');
      if(!(ctx.userShares>0))blockers.push('缺少使用者輸入的有效持有股數');
      if(ctx.sufficientHistory!==true)blockers.push('持股出場模型歷史 OHLC 樣本不足或來源未授權');
      if(ctx.corporateActionKnown!==true)blockers.push('公司行動／參考價事件尚未完整驗證');
      if(ctx.holdingExitValidationStatus!=='PASS')blockers.push(`持股出場模型樣本外驗證未通過：${ctx.holdingExitValidationStatus||'UNKNOWN'}`);
    }else if(mode.startsWith('scanner_')){
      if(ctx.modelValidationStatus!=='PASS')blockers.push(`選股模型樣本外驗證未通過：${ctx.modelValidationStatus||'UNKNOWN'}`);
      if(mode==='scanner_momentum'){
        if(ctx.technicalVerified!==true)blockers.push('短線價差策略技術結構未驗證');
        if(ctx.liquidityVerified!==true)blockers.push('短線價差策略流動性未驗證');
      }
      if(mode==='scanner_growth'){
        if(!q.revenue?.ok)blockers.push('成長策略月營收資料缺漏／期別過舊');
        if(ctx.financialSchemaSupported!==true)blockers.push('成長策略會計類型尚未支援完整財務模型');
        else if(!q.quarterly?.ok)blockers.push('成長策略季報資料缺漏／期別不合格');
      }
      if(mode==='scanner_income'){
        if(!q.valuation?.ok)blockers.push('股息策略估值／殖利率資料缺漏或日期不合格');
        if(ctx.financialSchemaSupported!==true)blockers.push('股息策略會計類型尚未支援完整財務模型');
        else if(!q.quarterly?.ok)blockers.push('股息策略季報資料缺漏／期別不合格');
        if(ctx.dividendVerified!==true)blockers.push('股利分派資料未通過合法來源與期別驗證');
        if(!(Number(ctx.dividendHistoryYears)>=3))blockers.push('股利歷史不足 3 年，不能判定股息持續性');
        if(ctx.dividendPositive!==true)blockers.push('股息收益策略要求已驗證的正現金股利或股票股利');
      }
      if(mode==='scanner_total_return'){
        if(!q.valuation?.ok)blockers.push('長期總報酬策略估值資料缺漏／日期不合格');
        if(!q.revenue?.ok)blockers.push('長期總報酬策略月營收資料缺漏／期別過舊');
        if(ctx.financialSchemaSupported!==true)blockers.push('長期總報酬策略會計類型尚未支援完整財務模型');
        else if(!q.quarterly?.ok)blockers.push('長期總報酬策略季報資料缺漏／期別不合格');
        if(ctx.dividendVerified!==true)blockers.push('長期總報酬策略股利資料未驗證；即使零配息也必須是已驗證的零，而不是缺資料');
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
    if(kind==='analysis'&&d?.audit?.target_session_inputs_complete!==true)blockers.push('目標交易時段必要資料未完成');
    if(kind==='analysis'&&d?.audit?.intraday_reprice===true&&d?.audit?.licensed_live_feed!==true)blockers.push('無合法即時／延遲行情卻進行盤中重算');
    if(kind==='analysis'&&(!d.ticker||d.entry_price==null&&d.entry_low==null))blockers.push('買入分析必要欄位缺漏');
    if(kind==='holding'&&(!d.ticker||!d.position_audit||d.position_audit.user_input_verified!==true))blockers.push('持股分析缺少使用者持倉稽核');
    if(kind==='scanner'){
      if(!['momentum','growth','income','total_return'].includes(d.strategy))blockers.push('選股結果缺少有效投資策略');
      if(!Array.isArray(d.items)||d.items.length<10)blockers.push('通過 Gate 的候選不足 10 檔，不得補滿');
      for(const x of d.items||[]){
        if(x?.strategy!==d.strategy)blockers.push(`候選 ${x?.ticker||'—'} 策略不一致`);
        if(!Array.isArray(x?.reasons)||x.reasons.filter(Boolean).length<2)blockers.push(`候選 ${x?.ticker||'—'} 缺少入榜理由`);
        if(!Array.isArray(x?.risks)||x.risks.filter(Boolean).length<1)blockers.push(`候選 ${x?.ticker||'—'} 缺少主要風險`);
      }
    }
    return{ok:blockers.length===0,blockers};
  }
  function value(v){return v==null||v===''?MISSING:v}
  function isObserved(v){return v!=null&&v!==''&&Number.isFinite(Number(v))}
  function resultLabel(validationStatus){return validationStatus==='PASS'?'已通過樣本外驗證的模型參考':'研究模型估計（尚未取得有效樣本外 PASS，不得視為推薦）'}
  window.StockLabHardPolicy={ready,req,backendResult,value,isObserved,commonStockCode,MISSING,resultLabel,get policy(){return POLICY}};
})();
