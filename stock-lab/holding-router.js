// Holding-position router. Position facts come only from user input.
// Public fallback may show verified holding facts and P/L, but never fabricates an exit recommendation.
(function(){
  const btn=document.querySelector('#holdAnalyzeBtn'),input=document.querySelector('#holdTicker'),load=document.querySelector('#holdLoad'),box=document.querySelector('#holdResult');
  if(!btn||!input||!load||!box)return;
  const MISSING='資料未取得／未通過驗證';
  const money=x=>Number(x).toLocaleString('zh-TW',{maximumFractionDigits:4});
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>{const x=Number(String(v??'').replace(/,/g,''));return Number.isFinite(x)?x:null};
  const ageDays=iso=>{const d=new Date(iso);return Number.isNaN(d.getTime())?999:Math.floor((Date.now()-d.getTime())/86400000)};

  function positionFacts(code,name,p){
    const totalCost=Number(p?.averageCost)*Number(p?.shares),costText=Number.isFinite(totalCost)&&totalCost>0?money(totalCost):MISSING;
    return `<div class=toprow><div><h2>${esc(name?`${name}／${code}`:code)}</h2><div class=muted>已持有｜持倉管理與出場時機</div></div></div><div class=sourcegrid style="margin-top:10px"><div class=sourceitem><b>成本均價</b>${money(p.averageCost)}</div><div class=sourceitem><b>目前持有股數</b>${money(p.shares)}</div><div class=sourceitem><b>首次買入日</b>${p.buyDate?esc(p.buyDate):MISSING}</div><div class=sourceitem><b>持倉總成本</b>${costText}<br><span class=mini>由成本均價 × 目前持有股數計算；只來自你的輸入</span></div></div>`;
  }
  function blockersHtml(reasons){return `<div class=source-note><b class=bad>正式出場時機／觸發價格尚未解鎖</b><div class=mini>${reasons.map(esc).join('；')}</div></div><div class=disclaimer><b>不可違反規則</b>未取得、過期、授權不明或未通過驗證的市場資料一律維持未知；不得用 0、舊值、平均值、其他網站或 AI 補出賣價。持股事實與已驗證損益可以顯示，但可執行出場價格必須另外通過合法歷史資料、正式 OOS、可達性與信心校準。</div>`}

  async function loadPublicSnapshot(code,market){
    const r=await fetch('./browser-data.json',{cache:'no-store'});if(!r.ok)throw Error('合法公開資料快照讀取失敗');
    const x=await r.json();
    if(x.schema_version!==2||x.source!=='licensed-open-data-cache'||!String(x.licence||'').includes('OGDL'))throw Error('公開資料快照授權／版本未通過');
    if(!x.generated_at||ageDays(x.generated_at)>4)throw Error('公開資料快照過期');
    const ds=x.datasets||{};
    if(market==='TWSE'){
      const row=(ds.twse_snapshot||[]).find(z=>String(z.Code||'').trim()===code);if(!row)throw Error('TWSE 最新收盤資料未取得');
      const close=n(row.ClosingPrice),date=String(row.Date||row.date||x.data_date||'').trim();if(!(close>0))throw Error('TWSE 收盤價格式未通過');
      return{close,date:date||null,source:'TWSE OpenAPI／政府資料開放授權資料',licence:'OGDL-1.0'};
    }
    if(market==='TPEx'){
      const row=(ds.tpex_snapshot||[]).find(z=>String(z.SecuritiesCompanyCode||z.Code||'').trim()===code);if(!row)throw Error('TPEx 最新收盤資料未取得');
      const close=n(row.Close??row.ClosingPrice),date=String(row.Date||row.date||x.data_date||'').trim();if(!(close>0))throw Error('TPEx 收盤價格式未通過');
      return{close,date:date||null,source:'TPEx OpenAPI／政府資料開放授權資料',licence:'OGDL-1.0'};
    }
    throw Error('市場別未驗證');
  }

  function publicFacts(code,name,market,p,snap,extraBlockers=[]){
    const cost=Number(p.averageCost)*Number(p.shares),value=snap.close*Number(p.shares),pnl=value-cost,pct=cost>0?pnl/cost*100:null;
    const buy=p.buyDate?new Date(`${p.buyDate}T00:00:00+08:00`):null,days=buy&&!Number.isNaN(buy.getTime())?Math.max(0,Math.floor((Date.now()-buy.getTime())/86400000)):null;
    const pnlText=Number.isFinite(pnl)?`${pnl>=0?'+':''}${money(pnl)}`:MISSING,pctText=Number.isFinite(pct)?`${pct>=0?'+':''}${pct.toFixed(2)}%`:MISSING;
    const blockers=[...extraBlockers,'目前正式私有出場模型尚未啟用；本頁先提供可驗證的持股事實與損益，不以本地公式假造續抱／減碼／賣出價格'];
    box.innerHTML=positionFacts(code,name,p)+`<div class=source-note><b>可立即使用的持股事實</b><div class=mini>以下只使用你的部位輸入與已通過授權 Gate 的最新完成交易日收盤；不是盤中即時價，也不是出場預測。</div></div><div class=sourcegrid style="margin-top:8px"><div class=sourceitem><b>最新已驗證收盤</b>${money(snap.close)}${snap.date?`｜${esc(snap.date)}`:''}<br><span class=mini>${esc(snap.source)}｜${esc(snap.licence)}</span></div><div class=sourceitem><b>依該收盤估算市值</b>${money(value)}</div><div class=sourceitem><b>未實現損益</b>${pnlText}｜${pctText}<br><span class=mini>未計你未輸入的手續費、交易稅、股利與已實現損益</span></div><div class=sourceitem><b>自首次買入起</b>${days==null?MISSING:`${days} 個曆日`}<br><span class=mini>正式模型會改用已驗證交易日數；沒有買入日或合法交易日曆時不推測</span></div></div>`+blockersHtml(blockers);
  }

  async function sessionAudit(d){const resolver=window.StockLabSessionContext;if(!resolver?.resolve)throw Error('交易日曆／交易時段驗證層尚未就緒');const base=d.base_session_date||d.data_date,target=d.next_eligible_session_date,market=d.exchange;const s=await resolver.resolve({market,dataDate:base});if(s.verified!==true)throw Error(`出場交易日未通過：${s.label||s.state||'UNKNOWN'}`);if(!s.targetDate)throw Error('下一合法交易日尚未驗證');if(String(target)!==String(s.targetDate))throw Error(`後端下一合法交易日 ${target||'—'} 與已驗證交易日曆 ${s.targetDate} 不一致`);return s}

  async function renderPrivate(code,p,j){
    const hp=window.StockLabHardPolicy;if(!hp?.backendResult)throw Error('StockLab 硬規則未載入；禁止顯示持股模型結果');
    const gate=hp.backendResult(j,'holding');if(gate.ok!==true)throw Error(`後端持股結果未通過硬規則：${gate.blockers.join('；')}`);
    const d=j?.data||{},name=d.name||'',facts=positionFacts(code,name,p),ci=Number(d.confidence_index),cal=d.audit?.confidence_calibrated===true,lo=Number(d.exit_low),hi=Number(d.exit_high),single=Number(d.exit_price),hasRange=Number.isFinite(lo)&&Number.isFinite(hi)&&lo>0&&hi>=lo,hasSingle=Number.isFinite(single)&&single>0;
    if(d.audit?.legal_source_verified!==true||d.audit?.price_verified!==true||d.audit?.oos_validation_passed!==true)throw Error('後端持股結果缺少合法來源／價格／OOS 驗證');
    if(d.audit?.imputation_used===true)throw Error('後端持股結果使用補值；依 NO_IMPUTATION 規則拒收');
    if(d.audit?.exit_execution_validated!==true)throw Error('後端出場價格／條件尚未通過 OOS 可執行性驗證');
    if(!cal||!Number.isFinite(ci)||ci<0||ci>100)throw Error('持股信心指數尚未完成正式樣本外校準');
    if(d.position_audit?.user_input_verified!==true||d.position_audit?.average_cost_verified!==true||d.position_audit?.shares_verified!==true||d.position_audit?.buy_date_verified!==true)throw Error('後端未逐項確認持倉資料來自有效使用者輸入');
    if(!hasRange&&!hasSingle)throw Error('後端沒有提供有效的出場觸發價格／區間');
    const session=await sessionAudit(d),exitText=hasRange?`${money(lo)}–${money(hi)}`:money(single),pnl=d.unrealized_pnl!=null?money(d.unrealized_pnl):MISSING,pct=d.unrealized_pnl_pct!=null?`${Number(d.unrealized_pnl_pct).toFixed(2)}%`:MISSING,holdingDays=d.holding_trading_days!=null?`${money(d.holding_trading_days)} 個交易日`:MISSING;
    box.innerHTML=facts+`<div class=source-note><b>下一合法執行時段</b><div class=mini>${esc(session.label)}｜模型出場條件僅能在 ${esc(d.next_eligible_session_date)} 的合法交易時段重新確認／執行。</div></div><div class=decision-strip><div class=sourceitem><div class=hero-label>目前建議狀態</div><div class=hero-number style="font-size:24px">${esc(d.action||'持股判斷')}</div><div class=mini>${esc(d.reason||'')}</div></div><div class=sourceitem><div class=hero-label>出場觸發參考價${hasRange?'區間':''}</div><div class=hero-number>${exitText}</div><div class=mini>${esc(d.exit_condition||'依模型條件於下一合法交易時段重新確認')}</div></div></div><div class=sourcegrid style="margin-top:8px"><div class=sourceitem><b>最新已驗證價格基準</b>${esc(d.data_date||'—')}${d.close!=null?`｜${money(d.close)}`:''}</div><div class=sourceitem><b>依該收盤估算市值</b>${d.market_value!=null?money(d.market_value):MISSING}</div><div class=sourceitem><b>依該收盤估算損益</b>${pnl}｜${pct}</div><div class=sourceitem><b>已持有時間</b>${holdingDays}</div><div class=sourceitem><b>信心指數</b>${Math.round(ci)}/100<br><span class=mini>已校準；不是成交機率</span></div><div class=sourceitem><b>執行原則</b>條件優先，價格次之；完成交易日確認後於下一合法交易時段執行</div></div>`;
  }

  btn.onclick=async()=>{load.classList.remove('hidden');try{const resolver=window.StockLabTickerResolver;if(!resolver?.resolve)throw Error('股票代號／名稱解析器尚未就緒');const code=await resolver.resolve(input.value);input.value=code;const p=window.StockLabPositionInput?.collect?.({allowMissingDate:true});if(!p)throw Error('持股輸入模組尚未就緒');const u=await resolver.loadUniverse(),meta=u.find(x=>x.code===code)||{},name=meta.name||'',market=meta.market;if(!market)throw Error('股票市場別未能由合法名稱索引驗證');const api=window.StockLabAPI;if(api?.config?.enabled&&p.positionComplete===true){const j=await api.holding(code,p);await renderPrivate(code,p,j);return}const snap=await loadPublicSnapshot(code,market);const reasons=[];if(p.positionComplete!==true)reasons.push('首次買入日未輸入／未通過格式驗證：只能計算已知持股事實與損益，不能推測持有期或出場時機');publicFacts(code,name,market,p,snap,reasons)}catch(e){let p=null;try{p=window.StockLabPositionInput?.collect?.({allowMissingDate:true})}catch{}box.innerHTML=(p?positionFacts(input.value.trim(),' ',p):'')+blockersHtml([String(e.message||e)])}finally{load.classList.add('hidden')}};
})();