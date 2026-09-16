// Usable holding monitor. Loaded after compliance-gate so the holding section works even while formal exit prediction remains fail-closed.
// Only user-observed position facts + licensed OGDL snapshot facts are shown. No local sell recommendation is fabricated.
(function(){
  const btn=document.querySelector('#holdAnalyzeBtn'),input=document.querySelector('#holdTicker'),load=document.querySelector('#holdLoad'),box=document.querySelector('#holdResult');
  if(!btn||!input||!load||!box)return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{if(v==null)return null;const x=Number(String(v).replace(/,/g,''));return Number.isFinite(x)?x:null};
  const money=x=>x==null?'—':Number(x).toLocaleString('zh-TW',{maximumFractionDigits:2});
  const pct=x=>x==null?'—':`${x>0?'+':''}${Number(x).toFixed(2)}%`;
  const pick=(o,ks)=>{for(const k of ks){if(o&&o[k]!=null&&String(o[k]).trim()!=='')return o[k]}return null};
  function rocDate(v){const s=String(v||'').replace(/\D/g,'');if(/^\d{7}$/.test(s))return `${+s.slice(0,3)+1911}-${s.slice(3,5)}-${s.slice(5,7)}`;if(/^\d{8}$/.test(s))return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;return String(v||'')||null}
  function daysBetween(a,b){if(!a||!b)return null;const x=new Date(`${a}T00:00:00+08:00`),y=new Date(`${b}T00:00:00+08:00`);if(Number.isNaN(x.getTime())||Number.isNaN(y.getTime())||y<x)return null;return Math.floor((y-x)/86400000)}
  function twse(r){return{market:'TWSE',code:String(r.Code||'').trim(),name:String(r.Name||'').trim(),date:rocDate(r.Date),open:num(r.OpeningPrice),high:num(r.HighestPrice),low:num(r.LowestPrice),close:num(r.ClosingPrice),volume:num(r.TradeVolume),tradeValue:num(r.TradeValue)}}
  function tpex(r){return{market:'TPEx',code:String(pick(r,['SecuritiesCompanyCode','Code','證券代號','代號'])||'').trim(),name:String(pick(r,['CompanyName','SecuritiesCompanyName','Name','證券名稱','名稱'])||'').trim(),date:rocDate(pick(r,['Date','日期'])),open:num(pick(r,['Open','OpeningPrice','開盤價','開盤'])),high:num(pick(r,['High','HighestPrice','最高價','最高'])),low:num(pick(r,['Low','LowestPrice','最低價','最低'])),close:num(pick(r,['Close','ClosingPrice','收盤價','收盤'])),volume:num(pick(r,['TradingShares','TradeVolume','成交股數','成交量'])),tradeValue:num(pick(r,['TransactionAmount','TradeValue','TradingAmount','成交金額']))}}
  function resolveObs(cache,code){const d=cache.datasets||{},rows=[...(d.twse_snapshot||[]).map(twse),...(d.tpex_snapshot||[]).map(tpex)];const x=rows.find(z=>z.code===String(code));if(!x||!(x.close>0)||!x.date)throw Error('最新合法公開收盤資料未取得／未通過驗證');return x}
  function dayFact(x){const pos=x.high>x.low?(x.close-x.low)/(x.high-x.low):null,move=x.open>0?100*(x.close/x.open-1):null;let p='日內位置無法判定';if(pos!=null)p=pos>=.75?'收盤位於當日區間上緣':pos<=.25?'收盤位於當日區間下緣':'收盤位於當日區間中段';return `${p}${move!=null?`｜相對開盤 ${pct(move)}`:''}`}
  function riskFact(f,x){const s=f?.stocks?.[x.code]||{},ss=f?.source_status||{},a=[];a.push(s.margin_change_pct!=null?`融資 ${pct(num(s.margin_change_pct))}`:'融資：未取得／未驗證');a.push(s.short_change_pct!=null?`融券 ${pct(num(s.short_change_pct))}`:'融券：未取得／未驗證');if(s.disposition===true)a.push('⛔ 處置股');else{const k=x.market==='TWSE'?'TWSE_disposition':'TPEx_disposition';a.push(ss[k]?.ok===true?'處置：未列入':'處置：狀態未完整驗證')}if(s.attention===true)a.push('⚠️ 注意股');else{const k=x.market==='TWSE'?'TWSE_attention':'TPEx_attention';a.push(ss[k]?.ok===true?'注意：未列入':'注意：狀態未完整驗證')}return a.join('｜')}
  async function historyStatus(){try{const r=await fetch('./history-ogdl/manifest.json',{cache:'no-store'});if(!r.ok)throw Error();const m=await r.json(),c=m.coverage_metrics?.overall||{};return{first:m.first_date,last:m.last_date,dates:c.distinct_trading_dates,maxBars:c.max_valid_bars_per_security,have120:c.securities_at_least_120_bars}}catch{return null}}
  async function readinessStatus(){try{const r=await fetch('./holding-readiness.json',{cache:'no-store'});if(!r.ok)throw Error();const x=await r.json();if(x.schema_version!==1||x.model!=='TW-holding-exit-v4')throw Error();return x}catch{return null}}
  function readinessHtml(x){
    if(!x)return `<div class=source-note><b>正式出場模型準備度</b><div class=mini>準備度檔尚未取得；依 FAIL_CLOSED 規則視為未解鎖，不產生出場時機或觸發價格。</div></div>`;
    const h=x.history||{},o=x.oos||{},ok=x.overall_status==='PASS'&&x.executable_exit_output===true,blockers=Array.isArray(x.blockers)?x.blockers:[];
    const b=blockers.length?`<br>${blockers.map(z=>`• ${esc(z)}`).join('<br>')}`:'';
    return `<div class=source-note><b>${ok?'✅':'⚠️'} 正式出場模型準備度｜${esc(x.overall_status||'UNKNOWN')}</b><div class=mini>合法歷史：單檔最多 ${money(h.max_valid_bars_per_security)}/${money(h.minimum_valid_bars)} 根；達門檻標的 ${money(h.securities_at_least_minimum)} 檔。<br>OOS：${esc(o.status||'UNKNOWN')}｜episodes ${money(o.episodes)}/${money(o.minimum_episodes)}｜securities ${money(o.securities)}/${money(o.minimum_securities)}。<br>可執行性 ${o.execution_validated===true?'PASS':'未通過'}｜信心校準 ${o.confidence_calibrated===true?'PASS':'未通過'}｜production/test formula ${o.production_formula_match===true?'一致':'未證明一致'}。${b}</div></div>`;
  }
  async function run(){
    load.classList.remove('hidden');
    try{
      const resolver=window.StockLabTickerResolver;if(!resolver?.resolve)throw Error('股票名稱／代號解析器尚未就緒');
      const pos=window.StockLabPositionInput?.collect?.();if(!pos)throw Error('持股輸入模組尚未就緒');
      const code=await resolver.resolve(input.value);input.value=code;
      const compliance=window.StockLabCompliance;if(!compliance?.licensedCache)throw Error('合法公開資料層尚未就緒');
      const [cache,factors,hist,ready]=await Promise.all([compliance.licensedCache(),compliance.factorData?.()||Promise.resolve({}),historyStatus(),readinessStatus()]);
      const x=resolveObs(cache,code),cost=pos.averageCost*pos.shares,value=x.close*pos.shares,pnl=value-cost,pnlPct=cost?100*pnl/cost:null,calDays=daysBetween(pos.buyDate,x.date);
      const histText=hist?`${hist.first||'—'}～${hist.last||'—'}｜有效交易日 ${hist.dates??'—'}｜單檔最多 ${hist.maxBars??'—'} 根｜達 120 根：${hist.have120??0} 檔`:'合法歷史覆蓋狀態未取得';
      box.innerHTML=`<div class=toprow><div><h2>${esc(x.name)}／${esc(x.code)}</h2><div class=muted>${x.market}｜已持有｜持股監控</div><div class=mini>市場資料日 ${esc(x.date)}｜OGDL 合法公開資料｜缺值不補</div></div></div><div class=decision-strip><div class=sourceitem><div class=hero-label>依最新合法收盤的未實現損益</div><div class=hero-number>${pnl>=0?'+':''}${money(pnl)}</div><div class=mini>${pct(pnlPct)}｜未計你未輸入的手續費、交易稅、股利與已實現損益</div></div><div class=sourceitem><div class=hero-label>最新已驗證收盤</div><div class=hero-number>${money(x.close)}</div><div class=mini>${esc(x.date)}｜完成交易日收盤，不是即時價</div></div></div><div class=sourcegrid style="margin-top:8px"><div class=sourceitem><b>成本均價</b>${money(pos.averageCost)}</div><div class=sourceitem><b>目前持有股數</b>${money(pos.shares)}</div><div class=sourceitem><b>持倉總成本</b>${money(cost)}</div><div class=sourceitem><b>依收盤估算市值</b>${money(value)}</div><div class=sourceitem><b>首次買入日</b>${esc(pos.buyDate)}${calDays!=null?`｜至資料日 ${calDays} 個日曆日`:''}<br><span class=mini>不是交易日數；完整交易日曆未通過前不做近似換算</span></div><div class=sourceitem><b>當日價格事實</b>${esc(dayFact(x))}</div><div class=sourceitem><b>台股風險事實</b>${esc(riskFact(factors,x))}</div><div class=sourceitem><b>資料來源</b>licensed-open-data-cache｜OGDL 1.0</div></div>${readinessHtml(ready)}<div class=source-note><b>正式出場建議目前為什麼沒有數字？</b><div class=mini>目前「已持有」已可用來看你的實際部位、最新合法收盤、損益與已驗證風險事實；但續抱／減碼／出場條件仍不能冒充已驗證模型。合法歷史覆蓋目前：${esc(histText)}。正式持股模型最低需要 120 根有效日線，之後還要通過獨立 OOS、執行可達性與信心校準，才會解鎖真正的出場時機。</div></div><div class=disclaimer><b>硬規則</b>你的成本、股數、買入日只採你的輸入；市場數據只採授權與驗證通過的 OGDL 來源。任何未取得資料維持「未知」，不以 0、平均值、舊值、其他網站或 AI 補成市場事實。</div>`;
      box.classList.remove('hidden');
    }catch(e){box.innerHTML=`<h3 class=bad>持股資料無法完成</h3><p>${esc(e.message||e)}</p>`;box.classList.remove('hidden')}
    finally{load.classList.add('hidden')}
  }
  btn.disabled=false;btn.textContent='查看持股狀態';btn.onclick=run;
  window.StockLabHoldingMonitor={run};
})();