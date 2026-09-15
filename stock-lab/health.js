// Public data-health panel. Reads only StockLab's own verified snapshots; never changes scores.
(function(){
  const host=document.querySelector('#marketCard');
  if(!host)return;
  const box=document.createElement('div');
  box.className='source-note';
  box.id='dataHealth';
  box.innerHTML='<b>資料健康狀態</b><div class="mini">載入驗證快照中…</div>';
  host.appendChild(box);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const badge=(ok,label,detail)=>`<div class="sourceitem"><b>${ok?'✅':'⚠️'} ${esc(label)}</b><span class="mini">${esc(detail)}</span></div>`;
  const age=d=>{if(!d)return null;const x=new Date(d);return Number.isFinite(x.getTime())?Math.floor((Date.now()-x.getTime())/864e5):null};
  async function get(path){try{const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error(String(r.status));return await r.json()}catch{return null}}
  Promise.all([get('./tpex-health.json'),get('./market-data.json'),get('./futures-data.json')]).then(([tp,mk,tx])=>{
    const rows=[];
    const tpok=!!(tp&&tp.verified&&tp.status==='ok'&&age(tp.generated_at)<=2);
    rows.push(badge(tpok,'TPEx 上櫃',tpok?`官方 6 類資料通過｜行情 ${tp.checks?.snapshot?.latest_date||'—'}`:`${tp?.status||'無快照'}｜上櫃資料暫不採用`));
    for(const [k,name] of [['vix','VIX'],['sox','SOX'],['nasdaq','NASDAQ']]){
      const x=mk?.sources?.[k];const ok=!!(x?.verified&&age(x.fetched_at)<=5);
      rows.push(badge(ok,name,ok?`${x.date}｜${Number(x.value).toLocaleString('zh-TW',{maximumFractionDigits:2})}`:`${x?.error||'尚未驗證'}｜不計分`));
    }
    const txok=!!(tx?.verified&&tx.status==='ok'&&age(tx.generated_at)<=4);
    rows.push(badge(txok,'台指期 TX',txok?`${tx.trade_date}｜${tx.contract_month}｜${tx.last_price}`:`${tx?.status||'無快照'}${tx?.source_dates?`｜${tx.source_dates.report} / ${tx.source_dates.excel}`:''}｜不計分`));
    box.innerHTML=`<b>資料健康狀態</b><div class="sourcegrid" style="margin-top:8px">${rows.join('')}</div><div class="mini" style="margin-top:8px">未通過來源／日期／期別驗證的資料只顯示狀態，不進入任何股票分數。</div>`;
  });
})();
