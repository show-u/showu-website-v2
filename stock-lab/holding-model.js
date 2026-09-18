// Existing-position management is separate from buy-entry analysis.
// OOS status controls only statistical claims (confidence/win-rate), not deterministic holding-risk rules.
(function(){
  function num(v){if(v==null)return null;const x=Number(String(v).replace(/,/g,''));return Number.isFinite(x)?x:null}
  function avg(a){const v=a.filter(Number.isFinite);return v.length?v.reduce((x,y)=>x+y,0)/v.length:null}
  function qtile(a,q){const v=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!v.length)return null;const p=(v.length-1)*q,l=Math.floor(p),h=Math.ceil(p);return l===h?v[l]:v[l]+(v[h]-v[l])*(p-l)}
  function tickSize(p){if(p<10)return .01;if(p<50)return .05;if(p<100)return .1;if(p<500)return .5;if(p<1000)return 1;return 5}
  function roundTick(p,mode='nearest'){if(!Number.isFinite(p))return null;const t=tickSize(Math.max(.01,p)),q=p/t,z=mode==='up'?Math.ceil(q):mode==='down'?Math.floor(q):Math.round(q);return +(z*t).toFixed(t<.1?2:t<1?1:0)}
  function dateMs(v){if(!v)return null;const d=new Date(`${v}T00:00:00+08:00`);return Number.isNaN(d.getTime())?null:d.getTime()}
  function barDate(x){return x?.iso||x?.date||null}
  function positionInput(x){const averageCost=num(x?.averageCost),shares=num(x?.shares),buyTime=String(x?.buyTime||'').trim(),buyDate=buyTime.slice(0,10);if(!(averageCost>0))throw Error('成本均價必須大於 0');if(!(shares>0))throw Error('持有股數必須大於 0');if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(buyTime)||dateMs(buyDate)==null)throw Error('首次買入時間必須由使用者輸入有效日期時間');const totalCost=averageCost*shares;return{averageCost,shares,totalCost,buyTime,buyDate,lots:Array.isArray(x?.lots)?x.lots:null,provenance:x?.provenance||{averageCost:'user_observed',shares:'user_observed',totalCost:'derived_from_user_position',buyTime:'user_observed'}}}
  function normalizeBars(bars){return (Array.isArray(bars)?bars:[]).filter(x=>Number.isFinite(Number(x?.c))&&Number(x.c)>0).map(x=>({...x,c:Number(x.c),o:num(x.o),h:num(x.h),l:num(x.l)})).sort((a,b)=>String(barDate(a)).localeCompare(String(barDate(b))))}
  function analyze(input,bars,ctx={}){
    const p=positionInput(input),r=normalizeBars(bars);if(!r.length)throw Error('沒有可用的已驗證收盤資料');if(ctx.legalSource!==true)throw Error('行情來源授權未通過');if(ctx.priceVerified!==true)throw Error('最新收盤尚未通過驗證');
    const L=r.at(-1),dataDate=barDate(L);if(!dataDate)throw Error('最新交易日缺漏');
    const cost=p.totalCost,marketValue=L.c*p.shares,pnl=marketValue-cost,pnlPct=cost?100*pnl/cost:null;
    const usable=r.slice(-Math.min(20,r.length)),lows=usable.map(x=>x.l).filter(Number.isFinite),highs=usable.map(x=>x.h).filter(Number.isFinite),closes=usable.map(x=>x.c).filter(Number.isFinite);
    // One verified close is sufficient for factual P/L, but never sufficient to invent price structure.
    // Support/resistance and price triggers require a real 20-session structure; MA5/MA20 require their full windows.
    const structureKnown=r.length>=20&&lows.length>=20&&highs.length>=20;
    const latestLow=Number.isFinite(L.l)?L.l:null,latestHigh=Number.isFinite(L.h)?L.h:null;
    const support=structureKnown?qtile(lows,.20):latestLow,resistance=structureKnown?qtile(highs,.80):latestHigh,ma5=closes.length>=5?avg(closes.slice(-5)):null,ma20=closes.length>=20?avg(closes.slice(-20)):null;
    const trendKnown=ma5!=null&&ma20!=null,trendUp=trendKnown&&L.c>=ma5&&ma5>=ma20,trendWeak=trendKnown&&L.c<ma5&&ma5<ma20;
    const riskBlocked=ctx.riskBlocked===true,riskKnown=ctx.activeRiskKnown===true,corporateKnown=ctx.corporateActionKnown===true;
    let state,reason,nextAction;
    if(riskBlocked){state='風險事件優先';reason='已驗證的特殊交易／處置風險優先於一般技術條件';nextAction='下一合法交易時段先檢視減碼或退出可行性';}
    else if(pnl<0&&trendWeak){state='虧損且結構轉弱';reason='目前低於成本，且可用的已驗證價格結構偏弱';nextAction='不加碼；下一完成交易日若再跌破風險觸發線，進入減碼／出場檢視';}
    else if(pnl>0&&trendWeak){state='獲利保護';reason='仍有未實現獲利，但可用價格結構轉弱';nextAction='保護既有獲利；下一完成交易日若跌破風險觸發線，檢視分批減碼';}
    else if(pnl>0&&trendUp){state='續抱條件仍成立';reason='目前有未實現獲利，且可用價格結構尚未轉弱';nextAction='續抱觀察；接近壓力參考時再檢視分批停利';}
    else if(pnl<0){state='虧損部位防守';reason='目前低於成本；若多日結構不足，先使用上一完成交易日低點作最低限度的已驗證防守觸發';nextAction='不因猜測價格加碼；若下一合法交易時段有效跌破出場觸發價，進入減碼／出場檢視';}
    else if(pnl>0){state='獲利中；多日結構不足';reason='目前高於部位總成本；多日結構不足時，不虛構支撐，而以上一完成交易日低點作最小可用的獲利保護觸發';nextAction='續抱但設定防守；若下一合法交易時段有效跌破出場觸發價，檢視分批減碼／出場';}
    else{state='損益持平';reason='目前市值接近部位總成本；多日結構不足時，以上一完成交易日低點作最小可用防守觸發';nextAction='不預測方向；若下一合法交易時段有效跌破出場觸發價，進入減碼／出場檢視';}
    const trigger=support!=null?roundTick(support,'down'):null,pressure=resistance!=null?roundTick(resistance,'up'):null;
    const exitCondition=trigger!=null?`下一完成交易日若收盤跌破 ${trigger}，進入減碼／出場檢視`:trendWeak?'已驗證趨勢轉弱，但缺少完整20日結構，暫無可驗證數字出場價':'尚無足夠已驗證20日價格結構，不能產生數字出場價';
    const reduceCondition=pressure!=null&&pnl>0?`接近 ${pressure} 且無法有效突破時，可檢視分批減碼／停利`:pnl>0?'目前有獲利，但壓力結構資料不足，暫無可驗證數字減碼價':'目前未形成可驗證的獲利減碼價格條件';
    const triggerBasis=structureKnown?'最近20個已驗證交易日低價分布第20百分位':'上一完成交易日低點';
    const pressureBasis=structureKnown?'最近20個已驗證交易日高價分布第80百分位':'上一完成交易日高點';
    const historyLevel=r.length>=20?'20日結構':r.length>=2?`近 ${r.length} 個已驗證交易日；結構不足20日，價格觸發先採上一完成交易日高低點`:'單一完成交易日；價格觸發採上一完成交易日高低點';
    return{
      model:'TW-holding-rule-v3',validation:'RULE_BASED',dataDate,latestClose:L.c,
      position:p,derived:{cost,marketValue,pnl,pnlPct,availableBars:r.length,historyLevel,ma5,ma20,support:trigger,resistance:pressure},
      decision:{state,reason,nextAction,riskTrigger:trigger,pressureReference:pressure,riskTriggerBasis:triggerBasis,pressureBasis,exitAction:trigger!=null?`下一合法交易時段若有效跌破 ${trigger}，進入減碼／出場執行檢視`:'目前無法形成價格型出場觸發',riskTriggerMeaning:trigger!=null?`${triggerBasis}；作為規則式出場觸發，不是保證成交價`:'目前資料不足以產生價格型防守線',pressureMeaning:pressure!=null?`${pressureBasis}；作為停利／壓力參考，不是保證成交價`:'目前資料不足以產生壓力價'},
      audit:{legal_source_verified:true,price_verified:true,active_risk_known:riskKnown,corporate_action_known:corporateKnown,oos_status:ctx.oosStatus||'NOT_REQUIRED_FOR_RULE_BASED_OUTPUT',confidence_calibrated:false,imputation_used:false},
      limits:{statement:'OOS 未通過時仍可顯示由已驗證事實直接推導的持倉風險規則；不得顯示勝率、成功率、機率或校準信心指數。'},
      provenance:{position:p.provenance,latestClose:'observed',pnl:'derived',support:trigger!=null?'derived_from_verified_bars':'unavailable',resistance:pressure!=null?'derived_from_verified_bars':'unavailable',decision:'deterministic_rule'}
    };
  }
  window.StockLabHolding={analyze,positionInput,requiredBars:()=>1};
})();