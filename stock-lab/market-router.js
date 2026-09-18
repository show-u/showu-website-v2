// Single-stock entry research router.
// Free official rule-based entry reference is NOT a predictive/live executable price.
// Predictive executable entry remains separately gated behind productionPredictionReady.
(function(){
  const btn=document.querySelector('#analyzeBtn'),input=document.querySelector('#ticker'),load=document.querySelector('#singleLoad'),box=document.querySelector('#result');
  if(!btn||!input||!load||!box)return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{const x=Number(String(v??'').replace(/,/g,''));return Number.isFinite(x)?x:null};
  const money=x=>Number.isFinite(Number(x))?Number(x).toLocaleString('zh-TW',{maximumFractionDigits:2}):'—';
  const pct=x=>Number.isFinite(Number(x))?((Number(x)>=0?'+':'')+Number(x).toFixed(2)+'%'):'—';

  async function snapshot(code){
    const cache=window.StockLabSameOrigin;
    if(!cache?.latest)throw Error('合法 OGDL 市場事實層尚未就緒');
    const row=await cache.latest(code);
    if(!row||row.provenance!=='observed'||row.licence!=='OGDL-1.0')throw Error('市場事實來源授權／驗證未通過');
    for(const k of ['open','high','low','close'])if(!(num(row[k])>0))throw Error('最新完成交易日 '+k+' 未通過驗證');
    return row;
  }
  async function factor(code,market){
    try{
      await window.StockLabTaiwan?.loadFactors?.();
      const f=window.StockLabTaiwan?.stockFactor?.(code)||{};
      const r=window.StockLabTaiwan?.riskState?.(code,market)||{};
      return{factor:f,risk:r};
    }catch{return{factor:{},risk:{flags:['台股風險狀態未完整驗證']}}}
  }
  function commonStock(code,f){return /^\d{4}$/.test(String(code))&&!String(code).startsWith('00')&&!!String(f?.industry||'').trim()}
  function sessionAverage(r){const v=num(r.volume),a=num(r.trade_value);return v>0&&a>0?a/v:null}
  function render(code,r,f,risk){
    const op=num(r.open),hi=num(r.high),lo=num(r.low),cl=num(r.close),avg=sessionAverage(r);
    if(!commonStock(code,f))throw Error('目前規則式入場參考只支援可驗證產業別的台灣普通股');
    if(risk?.riskBlocked===true)throw Error('此股票目前有已驗證處置／交易風險旗標，不提供一般入場參考價');
    if(!(avg>0))throw Error('成交金額／成交股數不足，無法計算完成交易日成交均價');
    const round=window.StockLabTaiwan?.roundTick||((x)=>x);
    const entry=round(Math.min(cl,avg),'down');
    const invalid=round(lo,'down');
    const dayRet=(cl/op-1)*100;
    const loc=hi>lo?(cl-lo)/(hi-lo):0.5;
    const reasons=[
      '最新完成交易日 '+r.date+' 收盤 '+money(cl)+'，相對開盤 '+pct(dayRet),
      '該日成交均價約 '+money(avg)+'；建議參考價取「收盤與成交均價較低者」並向下對齊台股跳動單位，避免追在完成交易日平均成交成本之上',
      '收盤位於當日高低區間約 '+Math.round(loc*100)+'% 位置；'+(loc>=0.7?'收盤位置偏強':'未形成明顯強勢收盤，因此更不宜追高')
    ];
    const riskText=(risk?.flags||[]).join('；')||'風險狀態未完整驗證';
    const title=esc(r.name?(r.name+'／'+code):code);
    const reasonsHtml=reasons.map(x=>'<li>'+esc(x)+'</li>').join('');
    box.innerHTML=
      '<div class="toprow"><div><h2>'+title+'</h2><div class="muted">想買這檔｜規則式入場研究</div></div></div>'+
      '<div class="source-note"><div class="hero-label">建議入場參考價</div><div class="hero-number">'+money(entry)+'</div><div class="mini">依 '+esc(r.date)+' 最新完成交易日官方 OGDL 資料計算；不是盤中即時價、不是預測保證價。</div></div>'+
      '<div class="sourcegrid" style="margin-top:10px">'+
        '<div class="sourceitem"><b>開／高／低／收</b>'+money(op)+'／'+money(hi)+'／'+money(lo)+'／'+money(cl)+'</div>'+
        '<div class="sourceitem"><b>完成交易日成交均價</b>'+money(avg)+'<br><span class="mini">成交金額 ÷ 成交股數</span></div>'+
        '<div class="sourceitem"><b>失效／防守參考</b>'+money(invalid)+'<br><span class="mini">上一完成交易日低點；跌破後重新評估，不是保證停損價</span></div>'+
        '<div class="sourceitem"><b>產業別代碼</b>'+esc(f.industry||'—')+'</div>'+
      '</div>'+
      '<div class="source-note"><b>判斷理由</b><ol style="margin:8px 0 0;padding-left:20px">'+reasonsHtml+'</ol></div>'+
      '<div class="source-note"><b>風險狀態</b><div class="mini">'+esc(riskText)+'</div></div>'+
      '<div class="disclaimer"><b>使用方式</b>這是由最新完成交易日官方事實推導的規則式「不追高」參考價，不代表下一交易日一定會成交或上漲。沒有合法即時／延遲行情時，盤中不會用舊收盤冒充現在價格；正式預測型可執行買價仍須另行通過 OOS、交易日曆、公司行動與執行可達性 Gate。</div>';
    box.classList.remove('hidden');
  }
  btn.onclick=async()=>{
    load.classList.remove('hidden');box.classList.remove('hidden');box.innerHTML='';
    try{
      const resolver=window.StockLabTickerResolver;
      if(!resolver?.resolve)throw Error('股票代號／名稱解析器尚未就緒');
      const code=await resolver.resolve(input.value);input.value=code;
      const r=await snapshot(code),x=await factor(code,r.market);
      render(code,r,x.factor,x.risk);
    }catch(e){
      box.innerHTML='<h3 class="bad">無法產生入場參考價</h3><p>'+esc(e.message||e)+'</p><div class="mini">缺少資料維持缺少，不以假資料補值。</div>';
    }finally{load.classList.add('hidden')}
  };
})();
