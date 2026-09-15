// Holding-position router. Public UI stays concise; position facts and model estimates remain separate.
// "建議出場價格" is never a stand-alone promise: holding output is condition-first and any price is only a trigger/reference.
(function(){
  const btn=document.querySelector('#holdAnalyzeBtn'),input=document.querySelector('#holdTicker'),load=document.querySelector('#holdLoad'),box=document.querySelector('#holdResult');
  if(!btn||!input||!load||!box)return;
  const MISSING='資料未取得／未通過驗證';
  const money=x=>Number(x).toLocaleString('zh-TW',{maximumFractionDigits:4});
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function positionFacts(code,name,p){
    const totalCost=Number(p?.averageCost)*Number(p?.shares),costText=Number.isFinite(totalCost)&&totalCost>0?money(totalCost):MISSING;
    return `<div class=toprow><div><h2>${esc(name?`${name}／${code}`:code)}</h2><div class=muted>已持有｜持倉管理與出場時機</div></div></div><div class=sourcegrid style="margin-top:10px"><div class=sourceitem><b>成本均價</b>${money(p.averageCost)}</div><div class=sourceitem><b>目前持有股數</b>${money(p.shares)}</div><div class=sourceitem><b>首次買入日</b>${p.buyDate?esc(p.buyDate):MISSING}</div><div class=sourceitem><b>持倉總成本</b>${costText}<br><span class=mini>由成本均價 × 目前持有股數計算</span></div></div>`;
  }
  function blockersHtml(reasons){return `<div class=source-note><b class=bad>暫不提供出場時機／觸發價格</b><div class=mini>${reasons.map(esc).join('；')}</div></div><div class=disclaimer><b>資料規則</b>持股事實可以保留，但必要資料、正式 OOS、出場執行驗證或信心校準未通過時，不輸出可執行賣出價格，也不以假資料補值。</div>`}
  function runtimeBlockers(p){
    const rt=window.STOCKLAB_RUNTIME||{},g=rt.gates||{},r=[];
    if(!p.buyDate)r.push('缺少首次買入日');
    if(g.licensedHistoricalOHLC!==true)r.push('合法歷史行情尚未完成');
    if(g.securityMaster!==true)r.push('商品分類尚未完成');
    if(g.tradingCalendar!==true)r.push('台股交易日曆尚未完成');
    if(g.corporateActions!==true)r.push('公司行動／參考價尚未完成');
    if(g.taiwanRiskState!==true)r.push('注意／處置等交易狀態尚未完成');
    if(g.holdingExitValidation!==true)r.push('持股出場模型正式 OOS 尚未通過');
    if(g.holdingExitExecutionValidation!==true)r.push('出場價格／條件 OOS 可執行性尚未通過');
    if(g.holdingConfidenceCalibration!==true)r.push('持股信心指數尚未完成樣本外校準');
    return r
  }
  function localExitReference(result){
    const d=result?.derived||{},q=result?.decision||{},state=String(q.state||'');
    if(state.includes('分批停利'))return{label:'停利觸發參考價',value:d.resistance,condition:'接近結構壓力且趨勢轉弱時，檢視分批停利'};
    if(state.includes('獲利保護'))return{label:'獲利保護觸發價',value:d.profitDefense,condition:'完成交易日收盤跌破後，下一合法交易時段重新確認減碼／出場'};
    return{label:'出場防守觸發價',value:d.defense,condition:'完成交易日收盤跌破且結構同步轉弱時，下一合法交易時段重新確認出場'};
  }
  async function localHolding(code,p,name,market){
    const blockers=runtimeBlockers(p);if(blockers.length){box.innerHTML=positionFacts(code,name,p)+blockersHtml(blockers);return}
    const loader=window.StockLabLicensedHistory;if(!loader?.load){box.innerHTML=positionFacts(code,name,p)+blockersHtml(['合法歷史行情介面尚未接入']);return}
    const bars=await loader.load({code,market,minimumBars:60,from:p.buyDate});if(!Array.isArray(bars)||bars.length<60)throw Error('合法歷史行情不足 60 根，不能建立出場結構');
    let vf;if(market==='TPEx'){const snap=await window.StockLabTPEx?.tpexSnapshot?.(),row=(snap||[]).find(x=>String(x.code)===code);vf=await window.StockLabTPEx?.verifyTpex?.(code,bars,row)}else vf=await verify(code,bars);
    if(!vf?.complete)throw Error('最新官方收盤交叉驗證未通過');
    const sf=window.StockLabTaiwan?.stockFactor?window.StockLabTaiwan.stockFactor(code):{};
    const result=window.StockLabHolding?.analyze(p,bars,{legalSource:true,priceVerified:true,activeRiskKnown:true,corporateActionKnown:true,oosStatus:'PASS',exitContextComplete:true,riskBlocked:sf?.disposition===true});
    if(!result||result.validation!=='PASS')throw Error('持股模型沒有產生通過驗證的結果');
    const ci=Number(result.confidenceIndex);if(result.confidenceCalibrated!==true||!Number.isFinite(ci)||ci<0||ci>100)throw Error('持股信心指數尚未完成正式樣本外校準');
    const d=result.derived||{},q=result.decision||{},profile=result.holdingProfile||{},ref=localExitReference(result),pnlPct=Number(d.pnlPct),pnlText=Number.isFinite(pnlPct)?`${money(d.pnl)}（${pnlPct.toFixed(2)}%）`:MISSING;
    const holdingDays=Number.isFinite(Number(profile.holdingTradingDays))?`${money(profile.holdingTradingDays)} 個交易日`:MISSING;
    box.innerHTML=positionFacts(code,name,p)+`<div class=decision-strip><div class=sourceitem><div class=hero-label>目前建議狀態</div><div class=hero-number style="font-size:24px">${esc(q.state||'持股判斷')}</div><div class=mini>${esc(q.reason||'')}</div></div><div class=sourceitem><div class=hero-label>${esc(ref.label)}</div><div class=hero-number>${Number.isFinite(Number(ref.value))?money(ref.value):MISSING}</div><div class=mini>${esc(ref.condition)}</div></div></div><div class=sourcegrid style="margin-top:8px"><div class=sourceitem><b>最新官方收盤</b>${esc(result.dataDate)}｜${money(result.latestClose)}<br><span class=mini>此欄是完成交易日收盤，不是盤中即時價</span></div><div class=sourceitem><b>依該收盤估算市值</b>${Number.isFinite(Number(d.marketValue))?money(d.marketValue):MISSING}</div><div class=sourceitem><b>依該收盤估算損益</b>${pnlText}</div><div class=sourceitem><b>已持有時間</b>${holdingDays}</div><div class=sourceitem><b>信心指數</b>${Math.round(ci)}/100<br><span class=mini>已校準；不是成交機率</span></div><div class=sourceitem><b>執行時點</b>以完成交易日收盤確認；符合條件後於下一合法交易時段重新判定</div></div><div class=source-note><b>出場判斷方式</b><div class=mini>先看條件是否成立，再看觸發參考價；不因價格碰到某一數字就自動視為必須賣出，也不把事後高低點當成可成交價格。</div></div>`;
  }
  function renderPrivate(code,p,j){
    const hp=window.StockLabHardPolicy?.backendResult?.(j,'holding');if(hp&&hp.ok!==true)throw Error(`後端持股結果未通過硬規則：${hp.blockers.join('；')}`);
    const d=j?.data||{},name=d.name||'',facts=positionFacts(code,name,p),ci=Number(d.confidence_index),cal=d.audit?.confidence_calibrated===true,lo=Number(d.exit_low),hi=Number(d.exit_high),single=Number(d.exit_price),hasRange=Number.isFinite(lo)&&Number.isFinite(hi)&&lo>0&&hi>=lo,hasSingle=Number.isFinite(single)&&single>0;
    if(d.audit?.legal_source_verified!==true||d.audit?.price_verified!==true||d.audit?.oos_validation_passed!==true)throw Error('後端持股結果缺少合法來源／價格／OOS 驗證');
    if(d.audit?.exit_execution_validated!==true)throw Error('後端出場價格／條件尚未通過 OOS 可執行性驗證');
    if(!cal||!Number.isFinite(ci)||ci<0||ci>100)throw Error('持股信心指數尚未完成正式樣本外校準');
    if(!hasRange&&!hasSingle)throw Error('後端沒有提供有效的出場觸發價格／區間');
    const exitText=hasRange?`${money(lo)}–${money(hi)}`:money(single),pnl=d.unrealized_pnl!=null?money(d.unrealized_pnl):MISSING,pct=d.unrealized_pnl_pct!=null?`${Number(d.unrealized_pnl_pct).toFixed(2)}%`:MISSING,holdingDays=d.holding_trading_days!=null?`${money(d.holding_trading_days)} 個交易日`:MISSING;
    box.innerHTML=facts+`<div class=decision-strip><div class=sourceitem><div class=hero-label>目前建議狀態</div><div class=hero-number style="font-size:24px">${esc(d.action||'持股判斷')}</div><div class=mini>${esc(d.reason||'')}</div></div><div class=sourceitem><div class=hero-label>出場觸發參考價${hasRange?'區間':''}</div><div class=hero-number>${exitText}</div><div class=mini>${esc(d.exit_condition||'依模型條件於下一合法交易時段重新確認')}</div></div></div><div class=sourcegrid style="margin-top:8px"><div class=sourceitem><b>最新已驗證價格基準</b>${esc(d.data_date||'—')}${d.close!=null?`｜${money(d.close)}`:''}</div><div class=sourceitem><b>依價格基準估算市值</b>${d.market_value!=null?money(d.market_value):MISSING}</div><div class=sourceitem><b>依價格基準估算損益</b>${pnl}｜${pct}</div><div class=sourceitem><b>已持有時間</b>${holdingDays}</div><div class=sourceitem><b>信心指數</b>${Math.round(ci)}/100<br><span class=mini>已校準；不是成交機率</span></div><div class=sourceitem><b>執行原則</b>條件優先，價格次之；完成交易日確認後於下一合法交易時段執行</div></div><div class=source-note><b>出場判斷方式</b><div class=mini>觸發參考價必須搭配趨勢、風險狀態與模型條件，不是單一固定賣價或保證成交價。</div></div>`
  }
  btn.onclick=async()=>{
    load.classList.remove('hidden');try{
      const resolver=window.StockLabTickerResolver;if(!resolver?.resolve)throw Error('股票代號／名稱解析器尚未就緒');
      const code=await resolver.resolve(input.value);input.value=code;
      const p=window.StockLabPositionInput?.collect?.();if(!p)throw Error('持股輸入模組尚未就緒');
      const u=await resolver.loadUniverse(),meta=u.find(x=>x.code===code)||{},name=meta.name||'',market=meta.market||null;
      box.innerHTML=positionFacts(code,name,p);
      const api=window.StockLabAPI;if(api?.config?.enabled){try{const j=await api.holding(code,p);renderPrivate(code,p,j);return}catch(e){if(!api.config.allowLocalFallback)throw e}}
      if(!market)throw Error('商品市場別未驗證');await localHolding(code,p,name,market);
    }catch(e){let p=null;try{p=window.StockLabPositionInput?.collect?.()}catch{}box.innerHTML=(p?positionFacts(input.value.trim(),' ',p):'')+blockersHtml([String(e.message||e)])}
    finally{load.classList.add('hidden')}
  };
})();