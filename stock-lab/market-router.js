// Single-stock entry router.
// Executable numeric entry output is backend-only. The browser never maintains a second production formula.
// Compatibility invariant: 「建議進場區間」 is now date-scoped as 今日原始／盤前進場區間 or 下一交易日進場區間.
(function(){
  const btn=document.querySelector('#analyzeBtn'),input=document.querySelector('#ticker'),load=document.querySelector('#singleLoad'),box=document.querySelector('#result');
  if(!btn||!input||!load||!box)return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const money=x=>Number(x).toLocaleString('zh-TW',{maximumFractionDigits:2});
  function blocked(msg){box.innerHTML=`<div class=toprow><div><h2>${esc(input.value.trim()||'單股分析')}</h2><div class=muted>想買這檔</div></div></div><div class=source-note><b class=bad>暫不提供進場價格</b><div class=mini>${esc(msg)}</div></div><div class=disclaimer><b>資料規則</b>正式私有模型、合法資料、資料基準日、目標交易日、OOS 可執行性與信心校準未全部通過時，不以瀏覽器公式、舊值、0、平均值、其他網站或 AI 推估補出進場價格。</div>`;box.classList.remove('hidden')}
  async function sessionAudit(d){
    const resolver=window.StockLabSessionContext;
    if(!resolver?.resolve)throw Error('交易日曆／交易時段驗證層尚未就緒');
    const base=d.base_session_date||d.data_date,market=d.exchange,target=d.target_session_date;
    const s=await resolver.resolve({market,dataDate:base});
    if(s.verified!==true)throw Error(`交易日／資料截點未通過：${s.label||s.state||'UNKNOWN'}`);
    if(s.displayNumericPlan!==true||!s.targetDate)throw Error(s.label||'目前沒有可顯示的有效目標交易日計畫');
    if(String(target)!==String(s.targetDate))throw Error(`後端目標交易日 ${target||'—'} 與已驗證交易日曆 ${s.targetDate} 不一致`);
    return s;
  }
  function planPresentation(s){
    const target=s.targetDate,now=s.now||{},today=now.date;
    if(target===today){
      if(s.state==='TODAY_PREOPEN_ACTIVE')return{title:`今日 ${target} 入場計畫`,note:'08:30–09:00 盤前階段；此計畫對應目標交易日，不是盤中即時報價。'};
      if(s.state==='TODAY_PLAN_BEFORE_ORDERS')return{title:`今日 ${target} 入場計畫`,note:'尚未到盤前委託時段；08:30 起才進入盤前委託階段。'};
      return{title:`今日 ${target} 原始入場計畫`,note:'09:00 後沒有合法即時／延遲行情授權時不重算當日價格；保留收盤後建立的原始計畫供核對。'};
    }
    return{title:`下一交易日 ${target} 入場計畫`,note:`基準 ${s.baseDate} 的完成交易日資料已通過驗證；僅適用 ${target}。`};
  }
  async function renderPrivate(j){
    const hp=window.StockLabHardPolicy;if(!hp?.backendResult)throw Error('StockLab 硬規則未載入；禁止顯示模型結果');
    const gate=hp.backendResult(j,'analysis');if(gate.ok!==true)throw Error(`後端結果未通過硬規則：${gate.blockers.join('；')}`);
    const d=j.data||{},session=await sessionAudit(d),presentation=planPresentation(session),lo=Number(d.entry_low),hi=Number(d.entry_high),ci=Number(d.confidence_index),label=d.name?`${d.name}／${d.ticker||'—'}`:(d.ticker||'—'),base=d.base_session_date||d.data_date,target=d.target_session_date,risks=Array.isArray(d.risks)?d.risks.filter(Boolean):[],reasons=Array.isArray(d.reasons)?d.reasons.filter(Boolean):[];
    box.innerHTML=`<div class=toprow><div><h2>${esc(label)}</h2><div class=muted>${esc(d.exchange||'—')}｜${esc(presentation.title)}</div><div class=mini>資料基準 ${esc(base)}${d.close!=null?`｜基準收盤 ${money(d.close)}`:''}</div></div></div><div class=source-note><b>交易日／資料截點</b><div class=mini>${esc(session.label)}<br>${esc(presentation.note)}</div></div><div class=decision-strip><div class=sourceitem><div class=hero-label>${target===session.now?.date?'今日原始／盤前進場區間':'下一交易日進場區間'}</div><div class=hero-number>${money(lo)}–${money(hi)}</div><div class=mini>只適用 ${esc(target)}；不是現在成交價，也不是保證可成交價</div></div><div class=sourceitem><div class=hero-label>信心指數</div><div class=hero-number>${Math.round(ci)}</div><div class=mini>/100｜已完成樣本外校準；不是上漲機率</div></div></div><div class=source-note><b>${esc(d.action||'入場判斷')}</b><div class=mini>${d.reason?esc(d.reason):reasons.slice(0,2).map(esc).join('；')}${risks.length?`<br>主要風險：${risks.slice(0,2).map(esc).join('；')}`:''}</div></div><div class=disclaimer><b>價格性質</b>此區間只能來自與正式 OOS 驗證完全相同的 production formula。若資料日期、交易日曆、來源授權、風險狀態或必要輸入有任何缺口，整筆結果會被拒收；13:30 後也必須等當日官方收盤資料實際前進並完成驗證，才可建立下一交易日計畫。</div>`;
    box.classList.remove('hidden');
  }
  btn.onclick=async()=>{const code=input.value.trim();if(!/^\d{4,6}$/.test(code))return alert('請輸入股票代號或名稱');load.classList.remove('hidden');try{const api=window.StockLabAPI;if(!api?.config?.enabled)throw Error('正式私有分析後端尚未啟用；瀏覽器本地預測已停用');const j=await api.analyze(code);await renderPrivate(j)}catch(e){blocked(e.message||String(e))}finally{load.classList.add('hidden')}};
})();