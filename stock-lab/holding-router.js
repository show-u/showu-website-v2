// Holding-position router. User position facts are always kept separate from market facts and model estimates.
(function(){
  const btn=document.querySelector('#holdAnalyzeBtn'),input=document.querySelector('#holdTicker'),load=document.querySelector('#holdLoad'),box=document.querySelector('#holdResult');
  if(!btn||!input||!load||!box)return;
  const MISSING='資料未取得／未通過驗證';
  const money=x=>Number(x).toLocaleString('zh-TW',{maximumFractionDigits:4});
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function positionFacts(code,name,p){
    const inputCost=p.averageCost*p.shares;
    return `<div class=toprow><div><h2>${esc(name?`${name}／${code}`:code)}</h2><div class=muted>已持有｜部位管理與出場條件</div></div></div><h3>你的持股事實</h3><div class=sourcegrid><div class=sourceitem><b>成本均價｜user_observed</b>${money(p.averageCost)}</div><div class=sourceitem><b>目前持有股數｜user_observed</b>${money(p.shares)}</div><div class=sourceitem><b>首次買入日｜${p.buyDate?'user_observed':'unavailable'}</b>${p.buyDate||MISSING}</div><div class=sourceitem><b>輸入成本合計｜derived</b>${money(inputCost)}</div></div>`;
  }
  function blockersHtml(reasons){return `<div class=source-note><b class=bad>⛔ 正式出場判斷目前被阻擋</b><div class=mini>${reasons.map(esc).join('<br>')}</div></div><div class=disclaimer><b>NO IMPUTATION</b>以上缺口不會用舊價格、推估日期、其他網站、0、平均值或 AI 補齊。部位事實可以保留，但在必要 Gate 通過前不輸出可執行賣出建議。</div>`}
  function runtimeBlockers(p){const rt=window.STOCKLAB_RUNTIME||{},g=rt.gates||{},r=[];if(!p.buyDate)r.push('缺少首次買入日：無法以實際交易日計算持有期間');if(g.licensedHistoricalOHLC!==true)r.push('合法且足夠長的歷史 OHLC Gate 未通過');if(g.securityMaster!==true)r.push('商品分類 Gate 未通過');if(g.tradingCalendar!==true)r.push('台股交易日曆 Gate 未通過');if(g.corporateActions!==true)r.push('公司行動／參考價 Gate 未通過');if(g.taiwanRiskState!==true)r.push('注意／處置／特殊交易狀態 Gate 未通過');if(g.holdingExitValidation!==true)r.push('持股出場模型正式 OOS Gate 未通過');return r}
  async function localHolding(code,p,name,market){
    const blockers=runtimeBlockers(p);if(blockers.length){box.innerHTML=positionFacts(code,name,p)+blockersHtml(blockers);return}
    const loader=window.StockLabLicensedHistory;if(!loader?.load){box.innerHTML=positionFacts(code,name,p)+blockersHtml(['合法歷史行情介面尚未接入']);return}
    const bars=await loader.load({code,market,minimumBars:60,from:p.buyDate});if(!Array.isArray(bars)||bars.length<60)throw Error('合法歷史行情不足 60 根，不能建立持股出場結構');
    let vf;if(market==='TPEx'){const snap=await window.StockLabTPEx?.tpexSnapshot?.(),row=(snap||[]).find(x=>String(x.code)===code);vf=await window.StockLabTPEx?.verifyTpex?.(code,bars,row)}else vf=await verify(code,bars);
    if(!vf?.complete)throw Error('最新官方收盤交叉驗證未通過');
    const sf=window.StockLabTaiwan?.stockFactor?window.StockLabTaiwan.stockFactor(code):{};
    const result=window.StockLabHolding?.analyze(p,bars,{legalSource:true,priceVerified:true,activeRiskKnown:true,corporateActionKnown:true,oosStatus:'PASS',exitContextComplete:true,riskBlocked:sf?.disposition===true});
    if(!result||result.validation!=='PASS')throw Error('持股模型沒有產生通過驗證的結果');
    const d=result.derived||{},q=result.decision||{};
    box.innerHTML=positionFacts(code,name,p)+`<h3>最新已驗證市場事實</h3><div class=sourcegrid><div class=sourceitem><b>資料交易日｜observed</b>${esc(result.dataDate)}</div><div class=sourceitem><b>最新官方收盤｜observed</b>${money(result.latestClose)}</div><div class=sourceitem><b>實際持有交易日｜derived</b>${result.holdingProfile.holdingTradingDays}</div><div class=sourceitem><b>未實現損益｜derived</b>${money(d.pnl)}（${Number(d.pnlPct).toFixed(2)}%）</div></div><h3>持股結構</h3><div class=sourcegrid><div class=sourceitem><b>結構防守線｜derived</b>${money(d.defense)}</div><div class=sourceitem><b>獲利保護線｜derived</b>${money(d.profitDefense)}</div><div class=sourceitem><b>結構壓力｜derived</b>${money(d.resistance)}</div><div class=sourceitem><b>買入後峰值回撤｜derived</b>${Number(d.drawdownFromPeak).toFixed(2)}%</div></div><div class=source-note><b>${esc(q.state)}｜model_estimate</b><div class=mini>${esc(q.reason)}<br>${esc(q.exitTrigger)}<br>${esc(q.profitReview)}</div></div><div class=disclaimer><b>執行時間</b>使用完成交易日資料形成的訊號，最早只能在下一個合法可交易時段重新確認／執行；沒有合法盤中行情時，不會聲稱「現在立刻賣在某價」。</div>`;
  }
  function renderPrivate(code,p,j){const hp=window.StockLabHardPolicy?.backendResult?.(j,'holding');if(hp&&hp.ok!==true)throw Error(`後端持股結果未通過硬規則：${hp.blockers.join('；')}`);const d=j?.data||{},name=d.name||'',facts=positionFacts(code,name,p);if(d.audit?.legal_source_verified!==true||d.audit?.price_verified!==true||d.audit?.oos_validation_passed!==true)throw Error('後端持股結果缺少合法來源／價格／OOS 驗證');box.innerHTML=facts+`<div class=source-note><b>${esc(d.action||'持股狀態')}｜model_estimate</b><div class=mini>資料日 ${esc(d.data_date||'—')}｜模型 ${esc(j.model_version||'—')}<br>${esc(d.reason||'')}</div></div>`}
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