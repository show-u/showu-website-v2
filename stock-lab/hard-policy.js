// StockLab hard policy: non-negotiable legality, integrity and no-fabrication gates.
(function(){
  const URL='./verification-policy.json';let POLICY=null,promise=null;const MISSING='資料未取得／未通過驗證';
  const ENTRY_FACTOR_KEYS=['trend','volume','movingAverages','institution','macd','rsi','kd','crossovers','candlestick'];
  function ready(){if(!promise)promise=fetch(URL,{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('verification-policy unavailable');const x=await r.json();if(x.version<9)throw Error('verification-policy version too old');POLICY=x;return x;});return promise}
  function commonStockCode(code){const s=String(code||'').trim();return /^\d{4}$/.test(s)&&!s.startsWith('00')}
  function entryFactorSetOK(f){return !!f&&ENTRY_FACTOR_KEYS.every(k=>f[k]?.verified===true&&['positive','neutral','negative'].includes(f[k]?.state))}
  function marketContextOK(c){return c?.us?.verified===true&&c?.tx?.verified===true&&c?.events?.verified===true}
  function validConfidence(value,audit){const x=Number(value);return audit?.confidence_calibrated===true&&Number.isFinite(x)&&x>=0&&x<=100}
  function validRange(lo,hi){const a=Number(lo),b=Number(hi);return Number.isFinite(a)&&Number.isFinite(b)&&a>0&&b>=a}
  function validPositive(v){const x=Number(v);return Number.isFinite(x)&&x>0}
  function validISODate(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||''))}
  function sessionPairOK(base,target){return validISODate(base)&&validISODate(target)&&String(target)>String(base)}
  function req(mode,a,vf,ctx={}){
    const blockers=[],warnings=[];
    if(ctx.legalSource!==true)blockers.push('資料來源授權／合法使用狀態未通過');
    if(ctx.securitySupported!==true)blockers.push('商品類型不在目前台股普通股模型支援範圍');
    if(!vf?.complete)blockers.push('官方價格日期／收盤價交叉驗證未通過');
    const q=a?.integrity||{};if(!q.price?.ok)blockers.push('價格資料未通過完整性驗證');
    if(mode==='buy'){
      if(ctx.activeDispositionKnown!==true)blockers.push('目標交易日處置／特殊交易狀態尚未完整驗證');if(a?.riskBlocked)blockers.push('處置或交易風險 Gate 阻擋');
      if(ctx.sufficientHistory!==true)blockers.push('九項入場模型歷史 OHLC 樣本不足或來源未授權');if(ctx.corporateActionKnown!==true)blockers.push('除權息／減資／新上市等參考價事件尚未完整驗證');if(ctx.targetSessionVerified!==true)blockers.push('資料基準交易日／目標交易日尚未由合法交易日曆確認');if(ctx.targetInputsComplete!==true)blockers.push('目標交易時段必要資料尚未全部更新並通過驗證');if(ctx.entryFactorsComplete!==true)blockers.push('九項入場因子未全部完成驗證');if(ctx.usMarketVerified!==true)blockers.push('美股市場背景尚未完整');if(ctx.txFuturesVerified!==true)blockers.push('台指期 TX 尚未完整');if(ctx.internationalEventsVerified!==true)blockers.push('國際時事背景尚未完整');if(ctx.modelValidationStatus!=='PASS')blockers.push(`統一入場模型樣本外驗證未通過：${ctx.modelValidationStatus||'UNKNOWN'}`);if(ctx.entryRangeExecutionValidated!==true)blockers.push('進場區間尚未通過 OOS 觸價／成交可達性驗證');if(ctx.confidenceCalibrated!==true)blockers.push('入場信心指數尚未完成正式樣本外校準');if(ctx.requestKind==='intraday_reprice'&&ctx.liveFeed!==true)blockers.push('沒有合法即時／延遲行情授權，禁止 09:00 後重算當日可執行價格');if(ctx.preopenSessionValid===false)warnings.push('目前不是 08:30–09:00；盤前 ROD 計畫只能作參考／稽核紀錄，不是目前即時報價');
    }else if(mode==='holding'){
      if(!(ctx.userAverageCost>0))blockers.push('缺少使用者輸入的有效成本均價');if(!(ctx.userShares>0))blockers.push('缺少使用者輸入的有效持有股數');if(!validISODate(ctx.userBuyDate))blockers.push('缺少使用者輸入的有效首次買入日；禁止推測持有起點');
      if(ctx.activeDispositionKnown!==true)warnings.push('注意／處置／特殊交易狀態未完整驗證；不得假設無風險旗標');if(ctx.corporateActionKnown!==true)warnings.push('公司行動／參考價事件未完整驗證；不得假設沒有事件');if(ctx.sufficientHistory!==true)warnings.push('歷史不足時只使用可驗證的近期價格／成本風險規則，不捏造長週期支撐壓力');if(ctx.holdingExitValidationStatus!=='PASS')warnings.push('OOS 尚未 PASS：只禁止勝率／機率／校準信心宣稱，不得鎖住規則式持倉管理');if(ctx.confidenceCalibrated!==true)warnings.push('信心未校準：禁止顯示信心百分比');
    }else if(mode==='scanner_entry'){
      if(ctx.targetSessionVerified!==true)blockers.push('TOP10 目標交易日尚未由合法交易日曆確認');if(ctx.entryFactorsComplete!==true)blockers.push('選股候選九項入場因子未全部驗證');if(ctx.usMarketVerified!==true||ctx.txFuturesVerified!==true||ctx.internationalEventsVerified!==true)blockers.push('選股市場背景（美股／台指期／國際時事）未全部驗證');if(ctx.modelValidationStatus!=='PASS')blockers.push(`入場 TOP10 模型樣本外驗證未通過：${ctx.modelValidationStatus||'UNKNOWN'}`);if(ctx.entryRangeExecutionValidated!==true)blockers.push('TOP10 進場區間尚未通過 OOS 觸價／成交可達性驗證');if(ctx.confidenceCalibrated!==true)blockers.push('TOP10 信心指數尚未完成正式樣本外校準');
    }
    return{ok:blockers.length===0,blockers,warnings,mode};
  }
  function backendResult(j,kind='analysis'){
    const d=j?.data||{},blockers=[];if(j?.ok!==true)blockers.push('後端回應非成功');if(!j?.model_version)blockers.push('缺少模型版本');if(!d?.data_date)blockers.push('缺少資料日期');if(!d?.audit||d.audit.legal_source_verified!==true||d.audit.price_verified!==true)blockers.push('缺少合法來源／價格驗證稽核');if(d?.audit?.imputation_used===true)blockers.push('後端使用了補值，違反 NO_IMPUTATION');
    if(kind!=='holding'&&d?.audit?.oos_validation_passed!==true)blockers.push('模型尚未取得正式樣本外 PASS，禁止輸出可執行數字預測');
    if(kind==='analysis'){
      if(d?.audit?.corporate_action_checked===false)blockers.push('公司行動／參考價事件未完成檢查');if(d?.audit?.active_risk_status_checked===false)blockers.push('注意／處置／特殊交易狀態未完成檢查');if(d?.audit?.trading_calendar_verified!==true)blockers.push('台股交易日曆未完成驗證');const base=d.base_session_date||d.data_date,target=d.target_session_date;if(!sessionPairOK(base,target))blockers.push('缺少有效的資料基準交易日／模型適用交易日');if(d?.audit?.target_session_inputs_complete!==true)blockers.push('目標交易時段必要資料未完成');if(d?.audit?.entry_range_execution_validated!==true)blockers.push('進場區間未通過 OOS 觸價／成交可達性驗證');if(d?.audit?.intraday_reprice===true&&d?.audit?.licensed_live_feed!==true)blockers.push('無合法即時／延遲行情卻進行盤中重算');if(!d.ticker)blockers.push('買入分析缺少股票代號');if(!entryFactorSetOK(d.entry_factors))blockers.push('九項入場因子未全部驗證');if(!marketContextOK(d.market_context))blockers.push('美股／台指期／國際時事未全部驗證');if(!validRange(d.entry_low,d.entry_high))blockers.push('買入分析缺少有效進場價格區間');if(!validConfidence(d.confidence_index,d.audit))blockers.push('買入信心指數未完成正式樣本外校準');
    }
    if(kind==='holding'){
      if(!d.ticker||!d.position_audit||d.position_audit.user_input_verified!==true)blockers.push('持股分析缺少使用者持倉稽核');if(d.position_audit?.average_cost_verified!==true)blockers.push('持股成本均價未確認為有效使用者輸入');if(d.position_audit?.shares_verified!==true)blockers.push('持有股數未確認為有效使用者輸入');if(d.position_audit?.buy_date_verified!==true)blockers.push('首次買入日未確認為有效使用者輸入；禁止推測持有起點');
      if(d.confidence_index!=null&&!validConfidence(d.confidence_index,d.audit))blockers.push('後端提供未校準信心指數，拒絕顯示');
      const hasExit=validRange(d.exit_low,d.exit_high)||validPositive(d.exit_price);if(hasExit&&d?.audit?.exit_price_provenance_verified!==true)blockers.push('後端提供數字出場價但未證明其來源／公式可追溯');
    }
    if(kind==='scanner'){
      if(d.strategy!=='entry')blockers.push('選股結果不是統一入場模型');if(!validISODate(d.target_session_date))blockers.push('TOP10 缺少已驗證目標交易日');if(!Array.isArray(d.items))blockers.push('TOP10 候選格式無效');else if(d.items.length>10)blockers.push('TOP10 後端回傳超過 10 檔；必須只回傳實際最高順位的合格候選');for(const x of d.items||[]){const base=x?.base_session_date||x?.data_date,target=x?.target_session_date||d.target_session_date;if(!sessionPairOK(base,target))blockers.push(`候選 ${x?.ticker||'—'} 基準日／目標交易日無效`);if(x?.strategy!=='entry')blockers.push(`候選 ${x?.ticker||'—'} 模型標籤不一致`);if(!entryFactorSetOK(x?.entry_factors))blockers.push(`候選 ${x?.ticker||'—'} 九項入場因子未完整驗證`);if(!marketContextOK(x?.market_context))blockers.push(`候選 ${x?.ticker||'—'} 市場背景未完整驗證`);if(x?.audit?.entry_range_execution_validated!==true)blockers.push(`候選 ${x?.ticker||'—'} 進場區間未通過 OOS 可達性驗證`);if(!validRange(x?.entry_low,x?.entry_high))blockers.push(`候選 ${x?.ticker||'—'} 缺少有效進場區間`);if(!validConfidence(x?.confidence_index,x?.audit))blockers.push(`候選 ${x?.ticker||'—'} 信心指數未完成正式樣本外校準`);if(!Array.isArray(x?.reasons)||x.reasons.filter(Boolean).length<2)blockers.push(`候選 ${x?.ticker||'—'} 缺少入榜理由`);if(!Array.isArray(x?.risks)||x.risks.filter(Boolean).length<1)blockers.push(`候選 ${x?.ticker||'—'} 缺少主要風險`)}
    }
    return{ok:blockers.length===0,blockers};
  }
  function value(v){return v==null||v===''?MISSING:v}function isObserved(v){return v!=null&&v!==''&&Number.isFinite(Number(v))}function resultLabel(validationStatus){return validationStatus==='PASS'?'已通過樣本外驗證的模型參考':'未校準研究輸出；不得解讀為勝率或機率'}
  window.StockLabHardPolicy={ready,req,backendResult,value,isObserved,commonStockCode,entryFactorSetOK,marketContextOK,validConfidence,validRange,validISODate,sessionPairOK,MISSING,resultLabel,get policy(){return POLICY}};
})();