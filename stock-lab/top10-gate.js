// TOP 10 entry gate. Internal model uses the same complete entry contract as single-stock analysis.
// Public cards stay concise: stock, entry range, calibrated confidence and action only.
(function(){
  const btn=document.querySelector('#scanBtn');if(!btn)return;
  const CACHE_TTL=10*60*1000,scanCache=new Map(),STRATEGY='entry';
  const FACTOR_KEYS=['trend','volume','movingAverages','institution','macd','rsi','kd','crossovers','candlestick'];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function renderCached(html){const box=document.querySelector('#top10');box.innerHTML=html;box.classList.remove('hidden')}
  function blocked(reason){renderCached(`<div class=toprow><div><h2>入場候選 TOP 10</h2><div class=muted>目前無法形成正式排名</div></div></div><h3 class=bad>⛔ 暫不產生 TOP 10</h3><p>${esc(reason)}</p><div class=disclaimer><b>資料規則</b>任何必要資料、合法性、樣本外驗證、進場區間可達性或信心校準缺漏，都不以舊模型或假資料補排名。</div>`)}
  function textArray(v){return Array.isArray(v)?v.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()):[]}
  function factorAuditOK(x){const f=x?.entry_factors;if(!f||typeof f!=='object')return false;return FACTOR_KEYS.every(k=>f[k]?.verified===true&&['positive','neutral','negative'].includes(f[k]?.state))}
  function contextAuditOK(x){const c=x?.market_context||{};return c.us?.verified===true&&c.tx?.verified===true&&c.events?.verified===true}
  function validateItem(x){
    const reasons=textArray(x?.reasons),risks=textArray(x?.risks),audit=x?.audit||{},lo=Number(x?.entry_low),hi=Number(x?.entry_high),ci=Number(x?.confidence_index);
    if(audit.legal_source_verified!==true||audit.price_verified!==true||audit.oos_validation_passed!==true||audit.active_risk_status_checked!==true)return`候選 ${x?.ticker||'—'} 未通過來源／價格／OOS／風險狀態稽核`;
    if(audit.entry_range_execution_validated!==true)return`候選 ${x?.ticker||'—'} 進場區間未通過 OOS 觸價／成交可達性驗證`;
    if(audit.confidence_calibrated!==true||!Number.isFinite(ci)||ci<0||ci>100)return`候選 ${x?.ticker||'—'} 信心指數未完成正式樣本外校準`;
    if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo<=0||hi<lo)return`候選 ${x?.ticker||'—'} 沒有有效進場區間`;
    if(x?.strategy!==STRATEGY)return`候選 ${x?.ticker||'—'} 不是統一入場模型結果`;
    if(!factorAuditOK(x))return`候選 ${x?.ticker||'—'} 內部入場因子未全部驗證`;
    if(!contextAuditOK(x))return`候選 ${x?.ticker||'—'} 內部市場背景未全部驗證`;
    if(reasons.length<2)return`候選 ${x?.ticker||'—'} 缺少可稽核入榜理由`;
    if(!risks.length)return`候選 ${x?.ticker||'—'} 缺少主要風險說明`;
    return null;
  }
  function renderPrivate(j){
    const d=j?.data||{},items=Array.isArray(d.items)?d.items:[];
    if(j?.ok!==true||!j?.model_version||!d.data_date||d.strategy!==STRATEGY||d.audit?.legal_source_verified!==true||d.audit?.price_verified!==true||d.audit?.oos_validation_passed!==true)return blocked('後端 TOP10 稽核尚未完整通過。');
    for(const x of items){const err=validateItem(x);if(err)return blocked(err)}
    if(items.length<10)return blocked(`通過全部 Gate 的股票只有 ${items.length} 檔；不以不合格股票補滿 10 檔。`);
    const html=`<div class=toprow><div><h2>目前值得研究的 TOP 10</h2><div class=muted>資料基準 ${esc(d.data_date)}｜${esc(j.model_version)}</div></div></div><div class=list>${items.slice(0,10).map((x,i)=>{const label=x.name?`${x.name}／${x.ticker||'—'}`:(x.ticker||'—'),ci=Math.round(Number(x.confidence_index));return `<div class=item><div class=rank>#${i+1}</div><div><b>${esc(label)}</b><div class=mini>${esc(x.exchange||'—')}｜${esc(x.action||'研究候選')}</div><div style="margin-top:5px"><b>進場 ${fmt(Number(x.entry_low))}–${fmt(Number(x.entry_high))}</b></div></div><div class=price>${ci}<br><span class=mini>信心指數<br>非上漲機率</span></div></div>`}).join('')}</div><div class=disclaimer><b>顯示原則</b>九項入場因子、美股、台指期與國際時事只在內部模型與 audit 使用，不在簡潔頁面逐項展開。</div>`;
    scanCache.set('private:entry',{at:Date.now(),html});renderCached(html)
  }
  btn.onclick=async()=>{
    const api=window.StockLabAPI,key='private:entry',cached=scanCache.get(key);
    if(cached&&Date.now()-cached.at<CACHE_TTL){renderCached(cached.html);return}
    document.querySelector('#scanLoad').classList.remove('hidden');
    try{
      const rt=window.STOCKLAB_RUNTIME||{};
      if(rt.gates?.entryScannerOosValidation!==true||rt.gates?.entryRangeExecutionValidation!==true||rt.gates?.scannerConfidenceCalibration!==true)return blocked('TOP10 的正式 OOS、進場區間可達性或信心校準尚未通過。');
      if(!api?.config?.enabled)return blocked('正式私有分析後端尚未啟用；瀏覽器本地排名維持停用。');
      const j=await api.scan();renderPrivate(j)
    }catch(e){blocked(`TOP10 稽核／資料取得失敗：${e.message||e}`)}finally{document.querySelector('#scanLoad').classList.add('hidden')}
  };
})();