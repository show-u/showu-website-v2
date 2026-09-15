// TOP 10 production gate. Strategy-specific ranking only; no browser-side fallback ranking is allowed.
(function(){
  const btn=document.querySelector('#scanBtn');if(!btn)return;
  const CACHE_TTL=10*60*1000,scanCache=new Map();
  const STRATEGIES={
    momentum:{label:'短線價差',summary:'價格動能、成交結構、流動性與台股風險狀態；不以股息因子主導排名。'},
    growth:{label:'成長波段',summary:'最新月營收趨勢、獲利成長、財務品質與估值合理性；價格只做交易風險確認。'},
    income:{label:'股息收益',summary:'現金／股票股利、殖利率、股利持續性、盈餘承受力與除權息事件；不能只看表面高殖利率。'},
    total_return:{label:'長期總報酬',summary:'營收與獲利成長、財務品質、估值、現金／股票股利與股東總回報一起評估。'}
  };
  function renderCached(html){const box=document.querySelector('#top10');box.innerHTML=html;box.classList.remove('hidden')}
  function blocked(reason){renderCached(`<div class=toprow><div><h2>TOP 10</h2><div class=muted>FAIL CLOSED｜不以舊模型補排名</div></div></div><h3 class=bad>⛔ 暫不產生 TOP 10</h3><p>${reason}</p><div class=disclaimer><b>原因</b>TOP10 必須同時通過合法資料源、商品分類、日期完整性、台股風險 Gate、策略專屬因子與正式樣本外驗證。任何一項未通過就沒有排名；不拿另一個策略的排序、舊快取或缺失因子拼出十檔。</div>`)}
  function textArray(v){return Array.isArray(v)?v.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()):[]}
  function finite(v){return v!==null&&v!==''&&Number.isFinite(Number(v))}
  function dividendOK(x,strategy){
    if(!['income','total_return'].includes(strategy))return true;
    const d=x?.dividend;
    if(d?.verified!==true)return false;
    if(!d?.data_date||!(Number(d?.history_years)>=3))return false;
    if(strategy==='income'){
      const cash=finite(d.cash_dividend_per_share)?Number(d.cash_dividend_per_share):0,stock=finite(d.stock_dividend_per_share)?Number(d.stock_dividend_per_share):0;
      if(!(cash>0||stock>0))return false;
      if(!finite(d.dividend_yield_pct))return false;
    }
    return true;
  }
  function strategyAuditOK(x,strategy){
    const a=x?.factor_audit||{};
    if(strategy==='momentum')return a.technical_verified===true&&a.liquidity_verified===true;
    if(strategy==='growth')return a.monthly_revenue_verified===true&&a.quarterly_financial_verified===true;
    if(strategy==='income')return a.quarterly_financial_verified===true&&a.valuation_verified===true&&a.dividend_verified===true;
    if(strategy==='total_return')return a.monthly_revenue_verified===true&&a.quarterly_financial_verified===true&&a.valuation_verified===true&&a.dividend_verified===true;
    return false;
  }
  function validateItem(x,strategy){
    const reasons=textArray(x?.reasons),risks=textArray(x?.risks),audit=x?.audit||{};
    if(audit.legal_source_verified!==true||audit.price_verified!==true||audit.oos_validation_passed!==true||audit.active_risk_status_checked!==true)return`候選 ${x?.ticker||'—'} 未通過來源／價格／OOS／風險狀態稽核`;
    if(x?.strategy!==strategy)return`候選 ${x?.ticker||'—'} 的策略標籤與本次查詢不一致`;
    if(!strategyAuditOK(x,strategy))return`候選 ${x?.ticker||'—'} 缺少 ${STRATEGIES[strategy]?.label||strategy} 必要因子驗證`;
    if(!dividendOK(x,strategy))return`候選 ${x?.ticker||'—'} 的股利資料不足或未通過驗證`;
    if(reasons.length<2)return`候選 ${x?.ticker||'—'} 缺少可追溯的入榜理由`;
    if(!risks.length)return`候選 ${x?.ticker||'—'} 缺少主要風險說明`;
    return null;
  }
  function dividendBlock(x,strategy){
    if(!['income','total_return'].includes(strategy))return'';
    const d=x.dividend||{},cash=finite(d.cash_dividend_per_share)?fmt(Number(d.cash_dividend_per_share)):'資料未取得／未通過驗證',stock=finite(d.stock_dividend_per_share)?fmt(Number(d.stock_dividend_per_share)):'資料未取得／未通過驗證',yieldText=finite(d.dividend_yield_pct)?`${Number(d.dividend_yield_pct).toFixed(2)}%`:'資料未取得／未通過驗證',exDate=d.ex_date||'尚未公告／未取得';
    return `<div class=why><b>股利因子</b><br>現金股利 ${cash} 元／股｜股票股利 ${stock} 元／股｜殖利率 ${yieldText}<br><span class=mini>股利歷史 ${d.history_years||'—'} 年｜資料日 ${d.data_date||'—'}｜除權息日 ${exDate}</span></div>`;
  }
  function renderPrivate(j,strategy){
    const d=j?.data||{},items=Array.isArray(d.items)?d.items:[],s=STRATEGIES[strategy];
    if(!s)return blocked('未知投資策略。');
    if(j?.ok!==true||!j?.model_version||!d.data_date||d.strategy!==strategy||d.audit?.legal_source_verified!==true||d.audit?.price_verified!==true||d.audit?.oos_validation_passed!==true)return blocked('後端 TOP10 稽核缺少合法來源、價格驗證、策略標籤或正式 OOS PASS。');
    for(const x of items){const err=validateItem(x,strategy);if(err)return blocked(err)}
    if(items.length<10)return blocked(`通過全部 Gate 的股票只有 ${items.length} 檔；不以不合格股票補滿 10 檔。`);
    const html=`<div class=toprow><div><h2>${s.label}｜TOP 10</h2><div class=muted>資料日 ${d.data_date}｜模型 ${j.model_version}</div></div></div><div class=source-note><b>這次為什麼這樣選</b><div class=mini>${s.summary}</div></div><div class=list>${items.slice(0,10).map((x,i)=>{const label=x.name?`${x.name}／${x.ticker||'—'}`:(x.ticker||'—'),reasons=textArray(x.reasons).slice(0,4),risks=textArray(x.risks).slice(0,3);return `<div class=item><div class=rank>#${i+1}</div><div><b>${label}</b><div class=mini>${x.exchange||'—'}｜${x.data_date||d.data_date}｜${x.action||'研究候選'}</div><div class=why><b>入榜理由</b><br>${reasons.map(z=>`• ${z}`).join('<br>')}</div>${dividendBlock(x,strategy)}<div class=why><b>主要風險</b><br>${risks.map(z=>`• ${z}`).join('<br>')}</div></div><div class=price>${x.score??'—'}分<br><span class=mini>策略研究分數<br>不是上漲機率</span></div></div>`}).join('')}</div><div class=disclaimer><b>TOP10 使用方式</b>TOP10 只回答「哪些股票符合本投資目的、為什麼」。它不直接給買入價。選定標的後，再到「想買這檔」以最新已驗證交易日建立下一交易時段計畫。短線、成長、股息、長期總報酬是四套不同策略，不允許沿用同一排行冒充不同答案。</div>`;
    scanCache.set(`private:${strategy}`,{at:Date.now(),html});renderCached(html);
  }
  btn.onclick=async()=>{
    const strategy=document.querySelector('#scanObjective')?.value,api=window.StockLabAPI,key=`private:${strategy}`;
    if(!STRATEGIES[strategy])return blocked('請選擇有效投資目的。');
    const cached=scanCache.get(key);if(cached&&Date.now()-cached.at<CACHE_TTL){renderCached(cached.html);return;}
    document.querySelector('#scanLoad').classList.remove('hidden');
    try{
      if(!api?.config?.enabled)return blocked('正式私有分析後端尚未啟用；瀏覽器本地排名已停用，避免用未驗證模型產生假 TOP10。');
      const j=await api.scan(strategy);renderPrivate(j,strategy);
    }catch(e){blocked(`TOP10 稽核／資料取得失敗：${e.message||e}`)}
    finally{document.querySelector('#scanLoad').classList.add('hidden')}
  };
})();
