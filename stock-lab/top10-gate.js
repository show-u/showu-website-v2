// TOP 10 production gate. No browser-side fallback ranking is allowed.
(function(){
  const btn=document.querySelector('#scanBtn');if(!btn)return;
  const CACHE_TTL=10*60*1000,scanCache=new Map();
  function renderCached(html){const box=document.querySelector('#top10');box.innerHTML=html;box.classList.remove('hidden')}
  function blocked(reason){renderCached(`<div class=toprow><div><h2>TOP 10</h2><div class=muted>FAIL CLOSED｜不以舊模型補排名</div></div></div><h3 class=bad>⛔ 暫不產生 TOP 10</h3><p>${reason}</p><div class=disclaimer><b>原因</b>TOP10 必須同時通過合法資料源、商品分類、日期完整性、台股風險 Gate、選股方法與正式樣本外驗證。任何一項未通過就沒有排名；不從成交值前40檔、舊快取或缺失因子拼出十檔。</div>`)}
  function renderPrivate(j,h){
    const d=j?.data||{},items=Array.isArray(d.items)?d.items:[];
    if(j?.ok!==true||!j?.model_version||!d.data_date||d.audit?.legal_source_verified!==true||d.audit?.price_verified!==true||d.audit?.oos_validation_passed!==true)return blocked('後端 TOP10 稽核缺少合法來源、價格驗證或正式 OOS PASS。');
    for(const x of items){if(x?.audit?.legal_source_verified!==true||x?.audit?.price_verified!==true||x?.audit?.oos_validation_passed!==true)return blocked(`候選 ${x?.ticker||'—'} 未通過個股稽核。`)}
    if(items.length<10)return blocked(`通過全部 Gate 的股票只有 ${items.length} 檔；不以不合格股票補滿 10 檔。`);
    const html=`<h2>值得優先研究 TOP 10</h2><p class=muted>資料日 ${d.data_date}｜模型 ${j.model_version}｜已通過來源／價格／OOS 稽核。分數是研究排名，不是上漲機率。</p><div class=list>${items.slice(0,10).map((x,i)=>{const label=x.name?`${x.name}／${x.ticker||'—'}`:(x.ticker||'—'),entry=x.entry_low!=null&&x.entry_high!=null?`${fmt(x.entry_low)}–${fmt(x.entry_high)}`:'資料未取得／未通過驗證';return `<div class=item><div class=rank>#${i+1}</div><div><b>${label}</b><div class=mini>${x.exchange||'—'}｜${x.data_date||d.data_date}｜${x.action||'研究候選'}</div><div style="margin-top:6px"><b>模型估算區間：${entry}</b></div></div><div class=price>${x.score??'—'}分<br><span class=mini>研究分數／非機率</span></div></div>`}).join('')}</div><div class=disclaimer><b>TOP10 真實性規則</b>未通過 Gate 的股票不入榜，也不拿其他股票補足。所有數字都必須能追溯資料日與模型版本。</div>`;
    scanCache.set(`private:${h}`,{at:Date.now(),html});renderCached(html);
  }
  btn.onclick=async()=>{
    const h=document.querySelector('#scanHorizon').value,api=window.StockLabAPI,key=`private:${h}`;
    const cached=scanCache.get(key);if(cached&&Date.now()-cached.at<CACHE_TTL){renderCached(cached.html);return;}
    document.querySelector('#scanLoad').classList.remove('hidden');
    try{
      if(!api?.config?.enabled)return blocked('正式私有分析後端尚未啟用；瀏覽器本地排名已停用，避免用未驗證模型產生假 TOP10。');
      const j=await api.scan(h);renderPrivate(j,h);
    }catch(e){blocked(`TOP10 稽核／資料取得失敗：${e.message||e}`)}
    finally{document.querySelector('#scanLoad').classList.add('hidden')}
  };
})();
