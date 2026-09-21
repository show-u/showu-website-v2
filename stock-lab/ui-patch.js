// UX: three-way navigation plus exact-schema ticker/company-name resolution.
(function(){
  const input=document.querySelector('#ticker'),btn=document.querySelector('#analyzeBtn');
  const holdInput=document.querySelector('#holdTicker');
  const singleBtn=document.querySelector('#singleBtn'),findBtn=document.querySelector('#findBtn'),holdBtn=document.querySelector('#holdBtn');
  const singlePanel=document.querySelector('#singlePanel'),findPanel=document.querySelector('#findPanel'),holdPanel=document.querySelector('#holdPanel');
  const entryResult=document.querySelector('#result'),scanResult=document.querySelector('#top10');
  if(singleBtn&&findBtn&&holdBtn&&singlePanel&&findPanel&&holdPanel){
    const allButtons=[findBtn,singleBtn,holdBtn],allPanels=[findPanel,singlePanel,holdPanel];
    const activate=(button,panel)=>{
      allPanels.forEach(x=>x.classList.add('hidden'));
      allButtons.forEach(x=>x.classList.add('ghost'));
      panel.classList.remove('hidden');
      button.classList.remove('ghost');
    };
    const hideStale=()=>{entryResult?.classList.add('hidden');scanResult?.classList.add('hidden')};
    const showSingle=()=>{
      activate(singleBtn,singlePanel);hideStale();
      if(input&&holdInput&& !input.value.trim() && holdInput.value.trim()) input.value=holdInput.value.trim();
      input?.focus();
    };
    const showFind=()=>{activate(findBtn,findPanel);hideStale()};
    const showHold=()=>{
      activate(holdBtn,holdPanel);hideStale();
      if(holdInput&&input&& !holdInput.value.trim() && input.value.trim()) holdInput.value=input.value.trim();
      holdInput?.focus();
    };
    singleBtn.addEventListener('click',showSingle);
    findBtn.addEventListener('click',showFind);
    holdBtn.addEventListener('click',showHold);
    // Holding management is the default route. Entry analysis must never remain visible behind it.
    showHold();
  }
  let cachePromise=null;
  const norm=s=>String(s||'').trim().replace(/\s+/g,'').toLowerCase();
  async function loadUniverse(){
    if(cachePromise)return cachePromise;
    cachePromise=(async()=>{
      const src=window.StockLabSameOrigin;
      if(!src?.universe)throw Error('合法股票名稱索引尚未初始化');
      const out=await src.universe();
      if(!Array.isArray(out)||!out.length)throw Error('合法股票名稱索引沒有可用資料');
      for(const r of out)if(!r?.code||!r?.name||!['TWSE','TPEx'].includes(r.market))throw Error('股票名稱索引 schema 不符');
      return out;
    })().catch(e=>{cachePromise=null;throw e});
    return cachePromise;
  }
  async function resolveQuery(q){
    q=String(q||'').trim();if(/^\d{4,6}$/.test(q))return q;if(!q)throw Error('請輸入股票代號或名稱');
    const u=await loadUniverse(),nq=norm(q);let m=u.find(x=>norm(x.name)===nq);
    if(!m){const partial=u.filter(x=>norm(x.name).includes(nq));if(partial.length===1)m=partial[0];else if(partial.length>1)throw Error(`找到多個相近名稱：${partial.slice(0,5).map(x=>`${x.name} ${x.code}`).join('、')}，請輸入更完整名稱或代號`)}
    if(!m)throw Error('合法公開資料中找不到這個股票名稱或代號');return m.code;
  }
  if(input&&btn){
    const original=btn.onclick;
    btn.onclick=async function(ev){
      try{input.value=await resolveQuery(input.value)}catch(e){alert(e.message);return}
      return original&&original.call(this,ev)
    };
  }
  window.StockLabTickerResolver={resolve:resolveQuery,loadUniverse};
  const observer=new MutationObserver(()=>{
    document.querySelector('#result [data-price-summary]')?.remove();
    document.querySelectorAll('#top10 .item').forEach(item=>item.querySelectorAll('.mini').forEach(el=>{if(el.textContent.includes('收盤 '))el.textContent=el.textContent.replace('收盤 ','最新官方收盤 ')}));
  });
  observer.observe(document.body,{subtree:true,childList:true});
})();