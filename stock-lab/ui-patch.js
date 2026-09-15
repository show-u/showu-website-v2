// UX patch: three-way navigation plus exact-schema ticker/company-name resolution.
(function(){
  const input=document.querySelector('#ticker'),btn=document.querySelector('#analyzeBtn'),horizon=document.querySelector('#horizon');
  const holdInput=document.querySelector('#holdTicker'),holdAnalyze=document.querySelector('#holdAnalyzeBtn');
  const singleBtn=document.querySelector('#singleBtn'),findBtn=document.querySelector('#findBtn'),holdBtn=document.querySelector('#holdBtn');
  const singlePanel=document.querySelector('#singlePanel'),findPanel=document.querySelector('#findPanel'),holdPanel=document.querySelector('#holdPanel');
  if(singleBtn&&findBtn&&holdBtn&&singlePanel&&findPanel&&holdPanel){
    const allButtons=[findBtn,singleBtn,holdBtn],allPanels=[findPanel,singlePanel,holdPanel];
    const activate=(button,panel)=>{allPanels.forEach(x=>x.classList.add('hidden'));allButtons.forEach(x=>x.classList.add('ghost'));panel.classList.remove('hidden');button.classList.remove('ghost')};
    const showSingle=()=>{activate(singleBtn,singlePanel);input?.focus()};
    const showFind=()=>activate(findBtn,findPanel);
    const showHold=()=>{activate(holdBtn,holdPanel);holdInput?.focus()};
    singleBtn.addEventListener('click',showSingle);findBtn.addEventListener('click',showFind);holdBtn.addEventListener('click',showHold);
    if(horizon)horizon.value='buy';showFind();
  }
  let cachePromise=null;
  const norm=s=>String(s||'').trim().replace(/\s+/g,'').toLowerCase();
  const has=(o,k)=>o&&Object.prototype.hasOwnProperty.call(o,k);
  async function loadUniverse(){
    if(cachePromise)return cachePromise;
    cachePromise=fetch('./browser-data.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('股票名稱索引暫時無法讀取');return r.json()}).then(x=>{
      if(x.schema_version!==2||x.source!=='licensed-open-data-cache'||!String(x.licence||'').includes('OGDL'))throw Error('股票名稱索引授權／版本驗證未通過');
      const d=x.datasets||{},out=[];
      for(const r of d.twse_snapshot||[]){if(!has(r,'Code')||!has(r,'Name'))throw Error('TWSE 股票名稱索引 schema 不符');const code=String(r.Code).trim(),name=String(r.Name).trim();if(code&&name)out.push({code,name,market:'TWSE'})}
      for(const r of d.tpex_snapshot||[]){if(!has(r,'SecuritiesCompanyCode')||!has(r,'CompanyName'))throw Error('TPEx 股票名稱索引 schema 不符');const code=String(r.SecuritiesCompanyCode).trim(),name=String(r.CompanyName).trim();if(code&&name)out.push({code,name,market:'TPEx'})}
      return out;
    }).catch(e=>{cachePromise=null;throw e});return cachePromise;
  }
  async function resolveQuery(q){
    q=String(q||'').trim();if(/^\d{4,6}$/.test(q))return q;if(!q)throw Error('請輸入股票代號或名稱');
    const u=await loadUniverse(),nq=norm(q);let m=u.find(x=>norm(x.name)===nq);
    if(!m){const partial=u.filter(x=>norm(x.name).includes(nq));if(partial.length===1)m=partial[0];else if(partial.length>1)throw Error(`找到多個相近名稱：${partial.slice(0,5).map(x=>`${x.name} ${x.code}`).join('、')}，請輸入更完整名稱或代號`)}
    if(!m)throw Error('合法公開資料中找不到這個股票名稱或代號');return m.code;
  }
  if(input&&btn){const original=btn.onclick;btn.onclick=async function(ev){try{input.value=await resolveQuery(input.value)}catch(e){alert(e.message);return}return original&&original.call(this,ev)}}
  if(holdInput&&holdAnalyze){holdAnalyze.addEventListener('click',async()=>{try{holdInput.value=await resolveQuery(holdInput.value)}catch(e){alert(e.message)}} ,true)}
  const observer=new MutationObserver(()=>{document.querySelector('#result [data-price-summary]')?.remove();document.querySelectorAll('#top10 .item').forEach(item=>item.querySelectorAll('.mini').forEach(el=>{if(el.textContent.includes('收盤 '))el.textContent=el.textContent.replace('收盤 ','最新官方收盤 ')}))});
  observer.observe(document.body,{subtree:true,childList:true});
})();
