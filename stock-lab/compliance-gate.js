// Final production gate. Loaded last so predictive outputs cannot bypass legality/integrity policy.
// When prediction gates are not ready, the app remains usable in VERIFIED FACTS mode.
(function(){
  const rt=window.STOCKLAB_RUNTIME||{};
  const analyze=document.querySelector('#analyzeBtn'),scan=document.querySelector('#scanBtn'),hold=document.querySelector('#holdAnalyzeBtn');
  const blockedReasons=()=>Array.isArray(rt.blockers)&&rt.blockers.length?rt.blockers:['預測必要 Gate 尚未全部通過'];
  const gateList=()=>Object.entries(rt.gates||{}).filter(([,v])=>v!==true).map(([k])=>k);
  const missing='資料未取得／未通過驗證';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  function num(v){if(v==null)return null;const s=String(v).trim();if(!s||['-','--','—','N/A','NA','null','undefined'].includes(s))return null;const x=Number(s.replace(/,/g,''));return Number.isFinite(x)?x:null}
  const money=x=>x==null?'—':Number(x).toLocaleString('zh-TW',{maximumFractionDigits:2});
  function rocDate(v){const s=String(v||'').replace(/\D/g,'');if(/^\d{7}$/.test(s))return `${+s.slice(0,3)+1911}-${s.slice(3,5)}-${s.slice(5,7)}`;if(/^\d{8}$/.test(s))return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;return String(v||'')||null}
  function pick(o,keys){for(const k of keys){if(o&&o[k]!=null&&String(o[k]).trim()!=='')return o[k]}return null}
  function daysBetween(a,b){if(!a||!b)return null;const x=new Date(`${a}T00:00:00+08:00`),y=new Date(`${b}T00:00:00+08:00`);if(Number.isNaN(x.getTime())||Number.isNaN(y.getTime())||y<x)return null;return Math.floor((y-x)/86400000)}
  let cachePromise=null;
  async function licensedCache(){
    if(cachePromise)return cachePromise;
    cachePromise=fetch('./browser-data.json',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error(`合法公開資料快取讀取失敗 ${r.status}`);const x=await r.json();if(x.schema_version!==2||x.source!=='licensed-open-data-cache'||!String(x.licence||'').includes('OGDL'))throw Error('公開資料快取授權／版本驗證未通過');return x}).catch(e=>{cachePromise=null;throw e});
    return cachePromise;
  }
  function twseObs(r){return{market:'TWSE',code:String(r.Code||'').trim(),name:String(r.Name||'').trim(),date:rocDate(r.Date),open:num(r.OpeningPrice),high:num(r.HighestPrice),low:num(r.LowestPrice),close:num(r.ClosingPrice),volume:num(r.TradeVolume),tradeValue:num(r.TradeValue)}}
  function tpexObs(r){return{market:'TPEx',code:String(pick(r,['SecuritiesCompanyCode','Code','證券代號','代號'])||'').trim(),name:String(pick(r,['CompanyName','SecuritiesCompanyName','Name','證券名稱','名稱'])||'').trim(),date:rocDate(pick(r,['Date','日期'])),open:num(pick(r,['Open','OpeningPrice','開盤價','開盤'])),high:num(pick(r,['High','HighestPrice','最高價','最高'])),low:num(pick(r,['Low','LowestPrice','最低價','最低'])),close:num(pick(r,['Close','ClosingPrice','收盤價','收盤'])),volume:num(pick(r,['TradingShares','TradeVolume','成交股數','成交量'])),tradeValue:num(pick(r,['TransactionAmount','TradeValue','TradingAmount','成交金額']))}}
  function allObs(c){const d=c.datasets||{};return[...(d.twse_snapshot||[]).map(twseObs),...(d.tpex_snapshot||[]).map(tpexObs)].filter(x=>x.code&&x.name&&x.close!=null)}
  function resolveObs(c,q){const s=String(q||'').trim(),rows=allObs(c);let x=rows.find(r=>r.code===s);if(!x)x=rows.find(r=>r.name===s);if(!x){const p=rows.filter(r=>r.name.includes(s));if(p.length===1)x=p[0];else if(p.length>1)throw Error(`找到多個相近名稱：${p.slice(0,5).map(z=>`${z.name} ${z.code}`).join('、')}`)}if(!x)throw Error('合法公開資料中找不到此股票／商品');return x}
  function findValuation(c,x){const key=x.market==='TWSE'?'twse_valuation':'tpex_valuation',rows=c.datasets?.[key]||[];return rows.find(r=>String(pick(r,['Code','SecuritiesCompanyCode','證券代號','公司代號'])||'').trim()===x.code)||null}
  function findRevenue(c,x){const key=x.market==='TWSE'?'twse_revenue':'tpex_revenue',rows=c.datasets?.[key]||[];return rows.find(r=>String(pick(r,['公司代號','Code','SecuritiesCompanyCode'])||'').trim()===x.code)||null}
  function factCard(x,c){
    const v=findValuation(c,x),r=findRevenue(c,x),pe=num(pick(v,['PEratio','PriceEarningRatio','PERatio','本益比'])),pb=num(pick(v,['PBratio','PriceBookRatio','PBRatio','股價淨值比'])),dy=num(pick(v,['DividendYield','YieldRatio','殖利率'])),period=pick(r,['資料年月','年月']),yoy=num(pick(r,['營業收入-去年同月增減(%)','去年同月增減(%)'])),mom=num(pick(r,['營業收入-上月比較增減(%)','上月比較增減(%)']));
    return `<div class=toprow><div><h2>${esc(x.name)}／${esc(x.code)}</h2><div class=muted>${x.market}｜已驗證資料模式｜資料日 ${esc(x.date||'日期缺漏')}</div></div></div><div class=kpis><div class=kpi><b>${money(x.close)}</b><span>最新合法收盤</span></div><div class=kpi><b>${money(x.open)}</b><span>開盤</span></div><div class=kpi><b>${money(x.high)}</b><span>最高</span></div><div class=kpi><b>${money(x.low)}</b><span>最低</span></div></div><div class=sourcegrid style="margin-top:10px"><div class=sourceitem><b>成交量／成交金額</b>${money(x.volume)}／${money(x.tradeValue)}</div><div class=sourceitem><b>估值</b>PE ${pe??'—'}｜PB ${pb??'—'}｜殖利率 ${dy!=null?dy+'%':'—'}</div><div class=sourceitem><b>最新月營收</b>${period?esc(period):missing}${period?`｜YoY ${yoy??'—'}%｜MoM ${mom??'—'}%`:''}</div><div class=sourceitem><b>資料授權</b>OGDL 1.0｜licensed-open-data-cache</div></div>`;
  }
  function predictionBlockedHtml(kind,specific=[]){const gates=gateList(),why=[...specific,...blockedReasons()];return `<div class=source-note><b>預測／推薦暫不輸出</b><div class=mini>${kind}所需 Gate 尚未全部完成。這裡不以舊資料、0、平均值、其他網站未驗證值或 AI 推測補齊。${gates.length?`<br>未通過 Gate：${esc(gates.join('｜'))}`:''}${why.length?`<br>原因：${esc(why.join('；'))}`:''}</div></div>`}
  function blockedHtml(title){return `<div class=toprow><div><h2>${esc(title)}</h2><div class=muted>StockLab Hard Policy v${rt.hardPolicyVersion||'—'}｜VERIFIED FACTS ONLY</div></div></div><h3 class=bad>預測功能暫未通過完整 Gate</h3><p>網站仍可查詢已授權且已驗證的市場基本資料；只有預測價格、推薦與勝率保持 fail-closed。</p>${predictionBlockedHtml(title)}`}
  function renderBlock(target,title){const box=document.querySelector(target);if(!box)return;box.innerHTML=blockedHtml(title);box.classList.remove('hidden')}
  async function hardReady(){const p=await window.STOCKLAB_HARD_READY;if(!p||!window.StockLabHardPolicy)throw Error('Hard Policy 無法載入');return window.StockLabHardPolicy}
  async function renderFacts(target,q,kind='買入分析'){
    const box=document.querySelector(target);if(!box)return;const c=await licensedCache(),x=resolveObs(c,q);
    box.innerHTML=factCard(x,c)+`<div class=source-note><b>買入模型的資料時間</b><div class=mini>目前只確認資料日 ${esc(x.date||'—')} 的官方收盤事實。08:30–09:00 是盤前限價 ROD 的執行窗口；09:00 後若沒有合法即時／延遲行情，StockLab 不重算一個假裝是「現在可買」的盤中價格。<br><br>收盤後也不以 13:30 或某個固定時鐘直接切換成明日價格。公開資料會於台灣時間 14:20、14:50、15:20、15:50 嘗試更新，但這些只是抓取時間；只有官方資料日期真的前進，而且所有目標交易時段必要資料都通過合法性、schema、日期與完整性 Gate，才會建立新的下一交易時段計畫。</div></div>`+predictionBlockedHtml(kind);box.classList.remove('hidden')
  }
  async function renderMarketFacts(){const box=document.querySelector('#top10');if(!box)return;const c=await licensedCache(),rows=allObs(c).filter(x=>x.tradeValue!=null).sort((a,b)=>b.tradeValue-a.tradeValue).slice(0,10);box.innerHTML=`<h2>市場成交金額前 10｜事實瀏覽</h2><p class=muted>這是最新合法公開資料依成交金額排序，不是 TOP10 推薦、不是上漲預測，也不代表適合買入。</p><div class=list>${rows.map((x,i)=>`<div class=item><div class=rank>#${i+1}</div><div><b>${esc(x.name)}／${esc(x.code)}</b><div class=mini>${x.market}｜${esc(x.date||'—')}</div></div><div class=price>${money(x.close)}<br><span class=mini>${money(x.tradeValue)}</span></div></div>`).join('')}</div>${predictionBlockedHtml('TOP10 推薦')}`;box.classList.remove('hidden')}
  async function renderHoldingFacts(){
    const box=document.querySelector('#holdResult');if(!box)return;
    const q=document.querySelector('#holdTicker')?.value||'',avg=num(document.querySelector('#holdAvgCost')?.value),shares=num(document.querySelector('#holdShares')?.value),buyDate=document.querySelector('#holdBuyDate')?.value||null,horizon=document.querySelector('#holdHorizon')?.value||'3m';
    if(!(avg>0)||!(shares>0))throw Error('請輸入有效的總量成本均價與持有股數');
    const c=await licensedCache(),x=resolveObs(c,q),cost=avg*shares,value=x.close*shares,pnl=value-cost,pct=cost?100*pnl/cost:null,days=daysBetween(buyDate,x.date);
    const hLabel=horizon==='1m'?'短線｜數日～約1個月':horizon==='3m'?'波段｜約1～3個月':'中長期｜6個月以上';
    box.innerHTML=factCard(x,c)+`<h3>你的持倉｜user_observed</h3><div class=sourcegrid><div class=sourceitem><b>總量成本均價</b>${money(avg)}</div><div class=sourceitem><b>持有股數</b>${money(shares)}</div><div class=sourceitem><b>首次買入日</b>${buyDate?esc(buyDate):'未提供'}</div><div class=sourceitem><b>原預計持有期間</b>${hLabel}</div></div><h3>依最新已驗證收盤計算｜derived</h3><div class=sourcegrid><div class=sourceitem><b>持有成本</b>${money(cost)}<br><span class=mini>均價 × 股數；未自行猜測手續費、稅、股利</span></div><div class=sourceitem><b>依 ${esc(x.date||'資料日')} 收盤估算市值</b>${money(value)}</div><div class=sourceitem><b>未實現損益</b>${pnl>=0?'+':''}${money(pnl)}</div><div class=sourceitem><b>報酬率</b>${pct!=null?(pct>=0?'+':'')+pct.toFixed(2)+'%':'—'}${days!=null?`<br><span class=mini>持有約 ${days} 個日曆日</span>`:''}</div></div><div class=source-note><b>出場模型會怎麼判斷</b><div class=mini>短／中／長只在「已持有」情境使用，用來決定趨勢失效的尺度。正式模型會比較你的成本線、已驗證收盤、均線／ATR／支撐壓力、台股注意／處置狀態與基本面惡化訊號，輸出續抱、減碼、停利或出場條件；不會把原本的買入低價改名成賣出價。</div></div>${predictionBlockedHtml('持股出場時機／賣出條件',['holdingExitValidation 必須獨立 PASS'])}`;box.classList.remove('hidden');
  }

  // Any future private backend numeric result must carry its own legal-source and price-verification audit.
  if(window.StockLabAPI){const api=window.StockLabAPI,origAnalyze=api.analyze?.bind(api),origScan=api.scan?.bind(api);api.config.allowLocalFallback=false;if(origAnalyze)api.analyze=async function(code,h){const j=await origAnalyze(code,h),hp=await hardReady(),v=hp.backendResult(j,h==='holding'?'holding':'analysis');if(!v.ok)throw Error(`後端稽核未通過：${v.blockers.join('；')}`);return j};if(origScan)api.scan=async function(h){const j=await origScan(h);if(j?.ok!==true||j?.data?.audit?.legal_source_verified!==true||j?.data?.audit?.price_verified!==true||j?.data?.audit?.oos_validation_passed!==true)throw Error('TOP10 後端稽核未通過');return j}}

  if(analyze){const original=analyze.onclick;analyze.onclick=async function(ev){try{await hardReady();const apiReady=window.StockLabAPI?.config?.enabled===true;if(apiReady||rt.productionPredictionReady===true)return original?.call(this,ev);await renderFacts('#result',document.querySelector('#ticker')?.value,'下一交易時段買入計畫')}catch(e){const box=document.querySelector('#result');box.innerHTML=`<h3 class=bad>查詢失敗</h3><p>${esc(e.message)}</p>`;box.classList.remove('hidden')}}}
  if(scan){const original=scan.onclick;scan.onclick=async function(ev){try{await hardReady();const apiReady=window.StockLabAPI?.config?.enabled===true;if(apiReady||rt.productionPredictionReady===true)return original?.call(this,ev);await renderMarketFacts()}catch(e){const box=document.querySelector('#top10');box.innerHTML=`<h3 class=bad>查詢失敗</h3><p>${esc(e.message)}</p>`;box.classList.remove('hidden')}}}
  if(hold){hold.disabled=false;hold.textContent='查看持股狀態與出場條件';hold.onclick=async function(){try{await hardReady();await renderHoldingFacts()}catch(e){const box=document.querySelector('#holdResult');box.innerHTML=`<h3 class=bad>查詢失敗</h3><p>${esc(e.message)}</p>`;box.classList.remove('hidden')}}}

  window.StockLabCompliance={productionReady:()=>rt.productionPredictionReady===true,unresolvedGates:gateList,blockers:blockedReasons,renderBlock,licensedCache};
})();
