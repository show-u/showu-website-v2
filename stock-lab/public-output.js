// Final public-output controller. Loaded after compliance-gate.
// It keeps the page concise while preserving fail-closed behavior.
(function(){
  const rt=window.STOCKLAB_RUNTIME||{};
  const MISSING='資料未取得／未通過驗證';
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
  function conciseBlock(title,base,detail){return `<div class=toprow><div><h2>${esc(title)}</h2><div class=muted>${esc(base)}</div></div></div><div class=source-note><b class=bad>暫不提供數字建議</b><div class=mini>${esc(detail)}</div></div><div class=disclaimer><b>資料規則</b>必要資料、合法性、正式樣本外驗證或信心校準有任何一項未通過，就不產生進出場價格與信心指數，也不以舊值、0、平均值、其他網站或 AI 補值。</div>`}
  async function observation(q){
    const resolver=window.StockLabTickerResolver;if(!resolver?.resolve||!resolver?.loadUniverse)throw Error('股票索引尚未通過驗證');
    const code=await resolver.resolve(q),u=await resolver.loadUniverse(),meta=u.find(x=>x.code===code);if(!meta)throw Error('合法股票索引找不到此標的');
    const c=await window.StockLabSameOrigin?.loadCache?.();if(!c)throw Error('合法公開資料快取尚未通過驗證');
    const d=c.datasets||{};let row=null,close=null,dateRaw=null;
    if(meta.market==='TWSE'){
      row=(d.twse_snapshot||[]).find(x=>String(x.Code||'').trim()===code);close=num(row?.ClosingPrice);dateRaw=row?.Date;
    }else{
      row=(d.tpex_snapshot||[]).find(x=>String(pick(x,['SecuritiesCompanyCode','Code','證券代號'])||'').trim()===code);close=num(pick(row,['Close','ClosingPrice','收盤價','收盤']));dateRaw=pick(row,['Date','日期']);
    }
    const date=normalizeTradeDate(dateRaw),age=date?dateAgeDays(date):9999;
    if(!row||!(close>0))throw Error('最新合法收盤資料未取得／未通過驗證');
    if(!date)throw Error('收盤資料缺少可驗證交易日期；禁止當成最新資料');
    if(age<0||age>4)throw Error(`收盤資料日期過舊或異常：${date}；禁止當成目前資料`);
    let session={verified:false,state:'SESSION_GATE_UNAVAILABLE',label:'交易時段／下一交易日尚未驗證'};
    try{if(window.StockLabSessionContext?.resolve)session=await window.StockLabSessionContext.resolve({market:meta.market,dataDate:date})}catch(e){session={verified:false,state:'SESSION_GATE_ERROR',label:`交易時段驗證失敗：${e.message||e}`}}
    return{code,name:meta.name,market:meta.market,close,date,ageDays:age,session,provenance:'observed_close'};
  }
  async function historyReadiness(){
    const r=await fetch('./history-ogdl/manifest.json',{cache:'no-store'});if(!r.ok)throw Error('合法歷史資料準備度尚未取得');
    const m=await r.json();if(m.schema_version!==1||m.source_class!=='ogdl_daily_archive'||m.licence!=='OGDL-1.0'||m.no_imputation!==true)throw Error('合法歷史資料準備度驗證未通過');
    const q=m.coverage_metrics||{},o=q.overall||{},holdingMin=Number(q.holding_exit_minimum_valid_bars)||120,entryMin=Number(q.entry_minimum_valid_bars)||60;
    return{firstDate:m.first_date||null,lastDate:m.last_date||null,entryMin,holdingMin,maxBars:Number(o.max_valid_bars_per_security)||0,securities:Number(o.securities)||0,securitiesEntry:Number(o.securities_at_least_60_bars)||0,securitiesHolding:Number(o.securities_at_least_120_bars)||0,historyOnly:q.thresholds_are_history_only===true,noOosPass:q.does_not_imply_model_oos_pass===true};
  }
  function historyHtml(h,buyDate){
    if(!h)return `<div class=source-note><b>合法歷史資料準備度</b><div class=mini>${MISSING}</div></div>`;
    const before=!!(buyDate&&h.firstDate&&buyDate<h.firstDate),max=Math.min(h.maxBars,h.holdingMin),ratio=h.holdingMin?Math.min(100,Math.round(max/h.holdingMin*100)):0;
    const buyWarning=before?`<br><b class=bad>你的首次買入日 ${esc(buyDate)} 早於目前合法歷史起點 ${esc(h.firstDate)}。</b> 未取得有明確授權的歷史回補前，不能重建自買入日起的完整持股路徑；單靠未來每天累積也不會補回這段過去資料。`:'';
    return `<div class=source-note><b>合法歷史資料準備度｜只代表資料量，不代表模型已通過</b><div class=mini>目前合法 OGDL 歷史 ${esc(h.firstDate||'—')}～${esc(h.lastDate||'—')}；全庫單一標的最多 ${money(h.maxBars)}/${money(h.holdingMin)} 根有效日線（約 ${ratio}% 的最低持股歷史門檻）；達到 ${money(h.holdingMin)} 根的標的 ${money(h.securitiesHolding)}/${money(h.securities)}。<br>即使日線數達標，仍需另外通過正式 OOS、出場可執行性、公司行動／注意處置與信心校準，才可解鎖出場建議。${buyWarning}</div></div>`;
  }
  function sessionHtml(s){const label=s?.label||'交易時段未驗證',bad=s?.verified===false||s?.state==='WAITING_TODAY_CLOSE_DATA';return `<div class=source-note><b${bad?' class=bad':''}>交易時段／資料截點</b><div class=mini>${esc(label)}</div></div>`}
  const analyze=document.querySelector('#analyzeBtn');
  if(analyze){const original=analyze.onclick;analyze.onclick=async function(ev){
    if(ready())return original?.call(this,ev);
    const box=document.querySelector('#result');try{const x=await observation(document.querySelector('#ticker')?.value);box.innerHTML=`<div class=toprow><div><h2>${esc(x.name)}／${esc(x.code)}</h2><div class=muted>${esc(x.market)}｜想買這檔</div><div class=mini>最新已驗證收盤 ${esc(x.date)}｜${money(x.close)}｜非盤中即時價</div></div></div>${sessionHtml(x.session)}<div class=source-note><b class=bad>暫不提供進場區間與信心指數</b><div class=mini>完整入場模型仍有必要資料／OOS／信心校準 Gate 未通過。若今日已收盤但官方資料日尚未前進，系統會等待今日收盤資料，不會用昨日資料建立明日價格。</div></div>`}catch(e){box.innerHTML=conciseBlock('想買這檔','資料驗證未完成',e.message||String(e))}box.classList.remove('hidden')
  }}
  const scan=document.querySelector('#scanBtn');
  if(scan){const original=scan.onclick;scan.onclick=async function(ev){if(ready())return original?.call(this,ev);const box=document.querySelector('#top10');box.innerHTML=conciseBlock('入場候選 TOP 10','正式排名尚未開放','每一檔候選都必須先通過相同的完整入場模型、正式 OOS 與信心校準；合格不足 10 檔也不補滿。');box.classList.remove('hidden')}}
  const hold=document.querySelector('#holdAnalyzeBtn');
  if(hold){const original=hold.onclick;hold.onclick=async function(ev){
    if(ready())return original?.call(this,ev);
    const box=document.querySelector('#holdResult');try{
      const resolver=window.StockLabTickerResolver,x=await observation(document.querySelector('#holdTicker')?.value),p=window.StockLabPositionInput?.collect?.();if(!resolver||!p)throw Error('持股輸入尚未完成');
      const totalCost=p.averageCost*p.shares,closeBasedValue=x.close*p.shares,pnl=closeBasedValue-totalCost,pct=totalCost>0?100*pnl/totalCost:null;
      let hist=null;try{hist=await historyReadiness()}catch{}
      box.innerHTML=`<div class=toprow><div><h2>${esc(x.name)}／${esc(x.code)}</h2><div class=muted>${esc(x.market)}｜已持有｜持倉管理</div></div></div><div class=sourcegrid style="margin-top:10px"><div class=sourceitem><b>成本均價</b>${money(p.averageCost)}</div><div class=sourceitem><b>目前持有股數</b>${money(p.shares)}</div><div class=sourceitem><b>首次買入日</b>${p.buyDate?esc(p.buyDate):MISSING}</div><div class=sourceitem><b>持倉總成本</b>${money(totalCost)}<br><span class=mini>由你的成本均價 × 目前持有股數計算</span></div><div class=sourceitem><b>最新已驗證收盤</b>${esc(x.date)}｜${money(x.close)}<br><span class=mini>非盤中即時價</span></div><div class=sourceitem><b>依該收盤估算市值</b>${money(closeBasedValue)}</div><div class=sourceitem><b>依該收盤估算損益</b>${pnl>=0?'+':''}${money(pnl)}${pct!=null?`｜${pct>=0?'+':''}${pct.toFixed(2)}%`:''}</div><div class=sourceitem><b>出場判斷</b>尚未通過正式驗證</div></div>${sessionHtml(x.session)}${historyHtml(hist,p.buyDate)}<div class=source-note><b class=bad>暫不提供出場時機／觸發價格／信心指數</b><div class=mini>持股出場模型的正式 OOS、實際可執行性與信心校準尚未全部通過；目前只顯示你的持股事實、由持股事實推導的總成本，以及最新已驗證收盤所計算的估算市值與估算損益。不捏造賣出價，也不把收盤價冒充盤中即時價。</div></div>`;
    }catch(e){box.innerHTML=conciseBlock('已持有','資料驗證未完成',e.message||String(e))}
  }}
  window.StockLabPublicOutput={productionReady:ready,observation,historyReadiness,normalizeTradeDate,dateAgeDays,sessionHtml};
})();
