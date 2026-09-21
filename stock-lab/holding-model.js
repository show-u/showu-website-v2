// Existing-position management using the same verified 9+3 evidence contract as entry analysis.
// Numeric exit prices are NEVER replaced by the previous-session low. Missing 9+3/history stays unavailable.
(function(){
  function num(v){if(v==null)return null;const x=Number(String(v).replace(/,/g,''));return Number.isFinite(x)?x:null}
  function dateMs(v){if(!v)return null;const d=new Date(`${v}T00:00:00+08:00`);return Number.isNaN(d.getTime())?null:d.getTime()}
  function tickRound(p,mode='nearest'){const f=window.StockLabTaiwan?.roundTick;return typeof f==='function'?f(p,mode):p}
  function barDate(x){return x?.iso||x?.date||null}
  function positionInput(x){
    const averageCost=num(x?.averageCost),shares=num(x?.shares),buyTime=String(x?.buyTime||'').trim(),buyDate=buyTime.slice(0,10);
    if(!(averageCost>0))throw Error('成本均價必須由使用者輸入有效正數');
    if(!(shares>0))throw Error('持有股數必須大於 0');
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(buyTime)||dateMs(buyDate)==null)throw Error('首次買入時間必須由使用者輸入有效日期時間');
    const totalCost=averageCost*shares;
    if(num(x?.totalCost)!=null){const tol=Math.max(1,totalCost*.001);if(Math.abs(num(x.totalCost)-totalCost)>tol)throw Error('內部總成本必須等於成本均價 × 持有股數')}
    return{averageCost,shares,totalCost,buyTime,buyDate,lots:Array.isArray(x?.lots)?x.lots:null,provenance:x?.provenance||{averageCost:'user_observed',shares:'user_observed',totalCost:'derived_from_average_cost_times_shares',buyTime:'user_observed'}};
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
    const executionReference=tickRound(L.c),breakevenReference=tickRound(p.averageCost);
    const fullDecision=weighted?.complete===true&&Number.isFinite(Number(weighted?.score)),decisionScore=fullDecision?Number(weighted.score):null;
    const verifiedWeight=Number(weighted?.verifiedWeight||0),evidenceNet=Number(weighted?.netBalance||0),hasEvidence=verifiedWeight>0;
    const partialNegative=!fullDecision&&hasEvidence&&evidenceNet<0,partialPositive=!fullDecision&&hasEvidence&&evidenceNet>0;
    let state,reason,nextAction;
    if(riskBlocked){
      state='特殊交易風險優先';
      reason='已驗證處置／信用交易限制等特殊狀態優先於一般持有模型';
      nextAction='先確認下一合法交易時段可用委託與限制；若需要退出，以最新完成交易日收盤作委託定價基準，不假設可成交在該價';
    }else if(fullDecision&&decisionScore<=40){
      state='9+3 明顯轉弱｜優先檢視退出';
      reason='12 項必要證據已完整且加權後負面占優勢';
      nextAction='下一合法交易時段優先檢視減碼／退出；執行定價先以最新完成交易日收盤為基準，若有合法即時行情再更新，不用舊支撐價硬湊';
    }else if(fullDecision&&decisionScore<60){
      state='9+3 混合偏防守｜優先檢視減碼';
      reason='12 項必要證據完整但正負面接近';
      nextAction='先防守部位；可用最新完成交易日收盤作下一交易時段委託定價基準，結構風險線若可用則作第二層確認';
    }else if(fullDecision){
      state='9+3 偏支持續抱';
      reason='12 項必要證據完整且加權後偏正面';
      nextAction='續抱觀察；若結構風險線可用則用它保護部位，否則不捏造技術停損價';
    }else if(partialNegative){
      state=pnl>=0?'獲利部位｜已驗證證據偏弱':'虧損部位｜已驗證證據偏弱';
      reason='只使用目前已驗證的 9+3 證據；已驗證權重方向偏負，缺少項目維持未知，沒有補成中性或 0';
      nextAction=pnl>=0
        ?'優先保護獲利：下一合法交易時段先檢視分批減碼；若有合法即時／延遲行情，再依當時可成交價格更新委託'
        :'進入防守：下一合法交易時段優先檢視減碼；若已驗證風險事件或價格結構同步惡化，再提高退出優先順序';
    }else if(partialPositive){
      state=pnl>=0?'獲利部位｜已驗證證據偏正面':'虧損部位｜已驗證證據偏正面';
      reason='只使用目前已驗證的 9+3 證據；已驗證權重方向偏正，缺少項目維持未知';
      nextAction='續抱觀察；成本零界與可用的結構風險線作風控，沒有足夠結構資料時不另造停損價';
    }else if(hasEvidence){
      state='已驗證證據互相抵銷｜暫不新增主動動作';
      reason='目前已驗證證據的正負方向互相抵銷；缺少項目不補值';
      nextAction='先維持現有部位管理；若下一合法交易時段出現已驗證風險事件或結構風險線失守，再檢視減碼／退出';
    }else{
      state=pnl>=0?'獲利部位｜方向證據不足':'虧損部位｜方向證據不足';
      reason='持倉事實與損益可計算，但目前沒有足夠已驗證方向證據；不以舊值、缺值或 AI 補成買賣結論';
      nextAction='保留最新完成交易日收盤作下一交易時段執行定價基準；方向證據未形成前，不捏造續抱／減碼／退出判斷';
    }
    const trigger=plan.available?plan.trigger:null,pressure=plan.available?plan.pressure:null;
    const exitCondition=trigger!=null
      ?`下一合法交易時段若有效跌破 ${trigger}，進入減碼／出場檢視`
      :fullDecision&&decisionScore<=40
        ?`9+3 完整偏弱；下一交易時段先以 ${executionReference}（最新完成交易日收盤）作出場委託定價基準。這不是預測價或保證成交價；若實際開盤跳空，必須依合法可取得行情重新判斷。`
        :fullDecision&&decisionScore<60
          ?`9+3 完整偏防守；下一交易時段以 ${executionReference} 作減碼／退出定價基準，等待合法行情確認實際可成交位置。`
          :partialNegative&&pnl<0
        ?`已驗證部分證據偏弱且目前低於成本；下一交易時段先以 ${executionReference} 作減碼／退出委託定價基準。這不是保證成交價；若有合法即時行情再更新。`
        :partialNegative&&pnl>=0
          ?`已驗證部分證據偏弱但目前仍有獲利；下一交易時段可先以 ${executionReference} 作分批減碼定價基準，優先保護既有獲利。`
          :partialPositive
            ?'已驗證部分證據偏正面；目前不主動提出退出。若後續合法資料轉弱或結構風險線形成並失守，再進入退出檢視。'
            :(plan.reason||'結構風險線尚未形成；仍保留最新完成交易日收盤作執行定價基準');
    const reduceCondition=pressure!=null&&pnl>0
      ?`接近 ${pressure} 且 9+3 未同步改善時，可檢視分批停利`
      :fullDecision&&decisionScore<60&&pnl>0
        ?`已有獲利且 9+3 未偏強；下一交易時段可先以 ${executionReference} 附近作減碼定價基準，實際委託仍須看當時合法行情`
        :partialNegative&&pnl>0
        ?`已驗證部分證據偏弱且已有獲利；下一交易時段可先以 ${executionReference} 作分批減碼基準`
        :pnl>0?'已有獲利；沒有足夠結構資料時不製造數字停利目標':'目前未形成可驗證的獲利減碼價格條件';
    const confidence=weighted?.confidenceIndex??null;
    return{
      model:'TW-holding-9plus3-v6',validation:'9PLUS3_WEIGHTED_RULE_BASED',dataDate,latestClose:L.c,
      position:p,
      derived:{cost,marketValue,pnl,pnlPct,availableBars:r.length,historyLevel:r.length>=60?`${r.length} 根合法已驗證 OHLC｜結構風險線可計算`:`${r.length} 根合法已驗證 OHLC｜結構風險線資料不足，但持股分析照常`,support:trigger,resistance:pressure,tradingBarsSinceBuy:since.length,maxGainPct,maxDrawdownPct,sinceEntryHigh:sinceHigh,sinceEntryLow:sinceLow},
      decision:{
        state,reason,nextAction,executionReference,breakevenReference,riskTrigger:trigger,pressureReference:pressure,
        executionReferenceMeaning:'最新合法已驗證完成交易日收盤，只作下一交易時段委託定價基準；不是盤中即時價、預測價或保證成交價',
        breakevenMeaning:'使用者成本均價所形成的損益零界，不是市場預測價',
        riskTriggerBasis:plan.available?plan.basis:'合法價格結構不足；結構風險線維持 unavailable，但不阻擋已驗證收盤／成本形成的執行基準',
        pressureBasis:plan.available?'20日高價分布第80百分位，並由 9+3 持有判斷共同解讀':'資料不足',
        exitAction:exitCondition,exitCondition,reduceCondition,
        riskTriggerMeaning:trigger!=null?'9+3 加權後的結構化出場觸發，不是保證成交價':(plan.reason||'無法產生 9+3 出場價'),
        pressureMeaning:pressure!=null?'已驗證價格結構的停利／壓力參考，不是保證成交價':'目前資料不足以產生壓力價',
        decisionScore:weighted?.score??null,verifiedWeight,evidenceNet,decisionConfidenceIndex:confidence,
        confidenceMeaning:weighted?.confidenceMeaning||'資料不足；信心指數不補值'
      },
      ninePlus3:weighted,
      audit:{legal_source_verified:true,price_verified:true,active_risk_known:riskKnown,corporate_action_known:corporateKnown,probability_calibrated:false,imputation_used:false},
      limits:{statement:'決策信心指數只衡量 9+3 已驗證資料覆蓋與方向一致性，不是勝率、成功率或未來價格機率。統計型預測驗證屬另一模型層，不影響本頁規則式持股管理。'},
      provenance:{position:p.provenance,latestClose:'observed',pnl:'derived',executionReference:'derived_from_latest_verified_close',breakevenReference:'derived_from_user_cost',riskTrigger:trigger!=null?'derived_from_verified_price_structure':'unavailable',decisionConfidenceIndex:confidence!=null?'derived_evidence_coverage_and_consistency':'unavailable',decision:'weighted_rule'}
    };
  }
  window.StockLabHolding={analyze,positionInput,requiredBars:()=>1,priceRecommendationBars:()=>60};
})();