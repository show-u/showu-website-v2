// Single-stock router. Private backend is preferred; local engine exists only as a migration research path.
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
  function openingGapStats(r,look=60){
    if(typeof historyIntegrity==='function'){
      const g=historyIntegrity(r,'preopen');if(!g.ok)throw Error(g.reason);
    }
    if(!r||r.length<60)throw Error('開盤前模型有效日線不足 60 根');
    const z=[],start=Math.max(1,r.length-look);
    for(let i=start;i<r.length;i++){
      const pc=r[i-1].c,o=r[i].o;
      if(Number.isFinite(pc)&&pc>0&&Number.isFinite(o)&&o>0)z.push(o/pc-1);
    }
    if(z.length<40)throw Error(`開盤前跳空有效樣本不足：${z.length}/40`);
    return{n:z.length,q25:qtile(z,.25),q50:qtile(z,.50),q75:qtile(z,.75),provenance:'derived'};
  }
  function intradayExcursionStats(r,look=60){
    if(!r||r.length<60)throw Error('當日區間模型有效日線不足 60 根');
    const lows=[],highs=[];
    for(const x of r.slice(-look)){
      if(Number.isFinite(x.o)&&x.o>0&&Number.isFinite(x.l)&&Number.isFinite(x.h)&&x.l>0&&x.h>0){
        lows.push(x.l/x.o-1);highs.push(x.h/x.o-1);
      }
    }
    if(lows.length<40)throw Error(`當日波動有效樣本不足：${lows.length}/40`);
    return{n:lows.length,low10:qtile(lows,.10),low25:qtile(lows,.25),low50:qtile(lows,.50),high50:qtile(highs,.50),high75:qtile(highs,.75),provenance:'derived'};
  }
  function taipeiClock(){
    const p={};
    for(const x of new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()))p[x.type]=x.value;
    return{date:`${p.year}-${p.month}-${p.day}`,mins:Number(p.hour)*60+Number(p.minute),weekday:p.weekday};
  }
  function preopenSession(dataDate){
    const n=taipeiClock(),business=!['Sat','Sun'].includes(n.weekday);
    if(!business)return{state:'next-unknown',label:'非交易日｜下一交易日需另行確認',targetKnown:false};
    if(n.mins<510)return{state:'next',label:'08:30前｜供今日盤前規劃',targetKnown:true,targetDate:n.date};
    if(n.mins<540)return{state:'active',label:'08:30–09:00｜盤前委託時段',targetKnown:true,targetDate:n.date};
    if(n.mins<=810)return{state:'expired',label:'09:00後｜今日盤前掛單已失效',targetKnown:true,targetDate:n.date};
    if(dataDate===n.date)return{state:'next-unknown',label:'收盤後｜下一交易日需先確認交易日與公司行動',targetKnown:false};
    return{state:'waiting',label:'等待今日官方收盤資料後再產生下一交易日研究估值',targetKnown:false};
  }
  function dayEntryPlan(r,gap,exc){
    const L=r.at(-1),expectedOpen=L.c*(1+gap.q50);
    let a=expectedOpen*(1+exc.low25),b=expectedOpen*(1+exc.low50);
    const lo=roundTick(Math.min(a,b),'up'),hi=roundTick(Math.max(a,b),'down');
    return{entryLow:lo,entryHigh:hi<lo?lo:hi,expectedOpen:roundTick(expectedOpen),priceModel:'TW-empirical-open-pullback-v6',provenance:'model_estimate'};
  }
  function preopenPlan(r,a){
    const L=r?.at(-1);if(!L)throw Error('開盤前模型缺少歷史資料');
    const gap=openingGapStats(r),exc=intradayExcursionStats(r),day=dayEntryPlan(r,gap,exc),session=preopenSession(L.iso);
    const expectedLow=roundTick(L.c*(1+gap.q25),'up'),expectedMid=roundTick(L.c*(1+gap.q50)),expectedHigh=roundTick(L.c*(1+gap.q75),'down');
    const riskKnown=a?.taiwanRisk?.executionRiskKnown===true;
    const corporateKnown=window.STOCKLAB_RUNTIME?.gates?.corporateActions===true;
    const formalOos=window.STOCKLAB_RUNTIME?.gates?.oosValidation===true;
    let executablePrice=null,blockReason=null;
    if(!riskKnown)blockReason='處置／特殊交易風險狀態未完整驗證';
    else if(!corporateKnown)blockReason='除權息／減資／新上市等參考價事件 Gate 尚未完整驗證';
    else if(!formalOos)blockReason='盤前模型尚未取得合法歷史資料上的正式 OOS PASS';
    else if(a.riskBlocked)blockReason='台股風險 Gate 阻擋';
    else if(!session.targetKnown)blockReason='下一交易日尚未精確確認';
    else if(a.score<45)blockReason='研究分數偏弱，不產生買進掛單';
    else executablePrice=expectedMid;
    return{close:L.c,date:L.iso,researchPrice:expectedMid,orderPrice:executablePrice,blockReason,day,gap,exc,expectedLow,expectedMid,expectedHigh,session,bias:a.score>=65?'偏多':a.score<45?'偏空':'震盪',provenance:'model_estimate'};
  }
  function bandGate(a,h){
    const q=a?.integrity||{},riskKnown=a?.taiwanRisk?.executionRiskKnown===true,formalOos=window.STOCKLAB_RUNTIME?.gates?.oosValidation===true;
    const reasons=[];
    if(!riskKnown)reasons.push('處置／特殊交易風險狀態未完整驗證');
    if(a?.riskBlocked)reasons.push('台股風險 Gate 阻擋');
    if(!formalOos)reasons.push('尚未取得合法歷史資料上的正式 OOS PASS');
    if(h==='1m'&&!q.revenue?.ok)reasons.push('月營收未通過期別驗證');
    if(h==='3m'){
      if(!q.revenue?.ok)reasons.push('月營收未通過期別驗證');
      if(a?.fin?.accountingClass==='general'&&!q.quarterly?.ok)reasons.push('一般業季報未通過完整性驗證');
      if(a?.fin?.accountingClass!=='general')reasons.push('該會計類型尚未支援中期財務模型');
    }
    if(h==='long'){
      if(!q.valuation?.ok)reasons.push('估值未通過日期驗證');
      if(!q.revenue?.ok)reasons.push('月營收未通過期別驗證');
      if(a?.fin?.accountingClass!=='general')reasons.push('該會計類型尚未支援長期財務模型');
      else if(!q.quarterly?.ok)reasons.push('一般業季報未通過完整性驗證');
    }
    return{ok:reasons.length===0,reasons};
  }
  function safeBand(r,h,a){
    const g=bandGate(a,h);if(!g.ok)return{band:null,error:g.reasons.join('；')};
    try{const b=window.StockLabTaiwan?.adaptiveBand?window.StockLabTaiwan.adaptiveBand(r,h):null;return b?{band:b,error:null}:{band:null,error:'價格模型不可用'};}catch(e){return{band:null,error:e.message||'價格模型不可用'};}
  }
  function bandText(x){return x?.band&&x.band.entryLow!=null&&x.band.entryHigh!=null?`${fmt(x.band.entryLow)}–${fmt(x.band.entryHigh)}`:'資料未取得／未通過驗證'}
  function bandReason(x,okText){return x?.band?okText:(x?.error||'資料未取得／未通過驗證')}
  function fivePricePlan(r,a){const pre=preopenPlan(r,a);return{pre,day:pre.day,short:safeBand(r,'1m',a),mid:safeBand(r,'3m',a),long:safeBand(r,'long',a)}}

  function renderPreopen(code,marketName,a,vf,r){
    const box=document.querySelector('#result'),label=a.stockName?`${a.stockName}／${code}`:code;
    if(!vf.complete){box.innerHTML=`<div class=toprow><div><h2>${label}</h2><div class=muted>${marketName}｜開盤前研究</div></div></div><h3 class=bad>⛔ 資料驗證未通過</h3><p>日期 ${vf.date||'—'}｜${vf.text||'無法交叉驗證'}</p>`;box.classList.remove('hidden');return;}
    const p=fivePricePlan(r,a),pre=p.pre;
    let prePrice='資料未取得／未通過驗證',preNote=pre.blockReason||'必要 Gate 未通過';
    if(pre.session.state==='expired'){prePrice='已失效';preNote=`09:00 後不再輸出今日盤前可執行價格；研究估值為 ${fmt(pre.researchPrice)}`;}
    else if(pre.session.state==='waiting'){prePrice='等待官方收盤資料';preNote='不使用盤中／舊收盤資料冒充下一交易日基準';}
    else if(pre.orderPrice!=null){prePrice=fmt(pre.orderPrice);preNote='已通過必要 Gate 的限價 ROD 模型價格';}
    const riskText=(a.taiwanRisk?.flags||[]).join('｜')||'風險狀態未完整驗證';
    box.innerHTML=`
      <div class=toprow><div><h2>${label}</h2><div class=muted>${marketName}｜五種價格稽核</div><div class=mini>官方基準 ${pre.date} 收盤 ${fmt(pre.close)}｜${pre.session.label}</div></div><div><div class=bubble>${a.score}</div><div class=mini style="text-align:center">研究分數／非機率</div></div></div>
      <div class=source-note><b>資料錨點｜觀測值</b><div class=mini>${marketName} 最新已驗證收盤：${pre.date}｜${fmt(pre.close)}。歷史開盤跳空樣本 ${pre.gap.n}；其餘價格皆為模型估算，不是官方行情。</div></div>
      <div data-five-price-matrix="1"><h3>五種價格</h3><div class=sourcegrid>
        <div class=sourceitem><b>① 開盤前掛單價格</b><div style="font-size:24px;font-weight:900;margin-top:4px">${prePrice}</div><span class=mini>${preNote}</span></div>
        <div class=sourceitem><b>② 當日入場適合區間</b><div style="font-size:24px;font-weight:900;margin-top:4px">${pre.blockReason?'資料未取得／未通過驗證':`${fmt(p.day.entryLow)}–${fmt(p.day.entryHigh)}`}</div><span class=mini>${pre.blockReason||'模型估算：昨收＋歷史跳空＋開盤後回檔分布；非即時行情'}</span></div>
        <div class=sourceitem><b>③ 短線入場區間</b><div style="font-size:24px;font-weight:900;margin-top:4px">${bandText(p.short)}</div><span class=mini>${bandReason(p.short,'約1個月｜20日結構＋波動｜模型估算')}</span></div>
        <div class=sourceitem><b>④ 中期入場區間</b><div style="font-size:24px;font-weight:900;margin-top:4px">${bandText(p.mid)}</div><span class=mini>${bandReason(p.mid,'約3個月｜60日結構＋財務 Gate｜模型估算')}</span></div>
        <div class=sourceitem><b>⑤ 長期佈局區間</b><div style="font-size:24px;font-weight:900;margin-top:4px">${bandText(p.long)}</div><span class=mini>${bandReason(p.long,'1年以上｜長週期結構＋估值／財務 Gate｜模型估算')}</span></div>
      </div></div>
      <h3>盤前研究統計｜非可執行行情</h3><div class=sourcegrid>
        <div class=sourceitem><b>官方昨收｜observed</b>${pre.date}｜${fmt(pre.close)}</div>
        <div class=sourceitem><b>歷史跳空 Q25 / Q50 / Q75｜derived</b>${(pre.gap.q25*100).toFixed(2)}% / ${(pre.gap.q50*100).toFixed(2)}% / ${(pre.gap.q75*100).toFixed(2)}%</div>
        <div class=sourceitem><b>統計開盤估值｜model_estimate</b>${fmt(pre.expectedLow)}–${fmt(pre.expectedHigh)}</div>
        <div class=sourceitem><b>台股風險 Gate</b>${riskText}</div>
      </div>
      <div class=disclaimer><b>不可違反規則</b>沒有合法、日期正確、完整且通過必要 Gate 的資料，就不輸出可執行預測。缺資料不補 0、不沿用舊值、不用其他網站或 AI 推測補齊；observed／derived／model_estimate 必須分開。</div>`;
    box.classList.remove('hidden');
  }

  function renderPrivate(j){
    const d=j.data||{},box=document.querySelector('#result'),label=d.name?`${d.name}／${d.ticker||'—'}`:(d.ticker||'—'),entry=d.entry_low!=null&&d.entry_high!=null?`${fmt(d.entry_low)}–${fmt(d.entry_high)}`:'資料未取得／未通過驗證';
    box.innerHTML=`<div class=toprow><div><h2>${label}</h2><div class=muted>${d.exchange||'—'}｜${d.horizon||'—'}｜私有分析引擎</div><div class=mini>${d.action||'資料不足'}｜模型版本 ${j.model_version||'—'}｜資料日 ${d.data_date||'—'}</div></div><div><div class=bubble>${d.score??'—'}</div><div class=mini>研究分數／非機率</div></div></div><div class=source-note><b>模型估算入場區間</b><div style="font-size:24px;font-weight:900;margin-top:4px">${entry}</div></div>`;box.classList.remove('hidden');
  }

  async function localAnalyze(code,h){
    const tp=window.StockLabTPEx,[twSnap,tpSnap,ir]=await Promise.all([jget(U.snap),tp?tp.tpexSnapshot().catch(()=>[]):Promise.resolve([]),ihist(6)]),m=market(ir);showMarket(m);
    const twRow=twSnap.find(x=>String(x.Code)===code),otcRow=tpSnap.find(x=>x.code===code);
    if(!twRow&&!otcRow)throw Error('官方上市／上櫃快照找不到此代號，或該市場資料健康驗證未通過');
    let r,vf,e,marketName;const modelH=h==='preopen'?'day':h;
    if(otcRow&&!twRow){marketName='TPEx';r=await tp.tpexHist(code,h==='long'?12:6);if(!r.length)throw Error('TPEx 歷史行情不足或來源未通過');vf=await tp.verifyTpex(code,r,otcRow);e=await tp.tpexExtras();}
    else{marketName='TWSE';r=await hist(code,h==='long'?12:6);if(!r.length)throw Error('TWSE 歷史行情不足');vf=await verify(code,r);e=await extras(r.at(-1).iso);}
    if(window.StockLabTaiwan?.loadFactors)await window.StockLabTaiwan.loadFactors();
    const a=combine(tech(r,modelH),modelH,m,e.V.get(code),e.I.get(code),e.R.get(code));a.exchange=marketName;a.stockName=twRow?.Name||otcRow?.name||'';
    if(h==='preopen'){renderPreopen(code,marketName,a,vf,r);return;}
    const gate=bandGate(a,h);if(!vf.complete||!gate.ok){const box=document.querySelector('#result');box.innerHTML=`<div class=toprow><div><h2>${a.stockName?`${a.stockName}／`:''}${code}</h2><div class=muted>${marketName}｜${h}｜研究模型</div></div></div><h3 class=bad>⛔ 不產生價格預測</h3><p>${[vf.complete?null:`價格驗證：${vf.text||'未通過'}`,...gate.reasons].filter(Boolean).join('；')}</p>`;box.classList.remove('hidden');return;}
    render(code,a,h,vf);const result=document.querySelector('#result');if(result&&vf.complete){const title=result.querySelector('.toprow h2');if(title)title.textContent=`${a.stockName?`${a.stockName}／`:''}${code}`;const head=result.querySelector('.toprow .muted');if(head)head.textContent=`${marketName}｜${h}｜研究模型估算`;const firstKpi=result.querySelector('.kpis');if(firstKpi){const entry=`${fmt(a.entryLow)}–${fmt(a.entryHigh)}`;firstKpi.insertAdjacentHTML('beforebegin',`<div class=source-note><b>模型估算入場區間｜非官方行情</b><div style="font-size:24px;font-weight:900;margin-top:4px">${entry}</div><div class=mini>${a.action}</div></div>`);}}
  }

  btn.onclick=async()=>{
    const code=document.querySelector('#ticker').value.trim(),h=document.querySelector('#horizon').value;
    if(!/^\d{4,6}$/.test(code))return alert('請輸入股票代號');document.querySelector('#singleLoad').classList.remove('hidden');
    try{const api=window.StockLabAPI;if(h!=='preopen'&&api?.config?.enabled){try{const j=await api.analyze(code,h);renderPrivate(j);return}catch(e){if(!api.config.allowLocalFallback)throw e;}}await localAnalyze(code,h);}catch(e){document.querySelector('#result').innerHTML=`<h3 class=bad>分析失敗／已停止預測</h3><p>${e.message}</p>`;document.querySelector('#result').classList.remove('hidden');}finally{document.querySelector('#singleLoad').classList.add('hidden');}
  };
})();
