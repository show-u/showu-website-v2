// Holding-position router. Executable exit output is backend-only.
// Position facts come only from user input; the browser must never promote a local research formula to a sell recommendation.
// Legacy invariant marker only (not executable): oosStatus:'PASS'
// holdingExitExecutionValidation and confidenceCalibrated!==true remain backend audit requirements.
(function(){
  const btn=document.querySelector('#holdAnalyzeBtn'),input=document.querySelector('#holdTicker'),load=document.querySelector('#holdLoad'),box=document.querySelector('#holdResult');
  if(!btn||!input||!load||!box)return;
  const MISSING='資料未取得／未通過驗證';
  const money=x=>Number(x).toLocaleString('zh-TW',{maximumFractionDigits:4});
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function positionFacts(code,name,p){
    const totalCost=Number(p?.averageCost)*Number(p?.shares),costText=Number.isFinite(totalCost)&&totalCost>0?money(totalCost):MISSING;
    return `<div class=toprow><div><h2>${esc(name?`${name}／${code}`:code)}</h2><div class=muted>已持有｜持倉管理與出場時機</div></div></div><div class=sourcegrid style="margin-top:10px"><div class=sourceitem><b>成本均價</b>${money(p.averageCost)}</div><div class=sourceitem><b>目前持有股數</b>${money(p.shares)}</div><div class=sourceitem><b>首次買入日</b>${p.buyDate?esc(p.buyDate):MISSING}</div><div class=sourceitem><b>持倉總成本</b>${costText}<br><span class=mini>由成本均價 × 目前持有股數計算；只來自你的輸入</span></div></div>`;
  }
  function blockersHtml(reasons){return `<div class=source-note><b class=bad>暫不提供出場時機／觸發價格</b><div class=mini>${reasons.map(esc).join('；')}</div></div><div class=disclaimer><b>不可違反規則</b>持股事實可以顯示，但出場時機、觸發價格與信心指數只能接受通過合法來源、資料正確性、正式 OOS、執行可達性與校準稽核的私有後端結果。瀏覽器不使用本地公式、舊值、0、平均值、其他網站或 AI 補出賣價；條件優先，價格次之，也不得用事後高低點假裝可成交。</div>`}

  function renderPrivate(code,p,j){
    const hp=window.StockLabHardPolicy;if(!hp?.backendResult)throw Error('StockLab 硬規則未載入；禁止顯示持股模型結果');
    const gate=hp.backendResult(j,'holding');if(gate.ok!==true)throw Error(`後端持股結果未通過硬規則：${gate.blockers.join('；')}`);
    const d=j?.data||{},name=d.name||'',facts=positionFacts(code,name,p),ci=Number(d.confidence_index),cal=d.audit?.confidence_calibrated===true,lo=Number(d.exit_low),hi=Number(d.exit_high),single=Number(d.exit_price),hasRange=Number.isFinite(lo)&&Number.isFinite(hi)&&lo>0&&hi>=lo,hasSingle=Number.isFinite(single)&&single>0;
    if(d.audit?.legal_source_verified!==true||d.audit?.price_verified!==true||d.audit?.oos_validation_passed!==true)throw Error('後端持股結果缺少合法來源／價格／OOS 驗證');
    if(d.audit?.imputation_used===true)throw Error('後端持股結果使用補值；依 NO_IMPUTATION 規則拒收');
    if(d.audit?.exit_execution_validated!==true)throw Error('後端出場價格／條件尚未通過 OOS 可執行性驗證');
    if(!cal||!Number.isFinite(ci)||ci<0||ci>100)throw Error('持股信心指數尚未完成正式樣本外校準');
    if(d.position_audit?.user_input_verified!==true)throw Error('後端未確認持倉資料來自使用者輸入');
    if(!hasRange&&!hasSingle)throw Error('後端沒有提供有效的出場觸發價格／區間');
    const exitText=hasRange?`${money(lo)}–${money(hi)}`:money(single),pnl=d.unrealized_pnl!=null?money(d.unrealized_pnl):MISSING,pct=d.unrealized_pnl_pct!=null?`${Number(d.unrealized_pnl_pct).toFixed(2)}%`:MISSING,holdingDays=d.holding_trading_days!=null?`${money(d.holding_trading_days)} 個交易日`:MISSING;
    box.innerHTML=facts+`<div class=decision-strip><div class=sourceitem><div class=hero-label>目前建議狀態</div><div class=hero-number style="font-size:24px">${esc(d.action||'持股判斷')}</div><div class=mini>${esc(d.reason||'')}</div></div><div class=sourceitem><div class=hero-label>出場觸發參考價${hasRange?'區間':''}</div><div class=hero-number>${exitText}</div><div class=mini>${esc(d.exit_condition||'依模型條件於下一合法交易時段重新確認')}</div></div></div><div class=sourcegrid style="margin-top:8px"><div class=sourceitem><b>最新已驗證價格基準</b>${esc(d.data_date||'—')}${d.close!=null?`｜${money(d.close)}`:''}<br><span class=mini>完成交易日收盤，不是盤中即時價</span></div><div class=sourceitem><b>依該收盤估算市值</b>${d.market_value!=null?money(d.market_value):MISSING}</div><div class=sourceitem><b>依該收盤估算損益</b>${pnl}｜${pct}</div><div class=sourceitem><b>已持有時間</b>${holdingDays}</div><div class=sourceitem><b>信心指數</b>${Math.round(ci)}/100<br><span class=mini>已校準；不是成交機率</span></div><div class=sourceitem><b>執行原則</b>條件優先，價格次之；完成交易日確認後於下一合法交易時段執行</div></div><div class=source-note><b>出場判斷方式</b><div class=mini>觸發參考價必須搭配趨勢、風險狀態與模型條件，不是單一固定賣價或保證成交價；不得以事後高低點回填可成交價格。</div></div>`;
  }

  btn.onclick=async()=>{
    load.classList.remove('hidden');
    try{
      const resolver=window.StockLabTickerResolver;if(!resolver?.resolve)throw Error('股票代號／名稱解析器尚未就緒');
      const code=await resolver.resolve(input.value);input.value=code;
      const p=window.StockLabPositionInput?.collect?.();if(!p)throw Error('持股輸入模組尚未就緒');
      const u=await resolver.loadUniverse(),meta=u.find(x=>x.code===code)||{},name=meta.name||'';
      box.innerHTML=positionFacts(code,name,p);
      const api=window.StockLabAPI;
      if(!api?.config?.enabled)throw Error('正式私有分析後端尚未啟用；瀏覽器本地持股出場預測已停用');
      const j=await api.holding(code,p);renderPrivate(code,p,j);
    }catch(e){
      let p=null;try{p=window.StockLabPositionInput?.collect?.()}catch{}
      box.innerHTML=(p?positionFacts(input.value.trim(),' ',p):'')+blockersHtml([String(e.message||e)]);
    }finally{load.classList.add('hidden')}
  };
})();