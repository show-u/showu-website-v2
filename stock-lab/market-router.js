// Single-stock router. Private backend is preferred; local engine exists only as migration fallback.
(function(){
  const btn=document.querySelector('#analyzeBtn');
  if(!btn)return;

  function tickSize(p){if(p<10)return .01;if(p<50)return .05;if(p<100)return .1;if(p<500)return .5;if(p<1000)return 1;return 5}
  function roundTick(p,mode='nearest'){
    const t=tickSize(Math.max(.01,p)),q=p/t,z=mode==='down'?Math.floor(q):mode==='up'?Math.ceil(q):Math.round(q);
    return +(z*t).toFixed(t<.1?2:t<1?1:0);
  }
  function qtile(a,q){
    const v=a.filter(Number.isFinite).sort((x,y)=>x-y);
    if(!v.length)return null;
    const p=(v.length-1)*q,l=Math.floor(p),h=Math.ceil(p);
    return l===h?v[l]:v[l]+(v[h]-v[l])*(p-l);
  }

  // Pre-open pricing is an opening-auction problem, not a pullback/support problem.
  // Anchor on the latest verified official close and the stock's own empirical overnight-gap distribution.
  function openingGapStats(r,look=60){
    if(!r||r.length<22)throw Error('開盤前模型缺少足夠歷史開盤資料');
    const z=[];
    const start=Math.max(1,r.length-look);
    for(let i=start;i<r.length;i++){
      const pc=r[i-1].c,o=r[i].o;
      if(Number.isFinite(pc)&&pc>0&&Number.isFinite(o)&&o>0)z.push(o/pc-1);
    }
    if(z.length<20)throw Error('開盤前跳空樣本不足');
    return{n:z.length,q25:qtile(z,.25),q50:qtile(z,.50),q75:qtile(z,.75)};
  }

  function intradayExcursionStats(r,look=60){
    if(!r||r.length<22)throw Error('當日區間模型資料不足');
    const lows=[],highs=[];
    for(const x of r.slice(-look)){
      if(Number.isFinite(x.o)&&x.o>0&&Number.isFinite(x.l)&&Number.isFinite(x.h)){
        lows.push(x.l/x.o-1);
        highs.push(x.h/x.o-1);
      }
    }
    if(lows.length<20)throw Error('當日波動樣本不足');
    return{
      n:lows.length,
      low10:qtile(lows,.10),low25:qtile(lows,.25),low50:qtile(lows,.50),
      high50:qtile(highs,.50),high75:qtile(highs,.75)
    };
  }

  function taipeiClock(){
    const p={};
    for(const x of new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()))p[x.type]=x.value;
    const date=`${p.year}-${p.month}-${p.day}`,mins=Number(p.hour)*60+Number(p.minute),weekday=p.weekday;
    return{date,mins,weekday};
  }

  function preopenSession(dataDate){
    const n=taipeiClock(),business=!['Sat','Sun'].includes(n.weekday);
    if(!business)return{state:'next',label:'非交易日｜供下一交易日規劃'};
    if(n.mins<510)return{state:'next',label:'08:30前｜供今日盤前規劃'};
    if(n.mins<540)return{state:'active',label:'08:30–09:00｜盤前委託時段'};
    if(n.mins<=810)return{state:'expired',label:'09:00後｜今日盤前掛單已失效'};
    if(dataDate===n.date)return{state:'next',label:'收盤後｜供下一交易日規劃'};
    return{state:'waiting',label:'等待今日官方收盤資料後再產生下一交易日掛單'};
  }

  function dayEntryPlan(r,gap,exc){
    const L=r.at(-1),expectedOpen=L.c*(1+gap.q50);
    let lo=expectedOpen*(1+exc.low25),hi=expectedOpen*(1+exc.low50);
    lo=roundTick(Math.min(lo,hi),'up');
    hi=roundTick(Math.max(lo,hi),'down');
    if(lo>hi)hi=lo;
    return{
      entryLow:lo,entryHigh:hi,
      expectedOpen:roundTick(expectedOpen),
      priceModel:'TW-empirical-open-pullback-v5'
    };
  }

  function preopenPlan(r,a){
    if(!r?.length)throw Error('開盤前模型缺少歷史資料');
    const L=r.at(-1),gap=openingGapStats(r),exc=intradayExcursionStats(r),day=dayEntryPlan(r,gap,exc);
    const expectedLow=roundTick(L.c*(1+gap.q25),'up');
    const expectedMid=roundTick(L.c*(1+gap.q50));
    const expectedHigh=roundTick(L.c*(1+gap.q75),'down');
    const session=preopenSession(L.iso);
    let orderPrice=null;
    // Score determines whether to place a pre-open buy order, not where the opening auction is expected to clear.
    // The actual price anchor is the prior official close + empirical overnight-gap median.
    if(!a.riskBlocked&&a.score>=45)orderPrice=expectedMid;
    const stop=roundTick(day.expectedOpen*(1+exc.low10),'down');
    const target1=roundTick(day.expectedOpen*(1+exc.high50),'down');
    const target2=roundTick(day.expectedOpen*(1+exc.high75),'down');
    return{
      close:L.c,date:L.iso,orderPrice,day,stop,target1,target2,
      gap,exc,expectedLow,expectedMid,expectedHigh,session,
      bias:a.score>=65?'偏多':a.score<45?'偏空':'震盪'
    };
  }

  function safeBand(r,h){try{return window.StockLabTaiwan?.adaptiveBand?window.StockLabTaiwan.adaptiveBand(r,h):null}catch{return null}}
  function bandText(x){return x&&x.entryLow!=null&&x.entryHigh!=null?`${fmt(x.entryLow)}–${fmt(x.entryHigh)}`:'—'}
  function fivePricePlan(r,a){
    const pre=preopenPlan(r,a);
    return{pre,day:pre.day,short:safeBand(r,'1m'),mid:safeBand(r,'3m'),long:safeBand(r,'long')};
  }

  function renderPreopen(code,marketName,a,vf,r){
    const box=document.querySelector('#result'),label=a.stockName?`${a.stockName}／${code}`:code;
    if(!vf.complete){
      box.innerHTML=`<div class=toprow><div><h2>${label}</h2><div class=muted>${marketName}｜開盤前｜當日掛單價格</div></div></div><h3 class=bad>⛔ 資料驗證未通過</h3><p>日期 ${vf.date||'—'}｜${vf.text||'無法交叉驗證'}</p>`;
      box.classList.remove('hidden');return;
    }
    const p=fivePricePlan(r,a),pre=p.pre,blocked=!!a.riskBlocked;
    let prePrice,preNote;
    if(blocked){prePrice='⛔ 不掛單';preNote='處置股或台股風險 Gate 阻擋';}
    else if(pre.session.state==='expired'){
      prePrice='已失效';preNote=`今日盤前模型值 ${pre.orderPrice==null?'等待／不預掛':fmt(pre.orderPrice)}；09:00 後不可再視為今日盤前建議`;
    }else if(pre.session.state==='waiting'){
      prePrice='等待收盤資料';preNote='今日正式收盤尚未進入官方日資料，不產生下一交易日價格';
    }else if(pre.orderPrice==null){prePrice='等待／不預掛';preNote='評分偏弱，不強制產生盤前買單';}
    else{
      prePrice=fmt(pre.orderPrice);
      preNote='限價 ROD；以官方昨收＋個股歷史開盤跳空中位數估算，未使用深層支撐價替代開盤價';
    }

    box.innerHTML=`
      <div class=toprow><div>
        <h2>${label}</h2>
        <div class=muted>${marketName}｜開盤前｜當日掛單價格</div>
        <div class=mini>官方基準 ${pre.date} 收盤 ${fmt(pre.close)}｜${pre.bias}｜${pre.session.label}</div>
      </div><div class=bubble>${a.score}</div></div>
      <div class=source-note>
        <b>資料錨點</b>
        <div class=mini>${marketName} 最新已驗證收盤：${pre.date}｜${fmt(pre.close)}；歷史開盤跳空樣本 ${pre.gap.n} 日，預估開盤區間 ${fmt(pre.expectedLow)}–${fmt(pre.expectedHigh)}。</div>
      </div>
      <div data-five-price-matrix="1"><h3>五種價格</h3><div class=sourcegrid>
        <div class=sourceitem><b>① 開盤前掛單價格</b><div style="font-size:24px;font-weight:900;margin-top:4px">${prePrice}</div><span class=mini>${preNote}</span></div>
        <div class=sourceitem><b>② 當日入場適合區間</b><div style="font-size:24px;font-weight:900;margin-top:4px">${bandText(p.day)}</div><span class=mini>昨收＋歷史開盤跳空＋開盤後回檔分布；盤前預估，非盤中即時價</span></div>
        <div class=sourceitem><b>③ 短線入場區間</b><div style="font-size:24px;font-weight:900;margin-top:4px">${bandText(p.short)}</div><span class=mini>約1個月｜20日結構＋波動；屬等待回檔區，不是今日價格預測</span></div>
        <div class=sourceitem><b>④ 中期入場區間</b><div style="font-size:24px;font-weight:900;margin-top:4px">${bandText(p.mid)}</div><span class=mini>約3個月｜60日結構＋波動；屬等待回檔區</span></div>
        <div class=sourceitem><b>⑤ 長期佈局區間</b><div style="font-size:24px;font-weight:900;margin-top:4px">${bandText(p.long)}</div><span class=mini>1年以上｜長週期結構＋基本面／估值 Gate</span></div>
      </div></div>
      <div class=kpis>
        <div class=kpi><b>${fmt(pre.close)}</b><span>前一交易日收盤</span></div>
        <div class=kpi><b>${fmt(pre.expectedMid)}</b><span>歷史跳空中位開盤估值</span></div>
        <div class=kpi><b>${fmt(pre.stop)}</b><span>歷史日內下行10分位</span></div>
        <div class=kpi><b>${fmt(pre.target1)} / ${fmt(pre.target2)}</b><span>歷史日內上行50/75分位</span></div>
      </div>
      <h3>開盤前價格依據</h3><div class=sourcegrid>
        <div class=sourceitem><b>官方昨收</b>${pre.date}｜${fmt(pre.close)}</div>
        <div class=sourceitem><b>開盤跳空 Q25 / Q50 / Q75</b>${(pre.gap.q25*100).toFixed(2)}% / ${(pre.gap.q50*100).toFixed(2)}% / ${(pre.gap.q75*100).toFixed(2)}%</div>
        <div class=sourceitem><b>預估開盤區間</b>${fmt(pre.expectedLow)}–${fmt(pre.expectedHigh)}</div>
        <div class=sourceitem><b>台股風險 Gate</b>${(a.taiwanRisk?.flags||[]).join('｜')||'無注意／處置／信用交易異常旗標'}</div>
      </div>
      <div class=disclaimer><b>盤前模型邏輯</b>①只估計開盤集合競價可接受的限價 ROD 價格，錨定最新已驗證官方收盤與個股自身歷史隔夜跳空分布；不再把20日支撐、MA或深層回檔價直接當成開盤前掛單價。08:30–09:00 若未接入試撮即時資料，本價格仍屬盤前統計估算；09:00後自動標記失效。</div>`;
    box.classList.remove('hidden');
  }

  function renderPrivate(j){
    const d=j.data||{},box=document.querySelector('#result'),label=d.name?`${d.name}／${d.ticker||'—'}`:(d.ticker||'—'),entry=d.entry_low!=null&&d.entry_high!=null?`${fmt(d.entry_low)}–${fmt(d.entry_high)}`:'—';
    box.innerHTML=`<div class=toprow><div><h2>${label}</h2><div class=muted>${d.exchange||'—'}｜${d.horizon||'—'}｜私有分析引擎</div><div class=mini>${d.action||'資料不足'}｜模型版本 ${j.model_version||'—'}｜資料完整度 ${d.completeness??'—'}%</div></div><div class=bubble>${d.score??'—'}</div></div><div class=source-note><b>建議入場價格區間</b><div style="font-size:24px;font-weight:900;margin-top:4px">${entry}</div></div>`;
    box.classList.remove('hidden');
  }

  async function localAnalyze(code,h){
    const tp=window.StockLabTPEx,[twSnap,tpSnap,ir]=await Promise.all([jget(U.snap),tp?tp.tpexSnapshot().catch(()=>[]):Promise.resolve([]),ihist(6)]),m=market(ir);
    showMarket(m);
    const twRow=twSnap.find(x=>String(x.Code)===code),otcRow=tpSnap.find(x=>x.code===code);
    if(!twRow&&!otcRow)throw Error('官方上市／上櫃快照找不到此代號，或該市場資料健康驗證未通過');
    let r,vf,e,marketName;const modelH=h==='preopen'?'day':h;
    if(otcRow&&!twRow){
      marketName='TPEx';r=await tp.tpexHist(code,h==='long'?12:6);if(!r.length)throw Error('TPEx 歷史行情不足或來源未通過');vf=await tp.verifyTpex(code,r,otcRow);e=await tp.tpexExtras();
    }else{
      marketName='TWSE';r=await hist(code,h==='long'?12:6);if(!r.length)throw Error('TWSE 歷史行情不足');vf=await verify(code,r);e=await extras(r.at(-1).iso);
    }
    if(window.StockLabTaiwan?.loadFactors)await window.StockLabTaiwan.loadFactors();
    const a=combine(tech(r,modelH),modelH,m,e.V.get(code),e.I.get(code),e.R.get(code));
    a.exchange=marketName;a.stockName=twRow?.Name||otcRow?.name||'';
    if(h==='preopen'){renderPreopen(code,marketName,a,vf,r);return;}
    render(code,a,h,vf);
    const result=document.querySelector('#result');
    if(result&&vf.complete){
      const title=result.querySelector('.toprow h2');if(title)title.textContent=`${a.stockName?`${a.stockName}／`:''}${code}`;
      const head=result.querySelector('.toprow .muted');if(head)head.textContent=`${marketName}｜${h}｜過渡本地引擎`;
      const firstKpi=result.querySelector('.kpis');
      if(firstKpi){const entry=`${fmt(a.entryLow)}–${fmt(a.entryHigh)}`;firstKpi.insertAdjacentHTML('beforebegin',`<div class=source-note><b>建議入場價格區間</b><div style="font-size:24px;font-weight:900;margin-top:4px">${entry}</div><div class=mini>${a.action}</div></div>`);}
    }
  }

  btn.onclick=async()=>{
    const code=document.querySelector('#ticker').value.trim(),h=document.querySelector('#horizon').value;
    if(!/^\d{4,6}$/.test(code))return alert('請輸入股票代號');
    document.querySelector('#singleLoad').classList.remove('hidden');
    try{
      const api=window.StockLabAPI;
      if(h!=='preopen'&&api?.config?.enabled){
        try{const j=await api.analyze(code,h);renderPrivate(j);return}catch(e){if(!api.config.allowLocalFallback)throw e;}
      }
      await localAnalyze(code,h);
    }catch(e){
      document.querySelector('#result').innerHTML=`<h3 class=bad>分析失敗</h3><p>${e.message}</p>`;
      document.querySelector('#result').classList.remove('hidden');
    }finally{document.querySelector('#singleLoad').classList.add('hidden');}
  };
})();
