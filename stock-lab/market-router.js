// Single-stock entry router.
// Executable numeric entry output is backend-only. The browser never maintains a second production formula.
// When production prediction is not ready, the page still shows verified licensed facts instead of getting stuck.
(function(){
  const btn=document.querySelector('#analyzeBtn'),input=document.querySelector('#ticker'),load=document.querySelector('#singleLoad'),box=document.querySelector('#result');
  if(!btn||!input||!load||!box)return;
  const MISSING='資料未取得／未通過驗證';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{const x=Number(String(v??'').replace(/,/g,''));return Number.isFinite(x)?x:null};
  const money=x=>Number(x).toLocaleString('zh-TW',{maximumFractionDigits:2});
  const iso=v=>{const s=String(v||'').trim(),m=s.match(/^(\d{4})[-\/]?(\d{2})[-\/]?(\d{2})$/);return m?`${m[1]}-${m[2]}-${m[3]}`:null};
  const roc=v=>{const s=String(v||'').trim(),m=s.match(/^(\d{2,3})[-\/](\d{1,2})[-\/](\d{1,2})$/);return m?`${Number(m[1])+1911}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`:null};
  const normDate=v=>iso(v)||roc(v);

  async function licensedSnapshot(code){
    const cache=window.StockLabSameOrigin;
    if(!cache?.latest)throw Error('合法 OGDL 市場事實層尚未就緒');
    const row=await cache.latest(code);
    if(!row||row.provenance!=='observed'||row.licence!=='OGDL-1.0')throw Error('市場事實來源授權／驗證未通過');
    return{
      market:row.market,
      name:String(row.name||'').trim(),
      row,
      meta:{licence_verified:true,licence:'OGDL-1.0',data_gov_dataset:row.source_id||'',attribution:row.source_name||row.source_id||''},
      cacheGeneratedAt:null
    };
  }
  function snapshotFacts(s){
    const r=s.row||{};
    const close=num(r.close??r.ClosingPrice??r.Close??r['收盤價']);
    const date=normDate(r.date??r.Date??r.TradeDate??r['日期']??r.TradingDate??r['資料日期']);
    const open=num(r.open??r.OpeningPrice??r.Open??r['開盤價']);
    const high=num(r.high??r.HighestPrice??r.High??r['最高價']);
    const low=num(r.low??r.LowestPrice??r.Low??r['最低價']);
    return{close,date,open,high,low};
  }
  async function sessionLabel(market,date){
    const resolver=window.StockLabSessionContext;if(!resolver?.resolve||!date)return{verified:false,label:'交易日／時段尚未驗證'};
    try{return await resolver.resolve({market,dataDate:date})}catch(e){return{verified:false,label:`交易日／時段尚未驗證：${e.message}`}}
  }
  function factBox(label,value,note=''){return `<div class=sourceitem><b>${esc(label)}</b>${value==null||value===''?MISSING:esc(value)}${note?`<br><span class=mini>${esc(note)}</span>`:''}</div>`}
  async function renderVerifiedFallback(code,reason){
    let s=null,f=null,session={verified:false,label:'交易日／時段尚未驗證'};
    try{s=await licensedSnapshot(code);f=snapshotFacts(s);session=await sessionLabel(s.market,f.date)}catch(e){reason=`${reason}；${e.message}`}
    const label=s?.name?`${s.name}／${code}`:code;
    const priceOK=!!(f?.date&&Number.isFinite(f?.close));
    const provenance=s?.meta?.data_gov_dataset?`data.gov.tw dataset ${s.meta.data_gov_dataset}｜OGDL-1.0｜${s.meta.attribution||''}`:'合法資料來源尚未完成確認';
    const phase=session?.label||'交易日／時段尚未驗證';
    box.innerHTML=`<div class=toprow><div><h2>${esc(label)}</h2><div class=muted>想買這檔｜${esc(s?.market||'市場未驗證')}</div></div></div>
      <div class=source-note><b>${priceOK?'✅ 已驗證事實':'⚠️ 價格事實未完整'}</b><div class=mini>${priceOK?`最新完成交易日 ${esc(f.date)}｜官方收盤 ${money(f.close)}`:'沒有同時取得「資料日＋收盤價」，因此不顯示成目前有效價格。'}</div></div>
      <div class=sourcegrid style="margin-top:10px">
        ${factBox('資料基準日',f?.date||null,'不能以快取時間冒充交易日')}
        ${factBox('最新合法收盤',priceOK?money(f.close):null,'完成交易日收盤；不是盤中即時價')}
        ${factBox('交易時段判定',session?.verified===true?phase:null,session?.verified===true?'由已驗證交易日曆判定':'未通過就不推測下一交易日')}
        ${factBox('合法來源',s?.meta?.data_gov_dataset?'OGDL-1.0':null,provenance)}
      </div>
      <div class=source-note><b class=bad>正式進場價格尚未解鎖</b><div class=mini>${esc(reason)}</div></div>
      <div class=disclaimer><b>想買這檔的硬規則</b>畫面可以顯示已驗證事實，但「建議進場區間／信心指數」只能由正式私有模型輸出，而且必須同時通過合法歷史 OHLC、交易日曆、公司行動、注意／處置風險、完整入場因子、樣本外 OOS、觸價／成交可達性與信心校準。任何一項缺漏就維持未知；不以舊值、0、平均值、其他網站或 AI 補值。13:30 台灣時間後只開始等待新資料；必須等官方資料日期真的前進到當日並完成驗證，才建立下一交易日計畫。</div>`;
    box.classList.remove('hidden');
  }
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
      if(s.state==='TODAY_PREOPEN_ACTIVE')return{title:`今日 ${target} 入場計畫`,note:'08:30–09:00 台灣時間盤前階段；此計畫對應目標交易日，不是盤中即時報價。'};
      if(s.state==='TODAY_PLAN_BEFORE_ORDERS')return{title:`今日 ${target} 入場計畫`,note:'尚未到盤前委託時段；08:30 台灣時間起才進入盤前委託階段。'};
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
  btn.onclick=async()=>{const code=input.value.trim();if(!/^\d{4,6}$/.test(code))return alert('請輸入股票代號或名稱');load.classList.remove('hidden');try{const api=window.StockLabAPI;if(!api?.config?.enabled){await renderVerifiedFallback(code,'正式私有分析後端尚未啟用；瀏覽器本地預測已停用');return}try{const j=await api.analyze(code);await renderPrivate(j)}catch(e){await renderVerifiedFallback(code,e.message||String(e))}}finally{load.classList.add('hidden')}};
})();