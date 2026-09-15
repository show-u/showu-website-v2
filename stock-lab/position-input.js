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
  const buyDate=document.querySelector('#holdBuyDate');
  if(!mode||!manual||!lotsBox||!rows||!addBtn||!summary||!avgCost||!shares||!buyDate)return;

  let seq=0;
  const num=v=>{const s=String(v??'').trim().replace(/,/g,'');if(!s)return null;const x=Number(s);return Number.isFinite(x)?x:null};
  const money=x=>Number(x).toLocaleString('zh-TW',{maximumFractionDigits:4});
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function rowTemplate(){
    const id=++seq;
    return `<div class="sourceitem position-lot" data-lot-id="${id}"><div class="grid"><label>買入日<input type="date" data-lot-date></label><label>買入價格<input inputmode="decimal" data-lot-price placeholder="例如：4380"></label><label>目前仍持有股數<input inputmode="numeric" data-lot-shares placeholder="例如：500"></label><label>備註（選填）<input data-lot-note placeholder="例如：第一批"></label></div><button type="button" class="ghost" data-remove-lot style="margin-top:8px">刪除此筆</button></div>`;
  }
  function addRow(){rows.insertAdjacentHTML('beforeend',rowTemplate());recompute()}
  function lotRows(){return[...rows.querySelectorAll('.position-lot')].map(el=>({el,date:el.querySelector('[data-lot-date]')?.value||'',price:num(el.querySelector('[data-lot-price]')?.value),shares:num(el.querySelector('[data-lot-shares]')?.value),note:el.querySelector('[data-lot-note]')?.value||''}))}
  function recompute(){
    if(mode.value!=='lots'){summary.innerHTML='<b>逐筆明細未啟用</b><div class="mini">目前以你輸入的券商總均價、目前持股數與首次買入日為準。</div>';return}
    const all=lotRows(),used=all.filter(x=>x.date||x.price!=null||x.shares!=null||x.note.trim());
    if(!used.length){avgCost.value='';shares.value='';buyDate.value='';summary.innerHTML='<b>尚未輸入買入明細</b><div class="mini">逐筆模式不會自動猜測任何成本或日期。</div>';return}
    const incomplete=used.filter(x=>!x.date||!(x.price>0)||!(x.shares>0));
    if(incomplete.length){avgCost.value='';shares.value='';buyDate.value='';summary.innerHTML='<b class="bad">買入明細不完整</b><div class="mini">每一筆已使用的明細都必須有買入日、正數買入價格與目前仍持有股數。缺值不補 0。</div>';return}
    const totalShares=used.reduce((s,x)=>s+x.shares,0),totalCost=used.reduce((s,x)=>s+x.price*x.shares,0),weighted=totalShares?totalCost/totalShares:null,dates=used.map(x=>x.date).sort();
    if(!(totalShares>0)||!(weighted>0)){avgCost.value='';shares.value='';buyDate.value='';summary.innerHTML='<b class="bad">明細無法形成有效部位</b>';return}
    avgCost.value=String(+weighted.toFixed(4));shares.value=String(+totalShares.toFixed(4));buyDate.value=dates[0]||'';
    summary.innerHTML=`<b>逐筆明細計算結果</b><div class="mini">目前仍持有 ${money(totalShares)} 股｜輸入成本合計 ${money(totalCost)}｜加權均價 ${money(weighted)}｜最早買入日 ${esc(dates[0])}<br>以上全部來自你的輸入，不是市場推估；未含你未輸入的手續費、交易稅、股利或已賣出部位。</div>`;
  }
  function setMode(){const lots=mode.value==='lots';manual.classList.toggle('hidden',lots);lotsBox.classList.toggle('hidden',!lots);if(lots&&!rows.children.length)addRow();recompute()}
  function collect(){
    if(mode.value==='manual'){
      const a=num(avgCost.value),s=num(shares.value),d=buyDate.value||null;if(!(a>0)||!(s>0))throw Error('請輸入有效的券商總均價與目前持有股數');
      return{mode:'manual',averageCost:a,shares:s,buyDate:d,lots:null,provenance:{averageCost:'user_observed',shares:'user_observed',buyDate:d?'user_observed':'unavailable'}};
    }
    recompute();const a=num(avgCost.value),s=num(shares.value),d=buyDate.value||null;if(!(a>0)||!(s>0)||!d)throw Error('逐筆買入明細尚未完整');
    const lots=lotRows().filter(x=>x.date&&x.price>0&&x.shares>0).map(x=>({date:x.date,price:x.price,shares:x.shares,note:x.note||null,provenance:'user_observed'}));
    return{mode:'lots',averageCost:a,shares:s,buyDate:d,lots,provenance:{averageCost:'derived_from_user_lots',shares:'derived_from_user_lots',buyDate:'derived_from_user_lots'}};
  }

  mode.addEventListener('change',setMode);addBtn.addEventListener('click',addRow);
  rows.addEventListener('input',recompute);rows.addEventListener('change',recompute);rows.addEventListener('click',e=>{const b=e.target.closest('[data-remove-lot]');if(!b)return;b.closest('.position-lot')?.remove();if(!rows.children.length)addRow();recompute()});
  window.StockLabPositionInput={collect,recompute,mode:()=>mode.value};
  setMode();
})();
