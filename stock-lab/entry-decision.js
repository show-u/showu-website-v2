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
    if(!d?.complete)return{available:false,reason:'9+3 尚未全部驗證；不產生數字入場建議'};
    if(!(cl>0)||r.length<60)return{available:false,reason:'合法已驗證歷史 OHLC 未達 60 根；不以單日價格或假資料補入場價'};
    if(d.score==null||d.score<=50)return{available:false,reason:'9+3 加權結果未偏正面；目前不建立新部位價格'};
    const closes=r.map(x=>n(x.c)),ma=p=>avg(closes.slice(-p)),m5=ma(5),m10=ma(10),m20=ma(20),a=atr14(r);
    if(![m5,m10,m20,a].every(Number.isFinite))return{available:false,reason:'入場價格結構計算資料不足'};
    const lows20=r.slice(-20).map(x=>n(x.l)),support=Math.max(qtile(lows20,.25),Math.min(m10,cl),Math.min(m20,cl));
    const pull=[];for(let i=Math.max(1,r.length-40);i<r.length;i++){const pc=n(r[i-1].c),lo=n(r[i].l);if(pc>0&&lo>0)pull.push((pc-lo)/pc)}
    const reachable=qtile(pull,.80),aggr=Math.max(0,Math.min(1,(d.score-50)/50));
    const center=support+aggr*(cl-support),dist=cl>0?(cl-center)/cl:null;
    if(reachable==null||dist==null||dist>reachable)return{available:false,reason:'候選價格超出近期已驗證回檔可達範圍；不顯示買不到的深層支撐價'};
    const half=a*.12,low=tickRound(Math.max(support,center-half),'up'),high=tickRound(Math.min(cl,center+half),'down');
    if(!(low>0)||!(high>=low))return{available:false,reason:'台股升降單位處理後無有效入場區間'};
    return{available:true,low,high,center:tickRound(center),support:tickRound(support),atr:a,score:d.score,confidenceIndex:d.confidenceIndex,model:'TW-9plus3-entry-price-v1',basis:'9+3 加權方向決定進場積極度；價格由已驗證 MA10/MA20、20日低價結構、ATR14 與歷史回檔可達性形成'};
  }
  function exitPlan(bars,latestClose,averageCost,d){
    const r=Array.isArray(bars)?bars:[],cl=n(latestClose),cost=n(averageCost);
    if(!d?.complete)return{available:false,reason:'9+3 尚未全部驗證；不再用上一交易日低點代替出場建議'};
    if(!(cl>0)||r.length<60)return{available:false,reason:'合法已驗證歷史 OHLC 未達 60 根；不以單日低點假造 9+3 出場價'};
    const closes=r.map(x=>n(x.c)),ma=p=>avg(closes.slice(-p)),m5=ma(5),m20=ma(20),a=atr14(r);
    if(![m5,m20,a].every(Number.isFinite))return{available:false,reason:'出場價格結構計算資料不足'};
    const lows20=r.slice(-20).map(x=>n(x.l)),highs20=r.slice(-20).map(x=>n(x.h)),floor=qtile(lows20,.20),pressure=qtile(highs20,.80);
    const hold=Math.max(0,Math.min(1,(d.score??50)/100));
    // Better 9+3 => allow more room; weaker 9+3 => tighten toward MA5/current close.
    const structure=(1-hold)*m5+hold*m20;
    const volatilityLine=cl-a*(0.35+0.90*hold);
    let trigger=Math.max(floor,Math.min(cl,Math.max(structure,volatilityLine)));
    // A profitable position may not use cost as a hidden inferred fact; only the user-supplied cost can be shown as a separate protection reference.
    trigger=tickRound(trigger,'down');
    return{available:true,trigger,pressure:tickRound(pressure,'up'),costReference:cost>0?tickRound(cost):null,score:d.score,confidenceIndex:d.confidenceIndex,model:'TW-9plus3-exit-price-v1',basis:'9+3 加權結果決定風險線鬆緊；觸發價由 MA5/MA20、ATR14 與20日低價結構共同形成，不使用單一前日低點'};
  }
  function factorList(){return SECTIONS.map(([key,label])=>({key,label}))}
  function contextList(){return CONTEXTS.map(([key,label])=>({key,label}))}
  window.StockLabEntryDecision={section,marketContexts,summarize,weighted,entryPlan,exitPlan,factorList,contextList,weights:WEIGHTS,MISSING,model:'TW-analyst-9plus3-weighted-v3'};
})();