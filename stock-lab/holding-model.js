// Existing-position management using the same verified 9+3 evidence contract as entry analysis.
// Numeric exit prices are NEVER replaced by the previous-session low. Missing 9+3/history stays unavailable.
(function(){
  function num(v){if(v==null)return null;const x=Number(String(v).replace(/,/g,''));return Number.isFinite(x)?x:null}
  function dateMs(v){if(!v)return null;const d=new Date(`${v}T00:00:00+08:00`);return Number.isNaN(d.getTime())?null:d.getTime()}
  function barDate(x){return x?.iso||x?.date||null}
  function positionInput(x){
    let averageCost=num(x?.averageCost),shares=num(x?.shares),totalCost=num(x?.totalCost),buyTime=String(x?.buyTime||'').trim(),buyDate=buyTime.slice(0,10);
    if(!(shares>0))throw Error('持有股數必須大於 0');
    if(!(averageCost>0)&&!(totalCost>0))throw Error('成本均價與總成本至少需要一個有效值');
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(buyTime)||dateMs(buyDate)==null)throw Error('首次買入時間必須由使用者輸入有效日期時間');
    if(!(averageCost>0))averageCost=totalCost/shares;
    if(!(totalCost>0))totalCost=averageCost*shares;
    const tol=Math.max(1,totalCost*.001);if(Math.abs(averageCost*shares-totalCost)>tol)throw Error('成本均價、持有股數與總成本彼此不一致');
    return{averageCost,shares,totalCost,buyTime,buyDate,lots:Array.isArray(x?.lots)?x.lots:null,provenance:x?.provenance||{averageCost:'user_or_derived',shares:'user_observed',totalCost:'user_or_derived',buyTime:'user_observed'}};
  }
  function normalizeBars(bars){
    return (Array.isArray(bars)?bars:[]).filter(x=>Number.isFinite(Number(x?.c))&&Number(x.c)>0).map(x=>({...x,c:Number(x.c),o:num(x.o),h:num(x.h),l:num(x.l)})).sort((a,b)=>String(barDate(a)).localeCompare(String(barDate(b))));
  }
  function analyze(input,bars,ctx={}){
    const p=positionInput(input),r=normalizeBars(bars);
    if(!r.length)throw Error('沒有可用的已驗證收盤資料');
    if(ctx.legalSource!==true)throw Error('行情來源授權未通過');
    if(ctx.priceVerified!==true)throw Error('最新收盤尚未通過驗證');
    const L=r.at(-1),dataDate=barDate(L);if(!dataDate)throw Error('最新交易日缺漏');
    const cost=p.totalCost,marketValue=L.c*p.shares,pnl=marketValue-cost,pnlPct=cost?100*pnl/cost:null;
    const buyMs=dateMs(p.buyDate),since=r.filter(x=>{const d=dateMs(String(barDate(x)||'').slice(0,10));return d!=null&&buyMs!=null&&d>=buyMs});
    const sinceHigh=since.length?Math.max(...since.map(x=>num(x.h)).filter(Number.isFinite)):null,sinceLow=since.length?Math.min(...since.map(x=>num(x.l)).filter(Number.isFinite)):null;
    const maxGainPct=sinceHigh!=null?100*(sinceHigh/p.averageCost-1):null,maxDrawdownPct=sinceLow!=null?100*(sinceLow/p.averageCost-1):null;
    const weighted=ctx.ninePlus3||null;
    const plan=window.StockLabEntryDecision?.exitPlan?.(r,L.c,p.averageCost,weighted)||{available:false,reason:'9+3 出場價格層尚未載入'};
    const riskBlocked=ctx.riskBlocked===true,riskKnown=ctx.activeRiskKnown===true,corporateKnown=ctx.corporateActionKnown===true;
    let state,reason,nextAction;
    if(riskBlocked){
      state='特殊交易風險優先';
      reason='已驗證處置／信用交易限制等特殊狀態優先於一般持有模型';
      nextAction='先確認下一合法交易時段可用委託與限制，再執行減碼／退出判斷';
    }else if(!plan.available){
      state='價格結構不足';
      reason=plan.reason||'合法歷史不足，無法建立出場觸發價';
      nextAction='不以單日低點、固定百分比或 AI 猜值補出場價';
    }else if(weighted?.complete!==true){
      state='條件式持有管理';
      reason='9+3 尚未完整；缺項維持未知，但已驗證 OHLC 可以形成結構風險線，不再整頁鎖死';
      nextAction='先依結構風險線管理持倉；9+3 缺項補齊後，再升級續抱／減碼／退出方向判斷';
    }else if(weighted.score<=40){
      state='9+3 明顯轉弱';
      reason='加權後負面證據占優勢；出場風險線應較緊';
      nextAction='下一合法交易時段若有效跌破建議出場觸發價，優先檢視減碼／退出';
    }else if(weighted.score<60){
      state='9+3 混合偏防守';
      reason='正負面證據接近；持有但風險線不可放寬';
      nextAction='守住建議出場觸發價；跌破則進入減碼／出場檢視';
    }else{
      state='9+3 偏支持續抱';
      reason='已驗證加權證據偏正面；仍使用結構化風險線保護部位';
      nextAction='續抱觀察；跌破建議出場觸發價再重新評估，接近壓力區可檢視分批停利';
    }
    const trigger=plan.available?plan.trigger:null,pressure=plan.available?plan.pressure:null;
    const exitCondition=trigger!=null?`下一合法交易時段若有效跌破 ${trigger}，進入減碼／出場檢視`:(plan.reason||'目前無法形成 9+3 數字出場價');
    const reduceCondition=pressure!=null&&pnl>0?`接近 ${pressure} 且 9+3 未同步改善時，可檢視分批停利`:pnl>0?'有獲利，但 9+3／價格結構不足，暫不製造數字停利價':'目前未形成可驗證的獲利減碼價格條件';
    const confidence=weighted?.confidenceIndex??null;
    return{
      model:'TW-holding-9plus3-v4',validation:'9PLUS3_WEIGHTED_RULE_BASED',dataDate,latestClose:L.c,
      position:p,
      derived:{cost,marketValue,pnl,pnlPct,availableBars:r.length,historyLevel:r.length>=60?`${r.length} 根合法已驗證 OHLC`:`${r.length} 根；不足價格模型最低 60 根`,support:trigger,resistance:pressure,tradingBarsSinceBuy:since.length,maxGainPct,maxDrawdownPct,sinceEntryHigh:sinceHigh,sinceEntryLow:sinceLow},
      decision:{
        state,reason,nextAction,riskTrigger:trigger,pressureReference:pressure,
        riskTriggerBasis:plan.available?plan.basis:'合法價格結構不足；禁止退回上一交易日低點',
        pressureBasis:plan.available?'20日高價分布第80百分位，並由 9+3 持有判斷共同解讀':'資料不足',
        exitAction:exitCondition,exitCondition,reduceCondition,
        riskTriggerMeaning:trigger!=null?'9+3 加權後的結構化出場觸發，不是保證成交價':(plan.reason||'無法產生 9+3 出場價'),
        pressureMeaning:pressure!=null?'已驗證價格結構的停利／壓力參考，不是保證成交價':'目前資料不足以產生壓力價',
        decisionScore:weighted?.score??null,decisionConfidenceIndex:confidence,
        confidenceMeaning:weighted?.confidenceMeaning||'資料不足；信心指數不補值'
      },
      ninePlus3:weighted,
      audit:{legal_source_verified:true,price_verified:true,active_risk_known:riskKnown,corporate_action_known:corporateKnown,oos_status:ctx.oosStatus||'NOT_REQUIRED_FOR_RULE_BASED_OUTPUT',probability_calibrated:false,imputation_used:false},
      limits:{statement:'決策信心指數只衡量 9+3 已驗證資料覆蓋與方向一致性，不是勝率、成功率或未來價格機率。任何統計機率仍須正式 OOS 校準。'},
      provenance:{position:p.provenance,latestClose:'observed',pnl:'derived',riskTrigger:trigger!=null?'derived_from_verified_9plus3_and_price_structure':'unavailable',decisionConfidenceIndex:confidence!=null?'derived_evidence_coverage_and_consistency':'unavailable',decision:'weighted_rule'}
    };
  }
  window.StockLabHolding={analyze,positionInput,requiredBars:()=>1,priceRecommendationBars:()=>60};
})();