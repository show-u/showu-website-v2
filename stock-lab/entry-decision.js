// StockLab Taiwan analyst 9+3 weighted decision contract.
// 9+3 decides whether/how aggressively to act; price geometry comes only from verified Taiwan OHLC structure.
// Missing factors are never converted to neutral or zero. "Decision confidence" is evidence coverage/consistency, NOT win probability.
(function(){
  const SECTIONS=[
    ['priceVolume','① 價格與成交量'],
    ['taiwanMarket','② 台股大盤／市場環境'],
    ['technical','③ 技術面'],
    ['chips','④ 籌碼／法人／融資融券'],
    ['valuation','⑤ 估值'],
    ['revenue','⑥ 月營收'],
    ['quarterly','⑦ 季報／獲利'],
    ['financialQuality','⑧ 財務品質'],
    ['industryTrend','⑨ 產業／產品／公司動能']
  ];
  const CONTEXTS=[['us','＋1 美股／SOX'],['tx','＋2 台指期 TX'],['events','＋3 國際事件']];
  const MISSING='資料未取得／未通過驗證';

  // Governance weights, not fitted return probabilities.
  // Entry is balanced across valuation/growth/technical/chips; exit reacts more to price/technical/chips/market.
  const WEIGHTS={
    entry:{priceVolume:13,taiwanMarket:8,technical:15,chips:12,valuation:8,revenue:9,quarterly:9,financialQuality:7,industryTrend:9,us:4,tx:4,events:2},
    exit:{priceVolume:15,taiwanMarket:10,technical:18,chips:15,valuation:4,revenue:6,quarterly:7,financialQuality:5,industryTrend:8,us:4,tx:5,events:3}
  };

  function section(key,label,verified,state,evidence,provenance='derived',meta={}){
    return{key,label,verified:verified===true,state:verified===true?state:'unavailable',evidence:verified===true?evidence:MISSING,provenance:verified===true?provenance:'unavailable',...meta};
  }
  function marketContexts(sectorFamily='general'){
    const us=window.StockLabExternalMarket?.context?window.StockLabExternalMarket.context(sectorFamily):{verified:false,state:'unknown',reason:'美股資料層未接入',provenance:'unavailable'};
    const tx=window.StockLabTX?.context?window.StockLabTX.context():{verified:false,state:'unknown',reason:'台指期資料層未接入',provenance:'unavailable'};
    const events=window.StockLabEvents?.context?window.StockLabEvents.context():{verified:false,state:'unknown',reason:'國際事件資料層未接入',provenance:'unavailable'};
    return{us,tx,events};
  }
  function summarize(sections,contexts){
    const vals=SECTIONS.map(([k])=>sections?.[k]),missing=vals.filter(x=>x?.verified!==true);
    const contextMissing=CONTEXTS.map(([k])=>k).filter(k=>contexts?.[k]?.verified!==true);
    const positive=vals.filter(x=>x?.state==='positive').length,negative=vals.filter(x=>x?.state==='negative').length,neutral=vals.filter(x=>x?.state==='neutral').length;
    return{
      complete:missing.length===0&&contextMissing.length===0,
      positive,negative,neutral,
      missingSections:missing.map(x=>x?.label||'未知項目'),
      missingContexts:contextMissing,
      decision:missing.length||contextMissing.length?'9+3 尚未完整；只顯示已驗證事實與條件，不補值':'9+3 資料完整，可交由加權決策層'
    };
  }
  function stateValue(s){return s==='positive'?1:s==='negative'?-1:s==='neutral'?0:null}
  function weighted(sections,contexts,mode='entry'){
    const weights=WEIGHTS[mode]||WEIGHTS.entry,all={...sections};
    for(const x of Array.isArray(contexts)?contexts:[]){
      if(x?.key)all[x.key]=x;
    }
    let verifiedWeight=0,net=0;const used=[],missing=[];
    for(const [key,w] of Object.entries(weights)){
      const x=all[key],v=x?.verified===true?stateValue(x.state):null;
      if(v==null){missing.push({key,weight:w,label:x?.label||key});continue}
      verifiedWeight+=w;net+=w*v;used.push({key,weight:w,state:x.state,label:x.label});
    }
    const coverage=verifiedWeight/100;
    const agreement=verifiedWeight?Math.abs(net)/verifiedWeight:0;
    const score=verifiedWeight?Math.round(50+50*(net/verifiedWeight)):null;
    // Evidence-confidence index: never exceeds verified coverage. This is NOT win rate/probability.
    const confidence=Math.round(100*coverage*(0.65+0.35*agreement));
    const complete=verifiedWeight===100;
    return{
      mode,model:'TW-9plus3-weighted-v1',weights,verifiedWeight,coveragePct:Math.round(coverage*100),
      netBalance:net,score,confidenceIndex:confidence,agreementPct:Math.round(agreement*100),
      complete,used,missing,
      confidenceMeaning:'已驗證資料覆蓋率 × 方向一致性；不是勝率、成功率或上漲／下跌機率'
    };
  }
  function avg(a){const v=a.filter(Number.isFinite);return v.length?v.reduce((x,y)=>x+y,0)/v.length:null}
  function qtile(a,q){const v=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!v.length)return null;const p=(v.length-1)*q,l=Math.floor(p),h=Math.ceil(p);return l===h?v[l]:v[l]+(v[h]-v[l])*(p-l)}
  function n(v){const x=Number(v);return Number.isFinite(x)?x:null}
  function atr14(b){if(!Array.isArray(b)||b.length<15)return null;const t=[];for(let i=b.length-14;i<b.length;i++){const x=b[i],pc=n(b[i-1]?.c),h=n(x?.h),l=n(x?.l);if([pc,h,l].every(Number.isFinite))t.push(Math.max(h-l,Math.abs(h-pc),Math.abs(l-pc)))}return t.length===14?avg(t):null}
  function tickRound(p,mode='nearest'){const f=window.StockLabTaiwan?.roundTick;return typeof f==='function'?f(p,mode):p}
  function entryPlan(bars,latestClose,d){
    const r=Array.isArray(bars)?bars:[],cl=n(latestClose);
    if(!(cl>0)||r.length<60)return{available:false,reason:'價格結構 Gate 未通過：合法已驗證歷史 OHLC 未達 60 根；不以固定百分比或舊短中長模型補值'};
    const closes=r.map(x=>n(x.c)),ma=p=>avg(closes.slice(-p)),m10=ma(10),m20=ma(20),m60=ma(60),a=atr14(r);
    if(![m10,m20,m60,a].every(Number.isFinite))return{available:false,reason:'價格結構 Gate 未通過：MA10／MA20／MA60／ATR14 計算資料不足'};
    const lows20=r.slice(-20).map(x=>n(x.l)),lows60=r.slice(-60).map(x=>n(x.l));
    const prior20=r.length>=21?r.slice(-21,-1):r.slice(-20),priorHighs=prior20.map(x=>n(x.h));
    const q20_35=qtile(lows20,.35),q60_25=qtile(lows60,.25),priorResistance=Math.max(...priorHighs.filter(Number.isFinite));
    if(![q20_35,q60_25,priorResistance].every(Number.isFinite))return{available:false,reason:'價格結構 Gate 未通過：支撐／壓力資料不足'};

    // Route A: pullback entry. This is a reachable demand zone, not a forecast that price must fall here.
    const pullCenter=Math.min(cl,Math.max(q20_35,Math.min(m10,cl),Math.min(m20,cl)));
    const pullLow=tickRound(Math.max(0.01,pullCenter-a*.18),'up');
    const pullHigh=tickRound(Math.min(cl,pullCenter+a*.18),'down');
    if(!(pullLow>0)||!(pullHigh>=pullLow))return{available:false,reason:'台股升降單位處理後拉回入場區無效'};

    // Route B: breakout entry. A stock that never revisits the pullback zone still has an actionable path.
    const breakoutTrigger=tickRound(priorResistance+a*.02,'up');
    const noChase=tickRound(Math.max(cl,breakoutTrigger)+a*.50,'up');
    const breakoutHigh=tickRound(Math.min(noChase,breakoutTrigger+a*.35),'down');
    const breakout={trigger:breakoutTrigger,low:breakoutTrigger,high:Math.max(breakoutTrigger,breakoutHigh)};

    const vols=prior20.map(x=>n(x.v)).filter(x=>Number.isFinite(x)&&x>0),lastVol=n(r.at(-1)?.v),vAvg=avg(vols),volumeRatio=vAvg&&lastVol?lastVol/vAvg:null;
    const breakoutConfirmed=cl>priorResistance&&volumeRatio!=null&&volumeRatio>=1.20;

    // Structural invalidation is risk control, not another buy zone.
    const invalid=tickRound(Math.max(0.01,Math.min(m60,q60_25)-a*.35),'down');
    const complete=d?.complete===true,score=n(d?.score);
    let action='價格路徑可用；9+3 尚未完整，只顯示條件，不把缺項當中性';
    if(complete&&score!=null){
      if(score<50)action='9+3 偏弱：目前不建立新部位';
      else if(score<65)action=cl<=pullHigh?'只考慮拉回區小部位；不追突破':'等待拉回區，不追價';
      else if(cl>=pullLow&&cl<=pullHigh)action='目標交易日優先採拉回入場';
      else if(breakoutConfirmed)action='已完成放量突破：目標交易日只在突破帶內評估，不超過不追價上限';
      else action='等待兩種條件之一：拉回進入需求區，或放量突破觸發；中間區域不追價';
    }
    return{
      available:true,
      pullback:{low:pullLow,high:pullHigh},
      breakout,
      breakoutConfirmed,
      volumeRatio,
      noChase,
      invalid,
      atr:a,
      action,
      decisionComplete:complete,
      score,
      confidenceIndex:d?.confidenceIndex??null,
      model:'TW-two-route-entry-v1',
      basis:'入場只保留兩條可執行路徑：拉回需求區（MA10／MA20、20日低價分布、ATR14）或突破觸發（前20日壓力＋成交量確認）。若價格不回檔，不再用買不到的深層價格當唯一答案；若未突破，也不在中間價追單。'
    };
  }
  function exitPlan(bars,latestClose,averageCost,d){
    const r=Array.isArray(bars)?bars:[],cl=n(latestClose),cost=n(averageCost);
    if(!(cl>0)||r.length<60)return{available:false,reason:'合法已驗證歷史 OHLC 未達 60 根；不以單日低點、固定百分比或 AI 猜值補出場價'};
    const closes=r.map(x=>n(x.c)),ma=p=>avg(closes.slice(-p)),m5=ma(5),m20=ma(20),m60=ma(60),a=atr14(r);
    if(![m5,m20,m60,a].every(Number.isFinite))return{available:false,reason:'出場價格結構計算資料不足'};
    const lows20=r.slice(-20).map(x=>n(x.l)),highs20=r.slice(-20).map(x=>n(x.h)),floor=qtile(lows20,.20),pressure=qtile(highs20,.80);
    if(![floor,pressure].every(Number.isFinite))return{available:false,reason:'出場支撐／壓力分布不足'};
    const complete=d?.complete===true,score=n(d?.score);
    // Price risk line exists independently from 9+3 completeness. 9+3 may tighten/loosen it only when fully verified.
    let atrMult=.80,mode='結構風險線（9+3 尚未完整）';
    if(complete&&score!=null){
      if(score>=65){atrMult=1.15;mode='9+3 偏強：較寬風險線'}
      else if(score>=45){atrMult=.80;mode='9+3 混合：標準風險線'}
      else{atrMult=.45;mode='9+3 偏弱：收緊風險線'}
    }
    const trendLine=complete&&score!=null&&score<45?Math.max(m5,m20):m20;
    const volatilityLine=cl-a*atrMult;
    const trigger=tickRound(Math.max(floor,Math.min(cl,Math.max(trendLine,volatilityLine))),'down');
    return{
      available:true,
      trigger,
      pressure:tickRound(pressure,'up'),
      costReference:cost>0?tickRound(cost):null,
      score,
      confidenceIndex:d?.confidenceIndex??null,
      complete,
      mode,
      model:'TW-structure-plus-9plus3-exit-v2',
      basis:(complete?'9+3 已完整，':'9+3 未完整，不補值；')+'數字風險線仍只由合法價格結構形成；9+3 完整時才調整風險線鬆緊。'
    };
  }
  function factorList(){return SECTIONS.map(([key,label])=>({key,label}))}
  function contextList(){return CONTEXTS.map(([key,label])=>({key,label}))}
  window.StockLabEntryDecision={section,marketContexts,summarize,weighted,entryPlan,exitPlan,factorList,contextList,weights:WEIGHTS,MISSING,model:'TW-analyst-9plus3-weighted-v4'};
})();