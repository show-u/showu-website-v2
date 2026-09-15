// Final production gate. Loaded last so predictive outputs cannot bypass legality/integrity policy.
// When prediction gates are not ready, the app remains usable in VERIFIED FACTS ONLY mode,
// but facts must be synthesized into decision-relevant research context rather than dumped as raw fields.
(function(){
  const rt=window.STOCKLAB_RUNTIME||{};
  const analyze=document.querySelector('#analyzeBtn'),scan=document.querySelector('#scanBtn'),hold=document.querySelector('#holdAnalyzeBtn');
  const blockedReasons=()=>Array.isArray(rt.blockers)&&rt.blockers.length?rt.blockers:['預測必要 Gate 尚未全部通過'];
  const gateList=()=>Object.entries(rt.gates||{}).filter(([,v])=>v!==true).map(([k])=>k);
  const missing='資料未取得／未通過驗證';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function num(v){if(v==null)return null;const s=String(v).trim();if(!s||['-','--','—','N/A','NA','null','undefined'].includes(s))return null;const x=Number(s.replace(/,/g,'').replace(/%$/,''));return Number.isFinite(x)?x:null}
  const money=x=>x==null?'—':Number(x).toLocaleString('zh-TW',{maximumFractionDigits:2});
  const pct=(x,d=2)=>x==null?'—':`${x>0?'+':''}${Number(x).toFixed(d)}%`;
  function rocDate(v){const s=String(v||'').replace(/\D/g,'');if(/^\d{7}$/.test(s))return `${+s.slice(0,3)+1911}-${s.slice(3,5)}-${s.slice(5,7)}`;if(/^\d{8}$/.test(s))return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;return String(v||'')||null}
  function ym(v){const s=String(v||'').replace(/\D/g,'');if(/^\d{5}$/.test(s))return `${+s.slice(0,3)+1911}-${s.slice(3,5)}`;if(/^\d{6}$/.test(s))return `${s.slice(0,4)}-${s.slice(4,6)}`;return String(v||'')||null}
  function pick(o,keys){for(const k of keys){if(o&&o[k]!=null&&String(o[k]).trim()!=='')return o[k]}return null}
  function daysBetween(a,b){if(!a||!b)return null;const x=new Date(`${a}T00:00:00+08:00`),y=new Date(`${b}T00:00:00+08:00`);if(Number.isNaN(x.getTime())||Number.isNaN(y.getTime())||y<x)return null;return Math.floor((y-x)/86400000)}
  function percentile(values,x){const v=values.filter(Number.isFinite).sort((a,b)=>a-b);if(x==null||v.length<8)return null;let n=0;for(const z of v)if(z<=x)n++;return{p:n/v.length,n:v.length}}
  function bandLabel(p){if(p==null)return null;if(p<=.3)return'同產業較低區間';if(p>=.7)return'同產業較高區間';return'同產業中段'}
  const industryNames={'01':'水泥','02':'食品','03':'塑膠','04':'紡織纖維','05':'電機機械','06':'電器電纜','08':'玻璃陶瓷','09':'造紙','10':'鋼鐵','11':'橡膠','12':'汽車','14':'建材營造','15':'航運','17':'金融保險','18':'貿易百貨','20':'其他','21':'化學','22':'生技醫療','23':'油電燃氣','24':'半導體','25':'電腦及週邊設備','26':'光電','27':'通信網路','28':'電子零組件','29':'電子通路','30':'資訊服務','31':'其他電子','32':'文化創意','33':'農業科技','34':'電子商務','35':'綠能環保','36':'數位雲端','37':'運動休閒','38':'居家生活'};

  let cachePromise=null,factorPromise=null;
  async function licensedCache(){
    if(cachePromise)return cachePromise;
    cachePromise=fetch('./browser-data.json',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error(`合法公開資料快取讀取失敗 ${r.status}`);const x=await r.json();if(x.schema_version!==2||x.source!=='licensed-open-data-cache'||!String(x.licence||'').includes('OGDL'))throw Error('公開資料快取授權／版本驗證未通過');return x}).catch(e=>{cachePromise=null;throw e});
    return cachePromise;
  }
  async function factorData(){
    if(factorPromise)return factorPromise;
    factorPromise=fetch('./taiwan-factors.json',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('台股衍生因子資料未取得');const x=await r.json();if(x.schema_version<3||x.source!=='official-derived-no-imputation')throw Error('台股衍生因子來源驗證未通過');return x}).catch(e=>({schema_version:0,source:'unavailable',stocks:{},source_status:{},market:{},error:String(e.message||e)}));
    return factorPromise;
  }
  function twseObs(r){return{market:'TWSE',code:String(r.Code||'').trim(),name:String(r.Name||'').trim(),date:rocDate(r.Date),open:num(r.OpeningPrice),high:num(r.HighestPrice),low:num(r.LowestPrice),close:num(r.ClosingPrice),volume:num(r.TradeVolume),tradeValue:num(r.TradeValue)}}
  function tpexObs(r){return{market:'TPEx',code:String(pick(r,['SecuritiesCompanyCode','Code','證券代號','代號'])||'').trim(),name:String(pick(r,['CompanyName','SecuritiesCompanyName','Name','證券名稱','名稱'])||'').trim(),date:rocDate(pick(r,['Date','日期'])),open:num(pick(r,['Open','OpeningPrice','開盤價','開盤'])),high:num(pick(r,['High','HighestPrice','最高價','最高'])),low:num(pick(r,['Low','LowestPrice','最低價','最低'])),close:num(pick(r,['Close','ClosingPrice','收盤價','收盤'])),volume:num(pick(r,['TradingShares','TradeVolume','成交股數','成交量'])),tradeValue:num(pick(r,['TransactionAmount','TradeValue','TradingAmount','成交金額']))}}
  function allObs(c){const d=c.datasets||{};return[...(d.twse_snapshot||[]).map(twseObs),...(d.tpex_snapshot||[]).map(tpexObs)].filter(x=>x.code&&x.name&&x.close!=null)}
  function resolveObs(c,q){const s=String(q||'').trim(),rows=allObs(c);let x=rows.find(r=>r.code===s);if(!x)x=rows.find(r=>r.name===s);if(!x){const p=rows.filter(r=>r.name.includes(s));if(p.length===1)x=p[0];else if(p.length>1)throw Error(`找到多個相近名稱：${p.slice(0,5).map(z=>`${z.name} ${z.code}`).join('、')}`)}if(!x)throw Error('合法公開資料中找不到此股票／商品');return x}
  function rowCode(r){return String(pick(r,['Code','SecuritiesCompanyCode','證券代號','公司代號'])||'').trim()}
  function findValuation(c,x){const key=x.market==='TWSE'?'twse_valuation':'tpex_valuation',rows=c.datasets?.[key]||[];return rows.find(r=>rowCode(r)===x.code)||null}
  function findRevenue(c,x){const key=x.market==='TWSE'?'twse_revenue':'tpex_revenue',rows=c.datasets?.[key]||[];return rows.find(r=>String(pick(r,['公司代號','Code','SecuritiesCompanyCode'])||'').trim()===x.code)||null}
  function valuationFields(v){return{pe:num(pick(v,['PEratio','PriceEarningRatio','PERatio','本益比'])),pb:num(pick(v,['PBratio','PriceBookRatio','PBRatio','股價淨值比'])),dy:num(pick(v,['DividendYield','YieldRatio','殖利率']))}}
  function revenueFields(r){return{period:ym(pick(r,['資料年月','年月'])),yoy:num(pick(r,['營業收入-去年同月增減(%)','去年同月增減(%)'])),mom:num(pick(r,['營業收入-上月比較增減(%)','上月比較增減(%)'])),ytd:num(pick(r,['累計營業收入-前期比較增減(%)','累計較去年同期增減(%)']))}}

  function priceResearch(x){
    const fromOpen=x.open>0?100*(x.close/x.open-1):null,range=x.high>x.low?100*(x.high-x.low)/x.close:null,pos=x.high>x.low?(x.close-x.low)/(x.high-x.low):null;
    const posText=pos==null?'日內位置無法計算':pos>=.75?'收盤位於當日區間上緣':pos<=.25?'收盤位於當日區間下緣':'收盤位於當日區間中段';
    return{fromOpen,range,pos,posText,text:`${posText}${fromOpen!=null?`；相對開盤 ${pct(fromOpen)}`:''}${range!=null?`；當日高低振幅約 ${pct(range)}`:''}`};
  }
  function liquidityResearch(c,x){const rows=allObs(c).filter(z=>z.market===x.market&&z.tradeValue>0).sort((a,b)=>b.tradeValue-a.tradeValue),i=rows.findIndex(z=>z.code===x.code);if(i<0)return{text:'成交金額排名無法計算',rank:null,n:rows.length};const rank=i+1,top=100*rank/rows.length;return{rank,n:rows.length,top,text:`成交金額在 ${x.market} 為第 ${rank}/${rows.length}，約位於前 ${top.toFixed(top<1?1:0)}%`}}
  function revenueResearch(r){const z=revenueFields(r);let state='營收趨勢資料不足';if(z.yoy!=null&&z.mom!=null){if(z.yoy>0&&z.mom>0)state='最新單月營收年增、月增皆為正';else if(z.yoy>0&&z.mom<=0)state='營收仍高於去年同期，但較上月回落';else if(z.yoy<=0&&z.mom>0)state='營收較上月回升，但仍低於去年同期';else state='最新單月營收年增、月增皆為負';}else if(z.yoy!=null)state=`最新單月營收年增 ${pct(z.yoy)}`;return{...z,state,text:`${z.period||'期別未取得'}｜${state}${z.yoy!=null?`｜YoY ${pct(z.yoy)}`:''}${z.mom!=null?`｜MoM ${pct(z.mom)}`:''}`}}
  function valuationResearch(c,x,f){
    const v=findValuation(c,x),z=valuationFields(v),sf=f.stocks?.[x.code]||{},ind=sf.industry||null,name=industryNames[ind]||(`產業代碼 ${ind||'未取得'}`),key=x.market==='TWSE'?'twse_valuation':'tpex_valuation',rows=c.datasets?.[key]||[],peers=[];
    if(ind)for(const r of rows){const code=rowCode(r);if(!code||f.stocks?.[code]?.industry!==ind)continue;const q=valuationFields(r);peers.push(q)}
    const peR=percentile(peers.map(q=>q.pe),z.pe),pbR=percentile(peers.map(q=>q.pb),z.pb),dyR=percentile(peers.map(q=>q.dy),z.dy);
    const parts=[];if(z.pe!=null)parts.push(`PE ${z.pe.toFixed(2)}${peR?`（${bandLabel(peR.p)}，同業樣本 ${peR.n}）`:''}`);if(z.pb!=null)parts.push(`PB ${z.pb.toFixed(2)}${pbR?`（${bandLabel(pbR.p)}）`:''}`);if(z.dy!=null)parts.push(`殖利率 ${z.dy.toFixed(2)}%${dyR?`（同產業第 ${(dyR.p*100).toFixed(0)} 百分位）`:''}`);
    return{industry:ind,industryName:name,pe:z.pe,pb:z.pb,dy:z.dy,text:parts.length?`${name}｜${parts.join('｜')}`:`${name}｜估值資料未取得／不適用`};
  }
  function riskResearch(x,f){
    const s=f.stocks?.[x.code]||{},ss=f.source_status||{},parts=[];
    if(s.margin_change_pct!=null)parts.push(`融資餘額變化 ${pct(num(s.margin_change_pct))}`);else parts.push('融資資料未取得／未驗證');
    if(s.short_change_pct!=null)parts.push(`融券餘額變化 ${pct(num(s.short_change_pct))}`);else parts.push('融券資料未取得／未驗證');
    if(s.disposition===true)parts.push('⛔ 已驗證處置股');else{const k=x.market==='TWSE'?'TWSE_disposition':'TPEx_disposition';parts.push(ss[k]?.ok===true?'處置名單：未列入':'處置狀態未完整驗證')}
    if(s.attention===true)parts.push('⚠️ 已驗證注意股');else{const k=x.market==='TWSE'?'TWSE_attention':'TPEx_attention';parts.push(ss[k]?.ok===true?'注意名單：未列入':'注意狀態未完整驗證')}
    return{text:parts.join('｜')};
  }
  function rawFacts(x,c){const v=valuationFields(findValuation(c,x)),r=revenueFields(findRevenue(c,x));return `<details class="source-note"><summary><b>原始資料與授權</b></summary><div class="mini" style="margin-top:8px">資料日 ${esc(x.date||'—')}｜開 ${money(x.open)}｜高 ${money(x.high)}｜低 ${money(x.low)}｜收 ${money(x.close)}｜成交量 ${money(x.volume)}｜成交金額 ${money(x.tradeValue)}<br>PE ${v.pe??'—'}｜PB ${v.pb??'—'}｜殖利率 ${v.dy!=null?v.dy+'%':'—'}<br>月營收 ${r.period||'—'}｜YoY ${r.yoy!=null?pct(r.yoy):'—'}｜MoM ${r.mom!=null?pct(r.mom):'—'}<br>授權：OGDL 1.0｜licensed-open-data-cache。缺失值保持缺失，不以 0、平均值、舊值或 AI 補齊。</div></details>`}
  function researchBrief(x,c,f){const p=priceResearch(x),l=liquidityResearch(c,x),r=revenueResearch(findRevenue(c,x)),v=valuationResearch(c,x,f),risk=riskResearch(x,f);return `<div class=toprow><div><h2>${esc(x.name)}／${esc(x.code)}</h2><div class=muted>${x.market}｜資料日 ${esc(x.date||'日期缺漏')}｜研究摘要（非買賣建議）</div></div></div><h3>目前真正有用的資訊</h3><div class=sourcegrid><div class=sourceitem><b>價格位置</b>${esc(p.text)}</div><div class=sourceitem><b>流動性</b>${esc(l.text)}</div><div class=sourceitem><b>營收動能</b>${esc(r.text)}</div><div class=sourceitem><b>同產業估值</b>${esc(v.text)}</div><div class=sourceitem><b>信用交易／風險狀態</b>${esc(risk.text)}</div><div class=sourceitem><b>最新已驗證收盤</b>${money(x.close)}<br><span class=mini>這是觀測事實，不是即時價格</span></div></div>${rawFacts(x,c)}`}

  function predictionBlockedHtml(kind,specific=[]){const gates=gateList(),why=[...specific,...blockedReasons()];return `<div class=source-note><b>${esc(kind)}：目前不能負責任輸出</b><div class=mini>正式模型尚未同時通過合法資料、台股交易規則與樣本外驗證，因此不提供假價格、假排名或假勝率。這不是把缺資料補成 0，也不以舊資料、0、平均值、其他網站未驗證值或 AI 推測補齊。</div><details style="margin-top:8px"><summary>查看技術性阻擋原因</summary><div class=mini style="margin-top:6px">${gates.length?`未通過 Gate：${esc(gates.join('｜'))}<br>`:''}${why.length?esc(why.join('；')):'—'}</div></details></div>`}
  function blockedHtml(title){return `<div class=toprow><div><h2>${esc(title)}</h2><div class=muted>StockLab Hard Policy v${rt.hardPolicyVersion||'—'}｜VERIFIED FACTS ONLY</div></div></div><h3 class=bad>正式預測尚未通過驗證</h3><p>資料可以查，但未驗證模型不應用一個分數或價格製造「已分析完成」的錯覺。</p>${predictionBlockedHtml(title)}`}
  function renderBlock(target,title){const box=document.querySelector(target);if(!box)return;box.innerHTML=blockedHtml(title);box.classList.remove('hidden')}
  async function hardReady(){const p=await window.STOCKLAB_HARD_READY;if(!p||!window.StockLabHardPolicy)throw Error('Hard Policy 無法載入');return window.StockLabHardPolicy}
  async function renderFacts(target,q,kind='買入分析'){
    const box=document.querySelector(target);if(!box)return;const [c,f]=await Promise.all([licensedCache(),factorData()]),x=resolveObs(c,q);
    box.innerHTML=researchBrief(x,c,f)+`<div class=source-note><b>所以現在能回答什麼？</b><div class=mini>可以回答：最新合法收盤位置、當日價格結構、同市場流動性、最新營收方向、同產業估值位置，以及已取得的融資融券／風險狀態。<br><b>現在不能回答：</b>「今天一定該買嗎」「精確買入價」「上漲機率」。這些必須等獨立買入模型的合法歷史資料與正式 OOS Gate 通過。</div></div><div class=source-note><b>買入模型的資料時間</b><div class=mini>目前只確認資料日 ${esc(x.date||'—')} 的官方收盤事實。08:30–09:00 是盤前限價 ROD 的執行窗口；09:00 後若沒有合法即時／延遲行情，StockLab 不重算一個假裝是「現在可買」的盤中價格。收盤後也不以時鐘直接切換成明日價格；只有官方資料日期真的前進且必要 Gate 全部通過，才建立新的下一交易時段計畫。</div></div>`+predictionBlockedHtml(kind);box.classList.remove('hidden')
  }
  async function renderMarketFacts(){const box=document.querySelector('#top10');if(!box)return;box.innerHTML=`<h2>選股模型尚未完成正式驗證</h2><p class=muted>成交金額前 10、漲幅前 10 或熱門股排行都不等於「值得買」。在四種策略各自通過正式 OOS 前，StockLab 不用市場排行冒充 TOP10 推薦。</p>${predictionBlockedHtml('TOP10 推薦')}`;box.classList.remove('hidden')}
  async function renderHoldingFacts(){
    const box=document.querySelector('#holdResult');if(!box)return;
    const q=document.querySelector('#holdTicker')?.value||'',avg=num(document.querySelector('#holdAvgCost')?.value),shares=num(document.querySelector('#holdShares')?.value),buyDate=document.querySelector('#holdBuyDate')?.value||null,horizon=document.querySelector('#holdHorizon')?.value||'3m';
    if(!(avg>0)||!(shares>0))throw Error('請輸入有效的總量成本均價與持有股數');
    const [c,f]=await Promise.all([licensedCache(),factorData()]),x=resolveObs(c,q),cost=avg*shares,value=x.close*shares,pnl=value-cost,pctPnl=cost?100*pnl/cost:null,days=daysBetween(buyDate,x.date),p=priceResearch(x),r=revenueResearch(findRevenue(c,x)),v=valuationResearch(c,x,f),risk=riskResearch(x,f);
    const hLabel=horizon==='1m'?'短線｜數日～約1個月':horizon==='3m'?'波段｜約1～3個月':'中長期｜6個月以上';
    box.innerHTML=`<div class=toprow><div><h2>${esc(x.name)}／${esc(x.code)}</h2><div class=muted>${x.market}｜持股分析｜資料日 ${esc(x.date||'—')}</div></div></div><h3>你的部位現在處於什麼位置</h3><div class=sourcegrid><div class=sourceitem><b>成本均價 → 最新收盤</b>${money(avg)} → ${money(x.close)}<br><span class=mini>${pctPnl!=null?(pctPnl>=0?'高於成本 ':'低於成本 ')+Math.abs(pctPnl).toFixed(2)+'%':'—'}</span></div><div class=sourceitem><b>未實現損益</b>${pnl>=0?'+':''}${money(pnl)}｜${pctPnl!=null?pct(pctPnl):'—'}<br><span class=mini>依收盤估算；未自行猜測手續費、稅與股利</span></div><div class=sourceitem><b>部位規模</b>${money(shares)} 股｜市值約 ${money(value)}</div><div class=sourceitem><b>持有設定</b>${hLabel}${days!=null?`｜約 ${days} 個日曆日`:''}</div></div><h3>與出場判斷直接相關的已知事實</h3><div class=sourcegrid><div class=sourceitem><b>價格結構</b>${esc(p.text)}</div><div class=sourceitem><b>營收動能</b>${esc(r.text)}</div><div class=sourceitem><b>估值位置</b>${esc(v.text)}</div><div class=sourceitem><b>風險狀態</b>${esc(risk.text)}</div></div><div class=source-note><b>真正需要的下一步</b><div class=mini>持股頁的核心不是再告訴你 PE、成交量而已，而是要在獨立持股出場模型通過後，明確輸出：續抱／減碼／停利／出場，以及觸發條件與原因。現階段該模型未完成正式 OOS，因此不先捏造賣出價或賣出日期。</div></div>${rawFacts(x,c)}${predictionBlockedHtml('持股出場時機／賣出條件',['holdingExitValidation 必須獨立 PASS'])}`;box.classList.remove('hidden');
  }

  // Any future private backend numeric result must carry its own legal-source and price-verification audit.
  if(window.StockLabAPI){const api=window.StockLabAPI,origAnalyze=api.analyze?.bind(api),origScan=api.scan?.bind(api);api.config.allowLocalFallback=false;if(origAnalyze)api.analyze=async function(code,h){const j=await origAnalyze(code,h),hp=await hardReady(),v=hp.backendResult(j,h==='holding'?'holding':'analysis');if(!v.ok)throw Error(`後端稽核未通過：${v.blockers.join('；')}`);return j};if(origScan)api.scan=async function(h){const j=await origScan(h);if(j?.ok!==true||j?.data?.audit?.legal_source_verified!==true||j?.data?.audit?.price_verified!==true||j?.data?.audit?.oos_validation_passed!==true)throw Error('TOP10 後端稽核未通過');return j}}

  if(analyze){const original=analyze.onclick;analyze.onclick=async function(ev){try{await hardReady();const apiReady=window.StockLabAPI?.config?.enabled===true;if(apiReady||rt.productionPredictionReady===true)return original?.call(this,ev);await renderFacts('#result',document.querySelector('#ticker')?.value,'下一交易時段買入計畫')}catch(e){const box=document.querySelector('#result');box.innerHTML=`<h3 class=bad>查詢失敗</h3><p>${esc(e.message)}</p>`;box.classList.remove('hidden')}}}
  if(scan){const original=scan.onclick;scan.onclick=async function(ev){try{await hardReady();const apiReady=window.StockLabAPI?.config?.enabled===true;if(apiReady||rt.productionPredictionReady===true)return original?.call(this,ev);await renderMarketFacts()}catch(e){const box=document.querySelector('#top10');box.innerHTML=`<h3 class=bad>查詢失敗</h3><p>${esc(e.message)}</p>`;box.classList.remove('hidden')}}}
  if(hold){hold.disabled=false;hold.textContent='查看持股狀態與出場條件';hold.onclick=async function(){try{await hardReady();await renderHoldingFacts()}catch(e){const box=document.querySelector('#holdResult');box.innerHTML=`<h3 class=bad>查詢失敗</h3><p>${esc(e.message)}</p>`;box.classList.remove('hidden')}}}

  // An unvalidated market/model score must not dominate the UI.
  const marketScore=document.querySelector('#marketScore');if(marketScore){marketScore.textContent='—';marketScore.style.display='none';}
  const marketHead=document.querySelector('#marketCard .toprow');if(marketHead&&!marketHead.querySelector('[data-market-score-note]'))marketHead.insertAdjacentHTML('beforeend','<div data-market-score-note class="mini">未顯示未驗證分數</div>');

  window.StockLabCompliance={productionReady:()=>rt.productionPredictionReady===true,unresolvedGates:gateList,blockers:blockedReasons,renderBlock,licensedCache,factorData};
})();
