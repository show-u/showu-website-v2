// Compact public data-health display. Never load the large stock cache merely for diagnostics.
(function(){
  const host=document.querySelector('#marketDetailsBody'),summary=document.querySelector('#dataHealthSummary');if(!host||!summary)return;
  const box=document.createElement('div');box.id='dataHealth';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const age=d=>{if(!d)return null;const x=new Date(d);return Number.isFinite(x.getTime())?Math.floor((Date.now()-x.getTime())/864e5):null};
  async function get(path){try{const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error(String(r.status));return await r.json()}catch{return null}}
  const row=(ok,label,detail)=>`<div class="sourceitem"><b>${ok?'✅':'⚠️'} ${esc(label)}</b><span class="mini">${esc(detail)}</span></div>`;
  Promise.all([get('./tpex-health.json'),get('./market-data.json'),get('./futures-data.json')]).then(([tp,mk,tx])=>{
    const optional=[];
    const tpok=!!(tp&&tp.verified&&tp.status==='ok'&&age(tp.generated_at)<=2);
    for(const [k,name] of [['vix','VIX'],['sox','SOX'],['nasdaq','NASDAQ']]){const x=mk?.sources?.[k],ok=!!(x?.verified&&age(x.fetched_at)<=5);optional.push({ok,label:name,detail:ok?`${x.date}｜${Number(x.value).toLocaleString('zh-TW',{maximumFractionDigits:2})}`:'未通過驗證；略過、不補值'})}
    const txok=!!(tx?.verified&&tx.status==='ok'&&age(tx.generated_at)<=4);optional.push({ok:txok,label:'台指期 TX',detail:txok?`${tx.trade_date}｜${tx.contract_month}｜${tx.last_price}`:'未通過驗證；不計分'});
    const optPass=optional.filter(x=>x.ok).length;
    summary.textContent=`核心查詢時驗證｜外部 ${optPass}/${optional.length}`;
    box.innerHTML=`<h3 style="margin-top:0">資料狀態</h3><div class="sourcegrid"><div class=sourceitem><b>台股核心資料</b><span class=mini>股票查詢時才載入並逐項驗證；首頁不預載約 11 MB 股票快取。</span></div>${row(tpok,'TPEx 上櫃資料',tpok?`官方資料通過｜行情 ${tp.checks?.snapshot?.latest_date||'—'}`:'上櫃資料目前不納入預測')}</div><h3>外部觀察資料</h3><div class="sourcegrid">${optional.map(x=>row(x.ok,x.label,x.detail)).join('')}</div><div class="mini" style="margin-top:8px">未通過來源、授權、日期或內容驗證的資料會被略過；不以 0、舊值、平均值或推測值補入。</div>`;
    host.appendChild(box);
  });
})();
