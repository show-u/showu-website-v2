// Taiwan target-session truth gate.
// Wall-clock time describes the current trading phase only. It never advances the model's data date.
// A next-session plan is released only when the licensed trading calendar and the latest completed-session data agree.
(function(){
  const MISSING='資料未取得／未通過驗證';
  function normalizeDate(v){const s=String(v||'').trim(),m=s.match(/^(\d{4})[-\/]?(\d{2})[-\/]?(\d{2})$/);return m?`${m[1]}-${m[2]}-${m[3]}`:null}
  function trueish(v){return v===true||String(v).toLowerCase()==='true'||String(v)==='1'}
  function taipeiClock(){
    const p={};for(const x of new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()))p[x.type]=x.value;
    const mins=Number(p.hour)*60+Number(p.minute),date=`${p.year}-${p.month}-${p.day}`;
    let marketPhase='NON_TRADING_DAY';
    if(!['Sat','Sun'].includes(p.weekday)){
      if(mins<510)marketPhase='BEFORE_ORDERS';
      else if(mins<540)marketPhase='PREOPEN';
      else if(mins<805)marketPhase='CONTINUOUS';
      else if(mins<810)marketPhase='CLOSING_AUCTION';
      else marketPhase='AFTER_CLOSE';
    }
    return{date,mins,weekday:p.weekday,marketPhase,timezone:'Asia/Taipei'};
  }
  function uniqueSorted(a){return[...new Set(a)].sort()}
  async function calendarDates(market){
    const loader=window.StockLabLicensedHistory;if(!loader?.dataset)throw Error('合法交易日曆介面尚未接入');
    const rows=await loader.dataset('trading_calendar');
    const dates=uniqueSorted((rows||[]).filter(x=>x.market===market&&trueish(x.is_trading_day)).map(x=>normalizeDate(x.date)).filter(Boolean));
    if(!dates.length)throw Error(`${market} 合法交易日曆沒有有效交易日`);return dates
  }
  async function resolve({market,dataDate}={}){
    const base=normalizeDate(dataDate),now=taipeiClock();if(!['TWSE','TPEx'].includes(market))return{verified:false,state:'UNKNOWN_MARKET',label:'市場別未驗證',baseDate:base,targetDate:null,now};if(!base)return{verified:false,state:'UNKNOWN_DATA_DATE',label:'資料基準日未驗證',baseDate:null,targetDate:null,now};
    let dates;try{dates=await calendarDates(market)}catch(e){return{verified:false,state:'CALENDAR_UNAVAILABLE',label:`交易日曆未驗證：${e.message}`,baseDate:base,targetDate:null,now}}
    const idx=dates.indexOf(base);if(idx<0)return{verified:false,state:'BASE_NOT_TRADING_DAY',label:`資料基準日 ${base} 不在已驗證交易日曆`,baseDate:base,targetDate:null,now};
    const nextDate=dates[idx+1]||null;if(!nextDate)return{verified:false,state:'NEXT_SESSION_UNKNOWN',label:`${base} 之後的下一交易日尚未在已驗證日曆中`,baseDate:base,targetDate:null,now};
    const today=now.date;
    if(base===today){
      if(now.mins<810)return{verified:false,state:'IMPOSSIBLE_CURRENT_CLOSE',label:`${base} 尚未 13:30 收盤，卻出現同日完成收盤基準；資料時序異常，禁止建立價格`,baseDate:base,targetDate:null,now};
      return{verified:true,state:'NEXT_SESSION_READY',label:`${nextDate} 下一交易日計畫｜基準 ${base} 完成交易日收盤`,baseDate:base,targetDate:nextDate,displayNumericPlan:true,currentExecutable:false,now};
    }
    if(nextDate===today){
      if(now.marketPhase==='BEFORE_ORDERS')return{verified:true,state:'TODAY_PLAN_BEFORE_ORDERS',label:`今日 ${today} 原始入場計畫｜08:30 起可送委託；基準 ${base} 收盤`,baseDate:base,targetDate:today,displayNumericPlan:true,currentExecutable:false,now};
      if(now.marketPhase==='PREOPEN')return{verified:true,state:'TODAY_PREOPEN_ACTIVE',label:`今日 ${today} 盤前計畫｜08:30–09:00 限價 ROD；基準 ${base} 收盤`,baseDate:base,targetDate:today,displayNumericPlan:true,currentExecutable:true,now};
      if(now.marketPhase==='CONTINUOUS'||now.marketPhase==='CLOSING_AUCTION')return{verified:true,state:'TODAY_ORIGINAL_PLAN_REFERENCE',label:`今日 ${today} 原始入場計畫｜盤中僅供參考，不以昨日資料重算現在價格`,baseDate:base,targetDate:today,displayNumericPlan:true,currentExecutable:false,now};
      if(now.marketPhase==='AFTER_CLOSE')return{verified:true,state:'WAITING_TODAY_CLOSE_DATA',label:`今日 ${today} 已收盤；等待今日官方收盤與必要資料全部驗證後，才建立下一交易日計畫`,baseDate:base,targetDate:null,displayNumericPlan:false,currentExecutable:false,now};
    }
    if(today<nextDate)return{verified:true,state:'NEXT_TRADING_DAY_AHEAD',label:`${nextDate} 下一交易日計畫｜基準 ${base} 收盤`,baseDate:base,targetDate:nextDate,displayNumericPlan:true,currentExecutable:false,now};
    if(today>nextDate)return{verified:false,state:'STALE_BASE_DATE',label:`最新完成交易資料仍停在 ${base}，已落後下一交易日 ${nextDate}；禁止把舊資料冒充目前計畫`,baseDate:base,targetDate:null,displayNumericPlan:false,currentExecutable:false,now};
    return{verified:false,state:'UNRESOLVED',label:MISSING,baseDate:base,targetDate:null,displayNumericPlan:false,currentExecutable:false,now};
  }
  window.StockLabSessionContext={resolve,taipeiClock,normalizeDate,calendarDates,MISSING};
})();