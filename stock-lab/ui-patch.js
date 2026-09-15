// UX patch: allow ticker or company-name search and standardize price labels.
(function(){
  const input=document.querySelector('#ticker'),btn=document.querySelector('#analyzeBtn');
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
  function relabel(root=document){
    root.querySelectorAll('.source-note b').forEach(el=>{if(el.textContent.trim()==='入場價格區間')el.textContent='建議入場價格區間';});
    root.querySelectorAll('.kpi span').forEach(el=>{const t=el.textContent.trim();if(t==='收盤')el.textContent='現在價格';else if(t==='進場區')el.textContent='建議入場價格區間';});
    root.querySelectorAll('.mini').forEach(el=>{if(el.textContent.includes('收盤 '))el.textContent=el.textContent.replace('收盤 ','現在價格 ');});
  }
  const observer=new MutationObserver(()=>relabel());observer.observe(document.body,{subtree:true,childList:true});relabel();
})();
