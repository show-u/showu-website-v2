// Single-stock entry router.
// Public UI is intentionally concise: entry range + calibrated confidence + necessary context only.
// Nine entry factors, US market, TX futures and international events remain internal model inputs.
(function(){
  const btn=document.querySelector('#analyzeBtn');if(!btn)return;
  const MISSING='資料未取得／未通過驗證';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function tickSize(p){if(p<10)return .01;if(p<50)return .05;if(p<100)return .1;if(p<500)return .5;if(p<1000)return 1;return 5}
  function roundTick(p,mode='nearest'){const t=tickSize(Math.max(.01,p)),q=p/t,z=mode==='down'?Math.floor(q):mode==='up'?Math.ceil(q):Math.round(q);return +(z*t).toFixed(t<.1?2:t<1?1:0)}
  function qtile(a,q){const v=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!v.length)return null;const p=(v.length-1)*q,l=Math.floor(p),h=Math.ceil(p);return l===h?v[l]:v[l]+(v[h]-v[l])*(p-l)}
  function openingGapStats(r,look=60){if(!r||r.length<60)throw Error('買入模型有效日線不足 60 根');const z=[],start=Math.max(1,r.length-look);for(let i=start;i<r.length;i++){const pc=r[i-1].c,o=r[i].o;if(Number.isFinite(pc)&&pc>0&&Number.isFinite(o)&&o>0)z.push(o/pc-1)}if(z.length<40)throw Error(`隔夜開盤有效樣本不足：${z.length}/40`);return{n:z.length,q25:qtile(z,.25),q50:qtile(z,.50),q75:qtile(z,.75),provenance:'derived'}}
  function intradayPullbackStats(r,look=60){if(!r||r.length<60)throw Error('盤中回檔模型有效日線不足 60 根');const lows=[];for(const x of r.slice(-look))if(Number.isFinite(x.o)&&x.o>0&&Number.isFinite(x.l)&&x.l>0)lows.push(x.l/x.o-1);if(lows.length<40)throw Error(`盤中回檔有效樣本不足：${lows.length}/40`);return{n:lows.length,q25:qtile(lows,.25),q50:qtile(lows,.50),provenance:'derived'}}
  function taipeiClock(){const p={};for(const x of new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()))p[x.type]=x.value;const mins=Number(p.hour)*60+Number(p.minute),business=!['Sat','Sun'].includes(p.weekday);let phase='closed';if(business&&mins<510)phase='before-orders';else if(business&&mins<540)phase='preopen';else if(business&&mins<805)phase='continuous';else if(business&&mins<810)phase='closing-auction';return{date:`${p.year}-${p.month}-${p.day}`,mins,weekday:p.weekday,business,phase}}
  function targetContext(dataDate){const now=taipeiClock(),sameDate=dataDate===now.date;return{now,sameDate,targetLabel:`${dataDate} 完成交易資料所建立的下一交易日計畫`,provenance:'derived'}}
  function buildBuyPlan(r){
    const L=r?.at(-1);if(!L||!Number.isFinite(L.c))throw Error('買入模型缺少最新已驗證收盤');
    const gap=openingGapStats(r),pull=intradayPullbackStats(r),target=targetContext(L.iso),expectedOpen=L.c*(1+gap.q50),a=expectedOpen*(1+pull.q25),b=expectedOpen*(1+pull.q50),entryLow=roundTick(Math.min(a,b),'up'),entryHigh0=roundTick(Math.max(a,b),'down'),entryHigh=entryHigh0<entryLow?entryLow:entryHigh0;
    return{model:'TW-next-session-entry-v3',baseDate:L.iso,baseClose:L.c,target,gap,pull,entryLow,entryHigh,provenance:{baseClose:'observed',gap:'derived',pullback:'derived',entryRange:'model_estimate'}}
  }
  function productionGate(a,vf,entry){
    const rt=window.STOCKLAB_RUNTIME||{},reasons=[];
    if(rt.gates?.licensedHistoricalOHLC!==true)reasons.push('合法歷史行情尚未完成');
    if(rt.gates?.securityMaster!==true)reasons.push('商品分類尚未完成');
    if(rt.gates?.tradingCalendar!==true)reasons.push('台股交易日曆尚未完成');
    if(rt.gates?.corporateActions!==true)reasons.push('公司行動／參考價檢查尚未完成');
    if(rt.gates?.taiwanRiskState!==true)reasons.push('注意／處置等交易狀態尚未完成');
    if(rt.gates?.entryNineFactors!==true)reasons.push('入場因子尚未完整');
    if(rt.gates?.usMarketContext!==true)reasons.push('美股背景尚未完整');
    if(rt.gates?.txFuturesContext!==true)reasons.push('台指期背景尚未完整');
    if(rt.gates?.internationalEventFeed!==true)reasons.push('國際時事背景尚未完整');
    if(rt.gates?.entryDecisionOosValidation!==true)reasons.push('入場模型正式 OOS 尚未通過');
    if(rt.gates?.entryRangeExecutionValidation!==true)reasons.push('進場區間 OOS 觸價／成交可達性尚未通過');
    if(rt.gates?.entryConfidenceCalibration!==true)reasons.push('信心指數尚未完成樣本外校準');
    if(!vf?.complete)reasons.push('最新官方收盤交叉驗證未通過');
    if(entry?.summary?.complete!==true)reasons.push('必要內部資料仍有缺漏');
    if(a?.riskBlocked)reasons.push('個股交易風險狀態阻擋');
    return{ok:reasons.length===0,reasons};
  }
  function renderBlocked(box,label,marketName,baseDate,baseClose,reasons){
    box.innerHTML=`<div class=toprow><div><h2>${esc(label)}</h2><div class=muted>${esc(marketName)}｜想買這檔</div></div></div><div class=source-note><b class=bad>暫不提供進場價格</b><div class=mini>${baseDate?`最新已驗證收盤：${esc(baseDate)}｜${fmt(baseClose)}<br>`:''}${reasons.map(esc).join('；')}</div></div><div class=disclaimer><b>原因</b>StockLab 不會用舊值、0、平均值、未驗證網站或 AI 生成值補足缺口。信心指數也不會在正式樣本外校準完成前硬算一個數字。</div>`;
    box.classList.remove('hidden');
  }
  function renderBuy(code,marketName,a,vf,r){
    const box=document.querySelector('#result'),label=a.stockName?`${a.stockName}／${code}`:code;
    if(!vf.complete){renderBlocked(box,label,marketName,vf.date,null,[vf.text||'最新官方價格無法交叉驗證']);return}
    const entry=window.StockLabEntryDecision?.evaluate?window.StockLabEntryDecision.evaluate(r,a):null,plan=buildBuyPlan(r),gate=productionGate(a,vf,entry);
    if(!gate.ok){renderBlocked(box,label,marketName,plan.baseDate,plan.baseClose,gate.reasons);return}
    const ci=entry?.confidenceIndex,calibrated=entry?.confidenceCalibrated===true&&Number.isFinite(Number(ci));
    if(!calibrated){renderBlocked(box,label,marketName,plan.baseDate,plan.baseClose,['信心指數缺少正式樣本外校準結果']);return}
    const confidence=Math.max(0,Math.min(100,Math.round(Number(ci)))),risk=(a.taiwanRisk?.flags||[]).filter(Boolean),riskText=risk.length?risk.join('｜'):'未發現已驗證的特殊交易風險旗標';
    box.innerHTML=`<div class=toprow><div><h2>${esc(label)}</h2><div class=muted>${esc(marketName)}｜想買這檔</div><div class=mini>資料基準 ${esc(plan.baseDate)}｜最新官方收盤 ${fmt(plan.baseClose)}</div></div></div>
      <div class=decision-strip><div class=sourceitem><div class=hero-label>建議進場區間</div><div class=hero-number>${fmt(plan.entryLow)}–${fmt(plan.entryHigh)}</div><div class=mini>${esc(plan.target.targetLabel)}</div></div><div class=sourceitem><div class=hero-label>信心指數</div><div class=hero-number>${confidence}</div><div class=mini>/100｜已校準；不是上漲機率</div></div></div>
      <div class=source-note><b>${esc(entry?.summary?.decision||'入場條件已通過')}</b><div class=mini>必要風險：${esc(riskText)}</div></div>
      <div class=disclaimer><b>價格性質</b>這是由最新完成交易日建立的下一交易日模型區間，且必須先通過 OOS 觸價／成交可達性驗證；不是盤中即時報價。沒有合法即時／延遲行情時，盤中不會重新把舊資料冒充現在價格。</div>`;
    box.classList.remove('hidden');
  }
  function renderPrivate(j){
    const hp=window.StockLabHardPolicy?.backendResult?.(j,'analysis');if(hp&&hp.ok!==true)throw Error(`後端結果未通過硬規則：${hp.blockers.join('；')}`);
    const d=j.data||{},box=document.querySelector('#result'),label=d.name?`${d.name}／${d.ticker||'—'}`:(d.ticker||'—'),low=Number(d.entry_low),high=Number(d.entry_high),ci=Number(d.confidence_index),cal=d.audit?.confidence_calibrated===true;
    if(!Number.isFinite(low)||!Number.isFinite(high)||low<=0||high<low)throw Error('後端沒有提供有效的進場價格區間');
    if(!cal||!Number.isFinite(ci)||ci<0||ci>100)throw Error('信心指數尚未完成正式樣本外校準');
    const risks=Array.isArray(d.risks)?d.risks.filter(Boolean):[],riskText=risks[0]||'沒有額外需要揭露的已驗證風險';
    box.innerHTML=`<div class=toprow><div><h2>${esc(label)}</h2><div class=muted>${esc(d.exchange||'—')}｜想買這檔</div><div class=mini>資料基準 ${esc(d.data_date||'—')}${d.close!=null?`｜最新官方收盤 ${fmt(d.close)}`:''}</div></div></div>
      <div class=decision-strip><div class=sourceitem><div class=hero-label>建議進場區間</div><div class=hero-number>${fmt(low)}–${fmt(high)}</div><div class=mini>${esc(d.target_session_label||'下一個模型適用交易時段')}</div></div><div class=sourceitem><div class=hero-label>信心指數</div><div class=hero-number>${Math.round(ci)}</div><div class=mini>/100｜已校準；不是上漲機率</div></div></div>
      <div class=source-note><b>${esc(d.action||'入場判斷')}</b><div class=mini>${d.reason?esc(d.reason)+'<br>':''}必要風險：${esc(riskText)}</div></div>`;
    box.classList.remove('hidden');
  }
  async function localAnalyze(code){
    const loader=window.StockLabLicensedHistory;if(!loader?.load)throw Error('合法歷史行情介面尚未接入；禁止改用未授權網站歷史資料補值');
    const [twSnap,tpSnap]=await Promise.all([jget(U.snap),window.StockLabTPEx?window.StockLabTPEx.tpexSnapshot().catch(()=>[]):Promise.resolve([])]),twRow=twSnap.find(x=>String(x.Code)===code),otcRow=tpSnap.find(x=>x.code===code);if(!twRow&&!otcRow)throw Error('合法公開資料中找不到此代號');
    const marketName=otcRow&&!twRow?'TPEx':'TWSE',r=await loader.load({code,market:marketName,minimumBars:60});if(!Array.isArray(r)||r.length<60)throw Error('合法歷史行情不足');
    const vf=marketName==='TWSE'?await verify(code,r):await window.StockLabTPEx.verifyTpex(code,r,otcRow);if(window.StockLabTaiwan?.loadFactors)await window.StockLabTaiwan.loadFactors();
    const a=tech(r);a.exchange=marketName;a.stockName=twRow?.Name||otcRow?.name||'';a.integrity={price:{ok:vf.complete},institution:{ok:false}};a.inst=null;
    const risk=window.StockLabTaiwan?.riskState?window.StockLabTaiwan.riskState(code,marketName):{flags:['台股風險狀態未取得'],riskBlocked:false,verified:false};a.industry=risk.industry||null;a.sectorFamily=window.StockLabTaiwan?.sectorFamily?window.StockLabTaiwan.sectorFamily(a.industry):null;a.riskBlocked=risk.riskBlocked===true;a.taiwanRisk=risk;
    if(marketName==='TPEx'&&window.StockLabTPEx){try{const e=await window.StockLabTPEx.tpexExtras(),i=e.I.get(code);if(i&&i.date===vf.date){a.inst=i;a.integrity.institution={ok:true,date:i.date}}}catch{}}
    renderBuy(code,marketName,a,vf,r)
  }
  btn.onclick=async()=>{const code=document.querySelector('#ticker').value.trim();if(!/^\d{4,6}$/.test(code))return alert('請輸入股票代號');document.querySelector('#singleLoad').classList.remove('hidden');try{const api=window.StockLabAPI;if(api?.config?.enabled){try{const j=await api.analyze(code);renderPrivate(j);return}catch(e){if(!api.config.allowLocalFallback)throw e}}await localAnalyze(code)}catch(e){const box=document.querySelector('#result');box.innerHTML=`<h3 class=bad>⛔ 暫不提供進場價格</h3><p>${esc(e.message)}</p><div class=disclaimer><b>NO IMPUTATION</b>缺資料、授權不明、來源失敗或驗證失敗時，只回報缺口，不以任何假資訊補值。</div>`;box.classList.remove('hidden')}finally{document.querySelector('#singleLoad').classList.add('hidden')}};
})();