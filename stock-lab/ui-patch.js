// UX patch: tab switching, ticker/company-name search, plus explicit price presentation.
(function(){
  const input=document.querySelector('#ticker'),btn=document.querySelector('#analyzeBtn');
  const singleBtn=document.querySelector('#singleBtn'),findBtn=document.querySelector('#findBtn');
  const singlePanel=document.querySelector('#singlePanel'),findPanel=document.querySelector('#findPanel');
  if(singleBtn&&findBtn&&singlePanel&&findPanel){
    const showSingle=()=>{singlePanel.classList.remove('hidden');findPanel.classList.add('hidden');singleBtn.classList.remove('ghost');findBtn.classList.add('ghost');input?.focus();};
    const showFind=()=>{findPanel.classList.remove('hidden');singlePanel.classList.add('hidden');findBtn.classList.remove('ghost');singleBtn.classList.add('ghost');};
    singleBtn.addEventListener('click',showSingle);
    findBtn.addEventListener('click',showFind);
    // Stock search is the primary entry because the five-price model is a single-stock decision tool.
    showSingle();
  }
  if(!input||!btn)return;
  let cachePromise=null;
  const norm=s=>String(s||'').trim().replace(/\s+/g,'').toLowerCase();
  function pick(o,keys){for(const k of keys){if(o&&o[k]!=null&&String(o[k]).trim()!=='')return o[k]}return null}
  async function loadUniverse(){
    if(cachePromise)return cachePromise;
    cachePromise=fetch('./browser-data.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('股票名稱索引暫時無法讀取');return r.json()}).then(x=>{
      const d=x.datasets||{},out=[];
      for(const r of d.twse_snapshot||[]){const code=String(r.Code||'').trim(),name=String(r.Name||'').trim();if(code&&name)out.push({code,name,market:'TWSE'});}
      for(const r of d.tpex_snapshot||[]){const code=String(pick(r,['SecuritiesCompanyCode','Code','證券代號','代號'])||'').trim(),name=String(pick(r,['CompanyName','SecuritiesCompanyName','Name','證券名稱','名稱'])||'').trim();if(code&&name)out.push({code,name,market:'TPEx'});}
      return out;
    });
    return cachePromise;
  }
  async function resolveQuery(q){
    q=String(q||'').trim();
    if(/^\d{4,6}$/.test(q))return q;
    const u=await loadUniverse(),nq=norm(q);
    let m=u.find(x=>norm(x.name)===nq);
    if(!m){const partial=u.filter(x=>norm(x.name).includes(nq));if(partial.length===1)m=partial[0];else if(partial.length>1)throw Error(`找到多個相近名稱：${partial.slice(0,5).map(x=>`${x.name} ${x.code}`).join('、')}，請輸入更完整名稱或股票代號`);}
    if(!m)throw Error('找不到這個股票名稱或代號');
    return m.code;
  }
  const original=btn.onclick;
  btn.onclick=async function(ev){
    try{input.value=await resolveQuery(input.value);}catch(e){alert(e.message);return;}
    return original&&original.call(this,ev);
  };
  function ensureSinglePriceSummary(){
    const box=document.querySelector('#result');
    if(!box||box.classList.contains('hidden')||box.querySelector('.bad'))return;
    // Pre-open owns the complete five-price matrix. Never overlay it with the legacy generic summary.
    if(box.querySelector('[data-five-price-matrix]')||/開盤前｜當日掛單價格/.test(box.textContent||'')){
      box.querySelector('[data-price-summary]')?.remove();
      return;
    }
    let summary=box.querySelector('[data-price-summary]');
    const entryNode=[...box.querySelectorAll('.source-note b')].find(el=>/入場價格區間/.test(el.textContent));
    const entry=entryNode?.parentElement?.querySelector('div')?.textContent?.trim()||'—';
    const kpis=[...box.querySelectorAll('.kpi')];
    const closeKpi=kpis.find(k=>/^(收盤|現在價格|最新官方收盤價)$/.test(k.querySelector('span')?.textContent?.trim()||''));
    const close=closeKpi?.querySelector('b')?.textContent?.trim()||'—';
    const date=(box.querySelector('.sourceitem .mini')?.textContent||box.querySelector('.toprow .muted')?.textContent||'').trim();
    if(!summary){summary=document.createElement('div');summary.dataset.priceSummary='1';summary.className='sourcegrid';summary.style.marginTop='14px';const top=box.querySelector('.toprow');(top||box.firstChild)?.after?.(summary);if(!summary.parentNode)box.prepend(summary)}
    summary.innerHTML=`<div class="sourceitem"><b>現在價格</b><div style="font-size:24px;font-weight:900;margin-top:4px">—</div><span class="mini">即時行情尚未接入，避免以昨日收盤價冒充現在價格</span></div><div class="sourceitem"><b>建議入場價格區間</b><div style="font-size:24px;font-weight:900;margin-top:4px">${entry}</div><span class="mini">依最新已驗證日線、支撐壓力與投資週期計算</span></div><div class="sourceitem"><b>最新官方收盤價</b><div style="font-size:20px;font-weight:900;margin-top:4px">${close}</div><span class="mini">${date||'最近交易日'}</span></div>`;
    if(entryNode)entryNode.textContent='建議入場價格區間';
    if(closeKpi){const s=closeKpi.querySelector('span');if(s)s.textContent='最新官方收盤價'}
  }
  function relabelTop10(){document.querySelectorAll('#top10 .item').forEach(item=>{item.querySelectorAll('b').forEach(el=>{if(el.textContent.includes('入場價格區間：'))el.textContent=el.textContent.replace('入場價格區間：','建議入場價格區間：')});item.querySelectorAll('.mini').forEach(el=>{if(el.textContent.includes('收盤 '))el.textContent=el.textContent.replace('收盤 ','最新官方收盤價 ')})})}
  function relabel(){ensureSinglePriceSummary();relabelTop10()}
  const observer=new MutationObserver(()=>relabel());observer.observe(document.body,{subtree:true,childList:true});relabel();
})();
