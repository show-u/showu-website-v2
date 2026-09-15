// Visible data-cutoff/readiness status. Facts only; never advances a target session from the wall clock.
(function(){
  const internalSummary=document.querySelector('#dataHealthSummary');
  const internalBody=document.querySelector('#marketDetailsBody');
  const publicSummary=document.querySelector('#readinessSummary');
  const publicBody=document.querySelector('#readinessBody');
  if(!internalSummary&&!publicSummary)return;
  const rt=window.STOCKLAB_RUNTIME||{};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stamp=s=>{if(!s)return'—';const d=new Date(s);if(Number.isNaN(d.getTime()))return esc(s);return new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)};
  const allRuntimeGatesPass=()=>rt.productionPredictionReady===true&&Object.values(rt.gates||{}).every(v=>v===true);
  async function getJson(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(`${url} ${r.status}`);return r.json()}
  function marketDate(m,key){return m?.latest_ingest?.[key]?.date||null}
  function coverage(m){
    const q=m?.coverage_metrics?.overall||{};
    return{
      dates:Number(q.distinct_trading_dates)||0,
      securities:Number(q.securities)||0,
      maxBars:Number(q.max_valid_bars_per_security)||0,
      entryReady:Number(q.securities_at_least_60_bars)||0,
      holdingReady:Number(q.securities_at_least_120_bars)||0,
      entryNeed:Number(m?.coverage_metrics?.entry_minimum_valid_bars)||60,
      holdingNeed:Number(m?.coverage_metrics?.holding_exit_minimum_valid_bars)||120
    };
  }
  function modelStatus(v,key){return v?.models?.[key]?.status||'UNKNOWN'}
  function readyHtml(m,v){
    const c=coverage(m),ready=allRuntimeGatesPass(),entry=modelStatus(v,'entry_decision_9plus3'),scan=modelStatus(v,'entry_scanner_9plus3'),hold=modelStatus(v,'holding_exit');
    const entryHist=c.entryReady>0?`已有 ${c.entryReady} 檔達 ${c.entryNeed} 根日線`:`0 檔達 ${c.entryNeed} 根日線`;
    const holdHist=c.holdingReady>0?`已有 ${c.holdingReady} 檔達 ${c.holdingNeed} 根日線`:`0 檔達 ${c.holdingNeed} 根日線`;
    return `<div class=sourcegrid><div class=sourceitem><b>合法歷史行情覆蓋</b>${c.dates} 個交易日｜${c.securities} 個標的<br><span class=mini>單一標的目前最多 ${c.maxBars} 根有效日線</span></div><div class=sourceitem><b>新部位入場模型</b>${esc(entry)}<br><span class=mini>${entryHist}；尚須正式 OOS、可達性與校準 Gate</span></div><div class=sourceitem><b>已持有出場模型</b>${esc(hold)}<br><span class=mini>${holdHist}；尚須 300 OOS episodes／80 檔／多市場 regime 與執行驗證</span></div><div class=sourceitem><b>TOP10 入場模型</b>${esc(scan)}<br><span class=mini>必須與單股入場使用同一完整模型；不足 10 檔不補數</span></div></div><div class=mini style="margin-top:10px">目前狀態：${ready?'✅ 所有 production Gate 已通過':'⛔ production numeric prediction 尚未解鎖'}。這裡的日線數只代表合法歷史資料覆蓋，<b>不代表模型已通過 OOS</b>。缺少的歷史、風險狀態、公司行動、事件或市場背景不以舊值、0、平均值、其他網站或 AI 補齊。</div>`;
  }
  function internalHtml(m,v){
    const last=m?.last_date||null,tw=marketDate(m,'TWSE'),tp=marketDate(m,'TPEx'),ready=allRuntimeGatesPass(),c=coverage(m);
    const state=ready?'✅ 下一交易時段模型 Gate 已全部通過':'⛔ 下一交易時段價格尚未解鎖';
    const why=ready?'仍須以個股本身的資料日與風險 Gate 再做最後檢查。':'目前至少有資料層／交易規則／正式 OOS Gate 尚未完成；不輸出可執行價格。';
    return `<div class=source-note style="margin-top:0"><b>資料截止與模型 readiness</b><div class=sourcegrid style="margin-top:8px"><div class=sourceitem><b>最新合法官方資料</b>${esc(last||'未取得')}</div><div class=sourceitem><b>市場資料日</b>TWSE ${esc(tw||'未取得')}<br>TPEx ${esc(tp||'未取得')}</div><div class=sourceitem><b>最後合法快取歸檔</b>${stamp(m?.generated_at)}（台灣時間）</div><div class=sourceitem><b>合法歷史覆蓋</b>${c.dates} 個交易日｜單檔最多 ${c.maxBars} 根<br>≥${c.entryNeed} 根 ${c.entryReady} 檔｜≥${c.holdingNeed} 根 ${c.holdingReady} 檔</div><div class=sourceitem><b>入場／TOP10／持股</b>${esc(modelStatus(v,'entry_decision_9plus3'))}<br>${esc(modelStatus(v,'entry_scanner_9plus3'))}<br>${esc(modelStatus(v,'holding_exit'))}</div><div class=sourceitem><b>下一交易時段狀態</b>${state}</div></div><div class=mini style="margin-top:10px">${why}<br>公開資料更新嘗試：14:20／14:50／15:20／15:50（台灣時間）。這些只是抓取嘗試，不代表官方資料已更新。StockLab 只看「官方資料日期是否真的前進＋必要 Gate 是否全部通過」，不因現在已收盤、已過 09:00 或已到隔天就自行改日期。沒有合法即時／延遲行情授權時，也不產生盤中重算價格。</div></div>`;
  }
  async function run(){
    if(internalSummary)internalSummary.textContent='正在核對合法資料日…';
    if(publicSummary)publicSummary.textContent='正在核對…';
    try{
      const [m,v]=await Promise.all([getJson('./history-ogdl/manifest.json'),getJson('./model-validation-status.json')]);
      if(m.schema_version!==1||m.source_class!=='ogdl_daily_archive'||m.licence!=='OGDL-1.0'||m.no_imputation!==true)throw Error('合法歷史快照 manifest 驗證未通過');
      if(v.schema_version!==4||v.architecture!=='unified-entry-holding-v10')throw Error('模型驗證狀態檔版本不符');
      const last=m.last_date||'未取得',ready=allRuntimeGatesPass(),c=coverage(m);
      if(internalSummary)internalSummary.textContent=`資料截止 ${last}｜${ready?'模型 Gate 已通過':'價格未解鎖'}`;
      if(internalBody){const old=internalBody.querySelector('[data-cutoff-status]');if(old)old.remove();const wrap=document.createElement('div');wrap.dataset.cutoffStatus='1';wrap.innerHTML=internalHtml(m,v);internalBody.prepend(wrap)}
      if(publicSummary)publicSummary.textContent=ready?'正式模型已解鎖':`BLOCKED｜歷史最多 ${c.maxBars} 根`;
      if(publicBody)publicBody.innerHTML=readyHtml(m,v);
      window.StockLabDataStatus={manifest:m,validation:v,latestDate:m.last_date||null,modelReady:ready,coverage:c};
    }catch(e){
      const msg=String(e.message||e);
      if(internalSummary)internalSummary.textContent='資料截止日未驗證';
      if(internalBody){const old=internalBody.querySelector('[data-cutoff-status]');if(old)old.remove();const wrap=document.createElement('div');wrap.dataset.cutoffStatus='1';wrap.innerHTML=`<div class=source-note style="margin-top:0"><b>⚠️ 資料截止日無法驗證</b><div class=mini>${esc(msg)}。依 Truth Rules，無法驗證時不假設資料是最新，也不產生新的交易價格。</div></div>`;internalBody.prepend(wrap)}
      if(publicSummary)publicSummary.textContent='BLOCKED｜資料未驗證';
      if(publicBody)publicBody.innerHTML=`<b class=bad>正式模型未解鎖</b><div class=mini>${esc(msg)}。缺少資料維持缺少，不補值、不猜值、不以舊資料冒充最新。</div>`;
      window.StockLabDataStatus={manifest:null,validation:null,latestDate:null,modelReady:false,error:msg};
    }
  }
  run();
})();
