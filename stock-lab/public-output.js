// Final public-output controller for entry/scanner fallback only.
// Existing-position management is owned exclusively by holding-router.js and must never be OOS-locked here.
(function(){
  const rt=window.STOCKLAB_RUNTIME||{};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{if(v==null)return null;const s=String(v).trim().replace(/,/g,'');if(!s||['-','--','—','N/A','NA','null','undefined'].includes(s))return null;const x=Number(s);return Number.isFinite(x)?x:null};
  const money=x=>x==null?'—':Number(x).toLocaleString('zh-TW',{maximumFractionDigits:2});
  const pick=(o,keys)=>{for(const k of keys)if(o&&o[k]!=null&&String(o[k]).trim()!=='')return o[k];return null};
  const ready=()=>window.StockLabAPI?.config?.enabled===true||rt.productionPredictionReady===true;

  function normalizeTradeDate(v){
    const s=String(v??'').trim();let m;
    if((m=s.match(/^(\d{4})[-\/]?(\d{2})[-\/]?(\d{2})$/)))return`${m[1]}-${m[2]}-${m[3]}`;
    if((m=s.match(/^(\d{3})[-\/]?(\d{2})[-\/]?(\d{2})$/)))return`${Number(m[1])+1911}-${m[2]}-${m[3]}`;
    return null;
  }
  function taipeiToday(){const p={};for(const x of new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()))p[x.type]=x.value;return`${p.year}-${p.month}-${p.day}`}
  function dateAgeDays(iso){const t=new Date(`${iso}T00:00:00+08:00`).getTime(),n=new Date(`${taipeiToday()}T00:00:00+08:00`).getTime();return Number.isFinite(t)&&Number.isFinite(n)?Math.floor((n-t)/86400000):9999}
  function conciseBlock(title,base,detail){return `<div class=toprow><div><h2>${esc(title)}</h2><div class=muted>${esc(base)}</div></div></div><div class=source-note><b class=bad>暫不提供數字建議</b><div class=mini>${esc(detail)}</div></div><div class=disclaimer><b>資料規則</b>必要資料、合法性、正式樣本外驗證或信心校準有任何一項未通過，就不產生入場價格與信心指數，也不以舊值、0、平均值、其他網站或 AI 補值。</div>`}

  async function observation(q){
    const resolver=window.StockLabTickerResolver;if(!resolver?.resolve)throw Error('股票索引尚未通過驗證');
    const code=await resolver.resolve(q),src=window.StockLabSameOrigin;
    if(!src?.latest)throw Error('合法市場事實介面尚未初始化');
    const row=await src.latest(code),close=num(row.close),date=normalizeTradeDate(row.date),age=date?dateAgeDays(date):9999;
    if(!(close>0))throw Error('最新合法收盤資料未取得／未通過驗證');
    if(!date)throw Error('收盤資料缺少可驗證交易日期；禁止當成最新資料');
    if(age<0||age>4)throw Error(`最新合法市場事實過舊：${date}；不把舊資料冒充目前行情`);
    let session={verified:false,state:'SESSION_GATE_UNAVAILABLE',label:'交易時段／下一交易日尚未驗證'};
    try{if(window.StockLabSessionContext?.resolve)session=await window.StockLabSessionContext.resolve({market:row.market,dataDate:date})}catch(e){session={verified:false,state:'SESSION_GATE_ERROR',label:`交易時段驗證失敗：${e.message||e}`}}
    return{code,name:row.name,market:row.market,close,date,ageDays:age,session,provenance:'observed_close',sourceId:row.source_id,licence:row.licence};
  }
  function sessionHtml(s){const label=s?.label||'交易時段未驗證',bad=s?.verified===false||s?.state==='WAITING_TODAY_CLOSE_DATA';return `<div class=source-note><b${bad?' class=bad':''}>交易時段／資料截點</b><div class=mini>${esc(label)}</div></div>`}

  const analyze=document.querySelector('#analyzeBtn');
  if(analyze){const original=analyze.onclick;analyze.onclick=async function(ev){
    if(ready()||rt.ruleBasedEntryReferenceEnabled===true)return original?.call(this,ev);
    const box=document.querySelector('#result');try{const x=await observation(document.querySelector('#ticker')?.value);box.innerHTML=`<div class=toprow><div><h2>${esc(x.name)}／${esc(x.code)}</h2><div class=muted>${esc(x.market)}｜想買這檔</div><div class=mini>最新已驗證收盤 ${esc(x.date)}｜${money(x.close)}｜非盤中即時價</div></div></div>${sessionHtml(x.session)}<div class=source-note><b class=bad>暫不提供進場區間與信心指數</b><div class=mini>完整入場模型仍有必要資料／OOS／信心校準 Gate 未通過。若今日已收盤但官方資料日尚未前進，系統會等待今日收盤資料，不會用昨日資料建立明日價格。</div></div>`}catch(e){box.innerHTML=conciseBlock('想買這檔','資料驗證未完成',e.message||String(e))}box.classList.remove('hidden')
  }}

  const scan=document.querySelector('#scanBtn');
  if(scan){const original=scan.onclick;scan.onclick=async function(ev){if(ready()||rt.sectorResearchEnabled===true)return original?.call(this,ev);const box=document.querySelector('#top10');box.innerHTML=conciseBlock('入場候選 TOP 10','正式排名尚未開放','每一檔候選都必須先通過相同的完整入場模型、正式 OOS 與信心校準；合格不足 10 檔也不補滿。');box.classList.remove('hidden')}}

  // IMPORTANT: no holdAnalyzeBtn override here. holding-router.js owns existing-position analysis.
  window.StockLabPublicOutput={productionReady:ready,observation,normalizeTradeDate,dateAgeDays,sessionHtml};
})();
