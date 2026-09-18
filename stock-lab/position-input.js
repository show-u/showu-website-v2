// Holding position input layer. User-supplied position facts only; no market-data inference.
(function(){
  const mode=document.querySelector('#positionInputMode');
  const manual=document.querySelector('#manualPositionFields');
  const lotsBox=document.querySelector('#positionLots');
  const rows=document.querySelector('#positionLotRows');
  const addBtn=document.querySelector('#addPositionLot');
  const summary=document.querySelector('#positionLotSummary');
  const avgCost=document.querySelector('#holdAvgCost');
  const shares=document.querySelector('#holdShares');
  const buyTime=document.querySelector('#holdBuyTime');
  const holdResult=document.querySelector('#holdResult');
  if(!mode||!manual||!lotsBox||!rows||!addBtn||!summary||!avgCost||!shares||!buyTime)return;

  let seq=0;
  const num=v=>{const s=String(v??'').trim().replace(/,/g,'');if(!s)return null;const x=Number(s);return Number.isFinite(x)?x:null};
  const money=x=>Number(x).toLocaleString('zh-TW',{maximumFractionDigits:4});
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validDateTime=v=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(v||''))&&!Number.isNaN(new Date(`${v}:00+08:00`).getTime());

  function rowTemplate(){
    const id=++seq;
    return `<div class="sourceitem position-lot" data-lot-id="${id}"><div class="grid"><label>買入時間<input type="datetime-local" data-lot-time></label><label>買入價格<input inputmode="decimal" data-lot-price placeholder="例如：4380"></label><label>目前仍持有股數<input inputmode="numeric" data-lot-shares placeholder="例如：500"></label><label>備註（選填）<input data-lot-note placeholder="例如：第一批"></label></div><button type="button" class="ghost" data-remove-lot style="margin-top:8px">刪除此筆</button></div>`;
  }
  function addRow(){rows.insertAdjacentHTML('beforeend',rowTemplate());recompute()}
  function lotRows(){return[...rows.querySelectorAll('.position-lot')].map(el=>({el,time:el.querySelector('[data-lot-time]')?.value||'',price:num(el.querySelector('[data-lot-price]')?.value),shares:num(el.querySelector('[data-lot-shares]')?.value),note:el.querySelector('[data-lot-note]')?.value||''}))}
  function recompute(){
    if(mode.value!=='lots'){summary.innerHTML='<b>逐筆明細未啟用</b><div class="mini">目前以你輸入的買入時間、目前持股數與成本均價為準；總成本由均價 × 股數計算。</div>';return}
    const all=lotRows(),used=all.filter(x=>x.time||x.price!=null||x.shares!=null||x.note.trim());
    if(!used.length){avgCost.value='';shares.value='';buyTime.value='';summary.innerHTML='<b>尚未輸入買入明細</b><div class="mini">逐筆模式不會自動猜測任何成本或買入時間。</div>';return}
    const incomplete=used.filter(x=>!validDateTime(x.time)||!(x.price>0)||!(x.shares>0));
    if(incomplete.length){avgCost.value='';shares.value='';buyTime.value='';summary.innerHTML='<b class="bad">買入明細不完整</b><div class="mini">每一筆已使用的明細都必須有有效買入時間、正數買入價格與目前仍持有股數。缺值不補 0，也不推測日期。</div>';return}
    const totalShares=used.reduce((s,x)=>s+x.shares,0),sumCost=used.reduce((s,x)=>s+x.price*x.shares,0),weighted=totalShares?sumCost/totalShares:null,times=used.map(x=>x.time).sort();
    if(!(totalShares>0)||!(weighted>0)){avgCost.value='';shares.value='';buyTime.value='';summary.innerHTML='<b class="bad">明細無法形成有效部位</b>';return}
    avgCost.value=String(+weighted.toFixed(4));shares.value=String(+totalShares.toFixed(4));buyTime.value=times[0]||'';
    summary.innerHTML=`<b>逐筆明細計算結果</b><div class="mini">目前仍持有 ${money(totalShares)} 股｜輸入成本合計 ${money(sumCost)}｜加權均價 ${money(weighted)}｜最早買入時間 ${esc(times[0])}<br>以上全部來自你的輸入，不是市場推估；未含你未輸入的手續費、交易稅、股利或已賣出部位。</div>`;
  }
  function setMode(){const lots=mode.value==='lots';manual.classList.toggle('hidden',lots);lotsBox.classList.toggle('hidden',!lots);if(lots&&!rows.children.length)addRow();recompute()}
  function collect(){
    if(mode.value==='manual'){
      const a=num(avgCost.value),sh=num(shares.value),raw=buyTime.value||'',bt=validDateTime(raw)?raw:null;
      if(!(a>0)||!(sh>0)||!bt)throw Error('請完整輸入首次買入時間、目前持有股數與目前成本均價');
      const tc=a*sh;
      return{mode:'manual',averageCost:a,shares:sh,totalCost:tc,buyTime:bt,buyDate:bt.slice(0,10),lots:null,positionComplete:true,provenance:{averageCost:'user_observed',shares:'user_observed',totalCost:'derived_from_user_position',buyTime:'user_observed'}};
    }
    recompute();const a=num(avgCost.value),sh=num(shares.value),bt=buyTime.value||null;if(!(a>0)||!(sh>0)||!validDateTime(bt))throw Error('逐筆買入明細尚未完整');
    const lots=lotRows().filter(x=>validDateTime(x.time)&&x.price>0&&x.shares>0).map(x=>({time:x.time,date:x.time.slice(0,10),price:x.price,shares:x.shares,note:x.note||null,provenance:'user_observed'}));
    const tc=lots.reduce((s,x)=>s+x.price*x.shares,0);
    return{mode:'lots',averageCost:a,shares:sh,totalCost:tc,buyTime:bt,buyDate:bt.slice(0,10),lots,positionComplete:true,provenance:{averageCost:'derived_from_user_lots',shares:'derived_from_user_lots',totalCost:'derived_from_user_lots',buyTime:'derived_from_user_lots'}};
  }
  function provenanceHtml(){return mode.value==='lots'?'<b>部位資料來源｜derived from user input</b><div class="mini">總股數、總成本、加權均價與最早買入時間由你輸入的逐筆明細確定性計算；不是市場推估。</div>':'<b>部位資料來源｜user observed + derived</b><div class="mini">首次買入時間、目前持有股數與成本均價採你的輸入；目前部位總成本＝成本均價 × 持有股數，由系統確定性計算，不要求你重複輸入。</div>'}
  function stampProvenance(){if(!holdResult||!holdResult.querySelector('h2'))return;if(holdResult.querySelector('[data-position-provenance]'))return;const n=document.createElement('div');n.className='source-note compact-note';n.dataset.positionProvenance='1';n.innerHTML=provenanceHtml();const top=holdResult.querySelector('.toprow');top?.insertAdjacentElement('afterend',n)}

  mode.addEventListener('change',setMode);addBtn.addEventListener('click',addRow);
  rows.addEventListener('input',recompute);rows.addEventListener('change',recompute);rows.addEventListener('click',e=>{const b=e.target.closest('[data-remove-lot]');if(!b)return;b.closest('.position-lot')?.remove();if(!rows.children.length)addRow();recompute()});
  if(holdResult)new MutationObserver(stampProvenance).observe(holdResult,{subtree:true,childList:true});
  window.StockLabPositionInput={collect,recompute,mode:()=>mode.value,stampProvenance};
  setMode();
})();
