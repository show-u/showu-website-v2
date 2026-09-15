// Single-stock buy router. Buy-entry and existing-position exit models are deliberately separate.
(function(){
  const btn=document.querySelector('#analyzeBtn');
  if(!btn)return;

  function tickSize(p){if(p<10)return .01;if(p<50)return .05;if(p<100)return .1;if(p<500)return .5;if(p<1000)return 1;return 5}
  function roundTick(p,mode='nearest'){const t=tickSize(Math.max(.01,p)),q=p/t,z=mode==='down'?Math.floor(q):mode==='up'?Math.ceil(q):Math.round(q);return +(z*t).toFixed(t<.1?2:t<1?1:0)}
  function qtile(a,q){const v=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!v.length)return null;const p=(v.length-1)*q,l=Math.floor(p),h=Math.ceil(p);return l===h?v[l]:v[l]+(v[h]-v[l])*(p-l)}
  function openingGapStats(r,look=60){
    if(!r||r.length<60)throw Error('買入模型有效日線不足 60 根');
    const z=[],start=Math.max(1,r.length-look);
    for(let i=start;i<r.length;i++){const pc=r[i-1].c,o=r[i].o;if(Number.isFinite(pc)&&pc>0&&Number.isFinite(o)&&o>0)z.push(o/pc-1)}
    if(z.length<40)throw Error(`隔夜開盤有效樣本不足：${z.length}/40`);
    return{n:z.length,q25:qtile(z,.25),q50:qtile(z,.50),q75:qtile(z,.75),provenance:'derived'};
  }
  function intradayPullbackStats(r,look=60){
    if(!r||r.length<60)throw Error('盤中回檔模型有效日線不足 60 根');
    const lows=[];
    for(const x of r.slice(-look))if(Number.isFinite(x.o)&&x.o>0&&Number.isFinite(x.l)&&x.l>0)lows.push(x.l/x.o-1);
    if(lows.length<40)throw Error(`盤中回檔有效樣本不足：${lows.length}/40`);
    return{n:lows.length,q25:qtile(lows,.25),q50:qtile(lows,.50),provenance:'derived'};
  }
  function taipeiClock(){
    const p={};for(const x of new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()))p[x.type]=x.value;
    const mins=Number(p.hour)*60+Number(p.minute),business=!['Sat','Sun'].includes(p.weekday);
    let phase='closed';if(business&&mins<510)phase='before-orders';else if(business&&mins<540)phase='preopen';else if(business&&mins<805)phase='continuous';else if(business&&mins<810)phase='closing-auction';
    return{date:`${p.year}-${p.month}-${p.day}`,mins,weekday:p.weekday,business,phase};
  }
  function targetContext(dataDate){
    const now=taipeiClock(),sameDate=dataDate===now.date;
    const phaseLabel={
      'before-orders':'目前台北時間尚未到 08:30',preopen:'目前為 08:30–09:00 盤前委託時段',continuous:'目前為 09:00–13:25 盤中逐筆交易時段','closing-auction':'目前為 13:25–13:30 收盤集合競價時段',closed:'目前非一般盤交易時段'
    }[now.phase];
    const dataLabel=sameDate?'最新已驗證資料已包含今日收盤；新計畫只適用於下一交易日':'最新已驗證資料尚未包含今日收盤；不因時鐘已過 09:00 或 13:30 就自動改用假想的次日資料';
    return{now,sameDate,targetLabel:`基準交易日 ${dataDate} 之後的下一交易日`,phaseLabel,dataLabel,provenance:'derived'};
  }
  function buildBuyPlan(r){
    const L=r?.at(-1);if(!L||!Number.isFinite(L.c))throw Error('買入模型缺少最新已驗證收盤');
    const gap=openingGapStats(r),pull=intradayPullbackStats(r),target=targetContext(L.iso),expectedOpen=L.c*(1+gap.q50);
    const preopenLimit=roundTick(expectedOpen);
    const a=expectedOpen*(1+pull.q25),b=expectedOpen*(1+pull.q50),waitLow=roundTick(Math.min(a,b),'up'),waitHigh=roundTick(Math.max(a,b),'down');
    return{
      model:'TW-next-session-entry-v1',baseDate:L.iso,baseClose:L.c,target,gap,pull,
      preopenLimit,waitLow,waitHigh:waitHigh<waitLow?waitLow:waitHigh,
      expectedOpenRange:[roundTick(L.c*(1+gap.q25),'up'),roundTick(L.c*(1+gap.q75),'down')],
      provenance:{baseClose:'observed',gap:'derived',pullback:'derived',preopenLimit:'model_estimate',waitZone:'model_estimate'}
    };
  }
  function productionGate(a,vf){
    const rt=window.STOCKLAB_RUNTIME||{},reasons=[];
    if(rt.gates?.licensedHistoricalOHLC!==true)reasons.push('合法歷史 OHLC Gate 未通過');
    if(rt.gates?.securityMaster!==true)reasons.push('商品分類 Gate 未通過');
    if(rt.gates?.tradingCalendar!==true)reasons.push('台股交易日曆 Gate 未通過');
    if(rt.gates?.corporateActions!==true)reasons.push('公司行動／參考價 Gate 未通過');
    if(rt.gates?.taiwanRiskState!==true)reasons.push('注意／處置／特殊交易狀態 Gate 未通過');
    if(rt.gates?.buyModelOosValidation!==true)reasons.push('買入模型正式 OOS Gate 未通過');
    if(!vf?.complete)reasons.push('最新官方收盤交叉驗證未通過');
    if(a?.riskBlocked)reasons.push('個股台股風險 Gate 阻擋');
    return{ok:reasons.length===0,reasons};
  }
  function renderBuy(code,marketName,a,vf,r){
    const box=document.querySelector('#result'),label=a.stockName?`${a.stockName}／${code}`:code;
    if(!vf.complete){box.innerHTML=`<div class=toprow><div><h2>${label}</h2><div class=muted>${marketName}｜購買股票分析</div></div></div><h3 class=bad>⛔ 資料驗證未通過</h3><p>${vf.text||'最新官方價格無法交叉驗證'}</p>`;box.classList.remove('hidden');return;}
    const plan=buildBuyPlan(r),gate=productionGate(a,vf),now=plan.target.now;
    const preopenNow=gate.ok&&now.phase==='preopen'&&!plan.target.sameDate;
    const preopenStatus=preopenNow?'目前可作盤前限價 ROD 參考':'模型計畫值；目前不可標示為即時可執行報價';
    const dayStatus=now.phase==='continuous'?'盤中是否仍能成交未知：公開版沒有合法即時行情，不追價、不假裝知道目前成交價':now.phase==='closed'||now.phase==='closing-auction'?'本交易日一般盤已接近／完成收盤；等待官方收盤資料日期更新後才建立新計畫':'盤中回檔等待條件；價格未到就不交易，不把深層支撐冒充目前可買價';
    box.innerHTML=`
      <div data-buy-plan="1" class=toprow><div><h2>${label}</h2><div class=muted>${marketName}｜下一交易時段買入分析</div><div class=mini>官方基準 ${plan.baseDate} 收盤 ${fmt(plan.baseClose)}｜${plan.target.targetLabel}</div></div><div><div class=bubble>${a.score}</div><div class=mini style="text-align:center">研究分數／非機率</div></div></div>
      <div class=source-note><b>時間判定不是看「過了 09:00 就變明天」</b><div class=mini>${plan.target.dataLabel}<br>${plan.target.phaseLabel}。只有官方最新已完成交易日真的前進並通過驗證，才重算新的下一交易日計畫。</div></div>
      ${gate.ok?'':`<div class=source-note><b>⛔ 目前不輸出可執行價格</b><div class=mini>${gate.reasons.join('；')}。下列若顯示模型研究值，也不得視為推薦或目前行情。</div></div>`}
      <h3>下一交易日計畫</h3><div class=sourcegrid>
        <div class=sourceitem><b>盤前限價 ROD 模型值</b><div style="font-size:24px;font-weight:900;margin-top:4px">${gate.ok?fmt(plan.preopenLimit):'資料未取得／未通過驗證'}</div><span class=mini>${preopenStatus}；08:30–09:00 才是盤前 ROD 執行時段</span></div>
        <div class=sourceitem><b>盤中回檔等待區</b><div style="font-size:24px;font-weight:900;margin-top:4px">${gate.ok?`${fmt(plan.waitLow)}–${fmt(plan.waitHigh)}`:'資料未取得／未通過驗證'}</div><span class=mini>${dayStatus}</span></div>
      </div>
      <h3>資料與推估分離</h3><div class=sourcegrid>
        <div class=sourceitem><b>最新已驗證收盤｜observed</b>${plan.baseDate}｜${fmt(plan.baseClose)}</div>
        <div class=sourceitem><b>歷史隔夜跳空｜derived</b>樣本 ${plan.gap.n}｜Q25 ${(plan.gap.q25*100).toFixed(2)}%｜中位數 ${(plan.gap.q50*100).toFixed(2)}%｜Q75 ${(plan.gap.q75*100).toFixed(2)}%</div>
        <div class=sourceitem><b>開盤估值範圍｜model_estimate</b>${gate.ok?`${fmt(plan.expectedOpenRange[0])}–${fmt(plan.expectedOpenRange[1])}`:'資料未取得／未通過驗證'}</div>
        <div class=sourceitem><b>台股風險狀態</b>${(a.taiwanRisk?.flags||[]).join('｜')||'資料未取得／未通過驗證'}</div>
      </div>
      <div class=disclaimer><b>買入模型規則</b>短／中／長深層支撐不再出現在買入頁。價格未到「盤中回檔等待區」時，模型的意思是等待或不交易，而不是把一個買不到的價格宣稱成目前建議價。沒有合法、正確、完整資料就不補值。</div>`;
    box.classList.remove('hidden');
  }
  function renderPrivate(j){
    const d=j.data||{},box=document.querySelector('#result'),label=d.name?`${d.name}／${d.ticker||'—'}`:(d.ticker||'—');
    const entry=d.entry_price!=null?fmt(d.entry_price):d.entry_low!=null&&d.entry_high!=null?`${fmt(d.entry_low)}–${fmt(d.entry_high)}`:'資料未取得／未通過驗證';
    box.innerHTML=`<div data-buy-plan="1" class=toprow><div><h2>${label}</h2><div class=muted>${d.exchange||'—'}｜下一交易時段｜私有分析引擎</div><div class=mini>資料日 ${d.data_date||'—'}｜模型 ${j.model_version||'—'}</div></div><div><div class=bubble>${d.score??'—'}</div><div class=mini>研究分數／非機率</div></div></div><div class=source-note><b>買入計畫</b><div style="font-size:24px;font-weight:900;margin-top:4px">${entry}</div><div class=mini>${d.action||'—'}</div></div>`;box.classList.remove('hidden');
  }
  async function localAnalyze(code){
    const loader=window.StockLabLicensedHistory;
    if(!loader?.load)throw Error('合法歷史行情介面尚未接入；禁止改用未授權網站歷史資料補值');
    const [twSnap,tpSnap,ir]=await Promise.all([jget(U.snap),window.StockLabTPEx?window.StockLabTPEx.tpexSnapshot().catch(()=>[]):Promise.resolve([]),ihist(6)]),m=market(ir);showMarket(m);
    const twRow=twSnap.find(x=>String(x.Code)===code),otcRow=tpSnap.find(x=>x.code===code);if(!twRow&&!otcRow)throw Error('合法公開資料中找不到此代號');
    const marketName=otcRow&&!twRow?'TPEx':'TWSE',r=await loader.load({code,market:marketName,minimumBars:60});if(!Array.isArray(r)||r.length<60)throw Error('合法歷史行情不足');
    const vf=marketName==='TWSE'?await verify(code,r):await window.StockLabTPEx.verifyTpex(code,r,otcRow);
    const e=marketName==='TWSE'?await extras(r.at(-1).iso):await window.StockLabTPEx.tpexExtras();if(window.StockLabTaiwan?.loadFactors)await window.StockLabTaiwan.loadFactors();
    const a=combine(tech(r,'day'),'day',m,e.V.get(code),e.I.get(code),e.R.get(code));a.exchange=marketName;a.stockName=twRow?.Name||otcRow?.name||'';renderBuy(code,marketName,a,vf,r);
  }
  btn.onclick=async()=>{
    const code=document.querySelector('#ticker').value.trim();if(!/^\d{4,6}$/.test(code))return alert('請輸入股票代號');document.querySelector('#singleLoad').classList.remove('hidden');
    try{
      const api=window.StockLabAPI;if(api?.config?.enabled){try{const j=await api.analyze(code,'buy');renderPrivate(j);return}catch(e){if(!api.config.allowLocalFallback)throw e;}}
      await localAnalyze(code);
    }catch(e){document.querySelector('#result').innerHTML=`<h3 class=bad>分析停止</h3><p>${e.message}</p><p class=mini>依 Hard Policy：缺資料、授權不明或驗證失敗時，不使用其他來源或 AI 推測補齊。</p>`;document.querySelector('#result').classList.remove('hidden');}
    finally{document.querySelector('#singleLoad').classList.add('hidden')}
  };
})();
