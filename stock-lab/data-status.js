// Visible data-cutoff/readiness status. Facts only; never advances a target session from the wall clock.
(function(){
  const summary=document.querySelector('#dataHealthSummary');
  const body=document.querySelector('#marketDetailsBody');
  if(!summary||!body)return;
  const rt=window.STOCKLAB_RUNTIME||{};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stamp=s=>{if(!s)return'—';const d=new Date(s);if(Number.isNaN(d.getTime()))return esc(s);return new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)};
  const allRuntimeGatesPass=()=>rt.productionPredictionReady===true&&Object.values(rt.gates||{}).every(v=>v===true);
  async function getJson(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(`${url} ${r.status}`);return r.json()}
  function marketDate(m,key){return m?.latest_ingest?.[key]?.date||null}
  function statusHtml(m){
    const last=m?.last_date||null,tw=marketDate(m,'TWSE'),tp=marketDate(m,'TPEx'),ready=allRuntimeGatesPass();
    const state=ready?'✅ 下一交易時段模型 Gate 已全部通過':'⛔ 下一交易時段價格尚未解鎖';
    const why=ready?'仍須以個股本身的資料日與風險 Gate 再做最後檢查。':'目前至少有資料層／交易規則／正式 OOS Gate 尚未完成；不輸出買入價格。';
    return `<div class=source-note style="margin-top:0"><b>資料截止與下一交易時段</b><div class=sourcegrid style="margin-top:8px"><div class=sourceitem><b>最新合法官方資料</b>${esc(last||'未取得')}</div><div class=sourceitem><b>市場資料日</b>TWSE ${esc(tw||'未取得')}<br>TPEx ${esc(tp||'未取得')}</div><div class=sourceitem><b>最後合法快取歸檔</b>${stamp(m?.generated_at)}（台灣時間）</div><div class=sourceitem><b>下一交易時段狀態</b>${state}</div></div><div class=mini style="margin-top:10px">${why}<br>公開資料更新嘗試：14:20／14:50／15:20／15:50（台灣時間）。這些只是抓取嘗試，不代表官方資料已更新。StockLab 只看「官方資料日期是否真的前進＋必要 Gate 是否全部通過」，不因現在已收盤、已過 09:00 或已到隔天就自行改日期。沒有合法即時／延遲行情授權時，也不產生盤中重算價格。</div></div>`;
  }
  async function run(){
    summary.textContent='正在核對合法資料日…';
    try{
      const m=await getJson('./history-ogdl/manifest.json');
      if(m.schema_version!==1||m.source_class!=='ogdl_daily_archive'||m.licence!=='OGDL-1.0'||m.no_imputation!==true)throw Error('合法歷史快照 manifest 驗證未通過');
      const last=m.last_date||'未取得',ready=allRuntimeGatesPass();
      summary.textContent=`資料截止 ${last}｜${ready?'模型 Gate 已通過':'下一交易價格未解鎖'}`;
      const old=body.querySelector('[data-cutoff-status]');if(old)old.remove();
      const wrap=document.createElement('div');wrap.dataset.cutoffStatus='1';wrap.innerHTML=statusHtml(m);body.prepend(wrap);
      window.StockLabDataStatus={manifest:m,latestDate:m.last_date||null,modelReady:ready};
    }catch(e){
      summary.textContent='資料截止日未驗證';
      const old=body.querySelector('[data-cutoff-status]');if(old)old.remove();
      const wrap=document.createElement('div');wrap.dataset.cutoffStatus='1';wrap.innerHTML=`<div class=source-note style="margin-top:0"><b>⚠️ 資料截止日無法驗證</b><div class=mini>${esc(e.message)}。依 Truth Rules，無法驗證時不假設資料是最新，也不產生新的交易價格。</div></div>`;body.prepend(wrap);
      window.StockLabDataStatus={manifest:null,latestDate:null,modelReady:false,error:String(e.message||e)};
    }
  }
  run();
})();
