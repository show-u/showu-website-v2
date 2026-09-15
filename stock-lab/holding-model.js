// Existing-position model. Holding/exit is separate from buy-entry analysis.
// Formal decisions remain fail-closed until the dedicated holding-exit OOS gate passes.
(function(){
  function num(v){if(v==null)return null;const s=String(v).trim();if(!s||['-','--','—','N/A','NA','null','undefined'].includes(s))return null;const x=Number(s.replace(/,/g,''));return Number.isFinite(x)?x:null}
  function avg(a){const v=a.filter(Number.isFinite);return v.length?v.reduce((x,y)=>x+y,0)/v.length:null}
  function qtile(a,q){const v=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!v.length)return null;const p=(v.length-1)*q,l=Math.floor(p),h=Math.ceil(p);return l===h?v[l]:v[l]+(v[h]-v[l])*(p-l)}
  function atr(r,p=14){if(!r||r.length<=p)return null;const z=[];for(let i=r.length-p;i<r.length;i++){const x=r[i],pc=r[i-1].c;z.push(Math.max(x.h-x.l,Math.abs(x.h-pc),Math.abs(x.l-pc)))}return avg(z)}
  function tickSize(p){if(p<10)return .01;if(p<50)return .05;if(p<100)return .1;if(p<500)return .5;if(p<1000)return 1;return 5}
  function roundTick(p,mode='nearest'){const t=tickSize(Math.max(.01,p)),q=p/t,z=mode==='up'?Math.ceil(q):mode==='down'?Math.floor(q):Math.round(q);return +(z*t).toFixed(t<.1?2:t<1?1:0)}
  function dateMs(v){if(!v)return null;const d=new Date(`${v}T00:00:00+08:00`);return Number.isNaN(d.getTime())?null:d.getTime()}
  function barDate(x){return x?.iso||x?.date||null}
  function daysBetween(a,b){const x=dateMs(a),y=dateMs(b);return x!=null&&y!=null&&y>=x?Math.floor((y-x)/86400000):null}

  function positionInput(x){
    const avgCost=num(x?.averageCost),shares=num(x?.shares),buyDate=x?.buyDate||null,lots=Array.isArray(x?.lots)?x.lots:null;
    if(!(avgCost>0))throw Error('成本均價必須大於 0');
    if(!(shares>0))throw Error('持有股數必須大於 0');
    if(!buyDate||dateMs(buyDate)==null)throw Error('正式出場模型需要有效首次買入日；不知道日期時只能顯示持股事實，不能產生完整出場判斷');
    return{averageCost:avgCost,shares,buyDate,lots,provenance:x?.provenance||{averageCost:'user_observed',shares:'user_observed',buyDate:'user_observed'}};
  }

  // Buy date is a user-observed trading date. Holding age is counted from actual verified bars,
  // never approximated from calendar days. Structural lookback may be bounded for model stability,
  // but the reported holdingTradingDays remains the exact bar count since entry.
  function holdingProfile(buyDate,bars){
    if(!Array.isArray(bars)||!bars.length)throw Error('持股歷史行情不存在');
    const dataDate=barDate(bars.at(-1)),calendarDays=daysBetween(buyDate,dataDate);
    if(calendarDays==null)throw Error('買入日不可晚於最新資料日');
    const entryIndex=bars.findIndex(x=>barDate(x)===buyDate);
    if(entryIndex<0)throw Error('首次買入日不在目前合法且驗證通過的歷史交易日序列中；禁止用日曆天數推估持有期');
    const holdingTradingDays=bars.length-entryIndex;
    if(holdingTradingDays<1)throw Error('持有交易日數無效');
    const structureLookback=Math.max(20,Math.min(240,holdingTradingDays));
    const fastMA=Math.max(5,Math.min(60,Math.round(structureLookback/3)));
    const slowMA=structureLookback;
    return{calendarDays,holdingTradingDays,entryIndex,structureLookback,fastMA,slowMA,usesPreEntryContext:holdingTradingDays<20,provenance:'derived_from_verified_trading_sessions'};
  }

  function analyze(input,bars,ctx={}){
    const p=positionInput(input);
    if(!Array.isArray(bars)||bars.length<60)throw Error(`持股出場模型有效日線不足：${bars?.length||0}/60`);
    if(ctx.legalSource!==true)throw Error('歷史行情來源授權未通過');
    if(ctx.priceVerified!==true)throw Error('最新官方收盤未完成交叉驗證');
    if(ctx.activeRiskKnown!==true)throw Error('注意／處置／特殊交易狀態尚未完整驗證');
    if(ctx.corporateActionKnown!==true)throw Error('公司行動／參考價事件尚未完整驗證');
    if(ctx.oosStatus!=='PASS')throw Error(`持股出場模型尚未通過正式 OOS：${ctx.oosStatus||'UNKNOWN'}`);
    if(ctx.exitContextComplete!==true)throw Error('持股出場模型所需市場／籌碼／基本面背景未完整驗證');

    const L=bars.at(-1),dataDate=barDate(L);if(!L||!Number.isFinite(L.c)||!dataDate)throw Error('最新價格／交易日資料不足');
    const profile=holdingProfile(p.buyDate,bars),a=atr(bars,14);if(!(a>0))throw Error('ATR 資料不足');
    if(bars.length<profile.structureLookback)throw Error(`持股結構資料不足：需要 ${profile.structureLookback} 根有效日線`);
    const cl=bars.map(x=>x.c),w=bars.slice(-profile.structureLookback),maFast=avg(cl.slice(-profile.fastMA)),maSlow=avg(cl.slice(-profile.slowMA));
    if(![maFast,maSlow].every(Number.isFinite))throw Error('持股均線結構資料不足');
    const structuralSupport=qtile(w.map(x=>x.l),.20),structuralResistance=qtile(w.map(x=>x.h),.80);if(![structuralSupport,structuralResistance].every(Number.isFinite))throw Error('持股結構資料不足');

    const sinceEntry=bars.slice(profile.entryIndex),peakSinceEntry=sinceEntry.length?Math.max(...sinceEntry.map(x=>x.h).filter(Number.isFinite)):null;
    if(!Number.isFinite(peakSinceEntry))throw Error('買入後峰值資料不足');
    const defenseBase=Math.max(structuralSupport,Math.min(maSlow,L.c)),defense=roundTick(Math.max(.01,defenseBase-a*.70),'down'),resistance=roundTick(Math.max(structuralResistance,L.c),'up'),profitDefense=roundTick(Math.max(defense,maFast-a*.35),'down');
    const marketValue=L.c*p.shares,cost=p.averageCost*p.shares,pnl=marketValue-cost,pnlPct=cost?100*pnl/cost:null,drawdownFromPeak=peakSinceEntry>0?100*(L.c/peakSinceEntry-1):null;
    const trendUp=L.c>=maFast&&maFast>=maSlow,trendWeak=L.c<maFast&&maFast<maSlow,belowDefense=L.c<defense,nearResistance=L.c>=structuralResistance-a*.20,profitProtectionBroken=pnl>0&&L.c<profitDefense&&drawdownFromPeak!=null&&drawdownFromPeak<0;

    let state,reason;
    if(ctx.riskBlocked){state='風險事件優先處理';reason='處置／特殊交易狀態已觸發，先依市場規則與風險限制處理，不套一般持股策略';}
    else if(belowDefense&&trendWeak){state='出場條件檢視';reason='最新已驗證收盤同時跌破依實際持有交易日建立的結構防守線，且快慢結構轉弱；不是因為跌了固定百分比';}
    else if(profitProtectionBroken&&trendWeak){state='獲利保護／減碼檢視';reason='目前仍高於成本，但已跌破依實際持有交易日計算的獲利保護結構，且趨勢轉弱；應檢視是否分批保護既有獲利';}
    else if(pnl>0&&nearResistance&&!trendUp){state='分批停利檢視';reason='部位有未實現獲利、價格接近持有期結構壓力區，且趨勢未維持完整多頭排列';}
    else if(trendUp){state='續抱條件仍成立';reason='最新已驗證收盤與依實際持有交易日形成的快慢結構仍為正向；續抱時持續觀察防守線與壓力區';}
    else{state='防守觀察';reason='尚未出現完整出場條件，但持有期結構也未達明確續抱強勢狀態';}

    return{
      model:'TW-holding-exit-v4',validation:'PASS',dataDate,latestClose:L.c,
      position:p,holdingProfile:profile,
      derived:{cost,marketValue,pnl,pnlPct,maFast,maSlow,atr:a,structuralSupport:roundTick(structuralSupport),structuralResistance:roundTick(structuralResistance),defense,resistance,profitDefense,peakSinceEntry:roundTick(peakSinceEntry),drawdownFromPeak},
      decision:{state,reason,exitTrigger:`以完成交易日收盤為準；若收盤跌破 ${defense} 且快慢結構同步轉弱，下一個合法可交易時段重新執行出場判定`,profitReview:`已有獲利時，若收盤跌破 ${profitDefense}，或進入 ${resistance} 附近且趨勢轉弱，下一交易時段檢視分批停利`},
      limits:{sharesAffectSignal:false,portfolioSizingKnown:false,statement:'持有股數只用於計算市值與金額損益；沒有整體資產／風險預算時，不判斷部位過大或過小。'},
      provenance:{position:p.provenance,latestClose:'observed',holdingTradingDays:'derived_from_verified_trading_sessions',structure:'derived',decision:'model_estimate'}
    };
  }
  window.StockLabHolding={analyze,positionInput,holdingProfile,requiredBars:()=>60};
})();
