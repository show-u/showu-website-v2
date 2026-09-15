// Unified Taiwan entry-decision layer.
// One question only: is this stock suitable to enter now/next verified session?
// No short/mid/long buy bands. Missing or unverified inputs remain unavailable.
(function(){
  const KEYS=[
    ['trend','① 價格趨勢＋支撐／壓力'],
    ['volume','② 成交量'],
    ['movingAverages','③ 均線結構'],
    ['institution','④ 法人／籌碼'],
    ['macd','⑤ MACD'],
    ['rsi','⑥ RSI'],
    ['kd','⑦ KD／KDJ'],
    ['crossovers','⑧ 黃金／死亡交叉'],
    ['candlestick','⑨ K線型態']
  ];
  const MISSING='資料未取得／未通過驗證';
  function finite(v){return v!==null&&v!==''&&Number.isFinite(Number(v))}
  function avg(a){const v=a.filter(Number.isFinite);return v.length?v.reduce((x,y)=>x+y,0)/v.length:null}
  function maAt(r,p,end){if(!Array.isArray(r)||end+1<p)return null;return avg(r.slice(end-p+1,end+1).map(x=>Number(x.c)).filter(Number.isFinite))}
  function factor(key,label,verified,state,evidence,source='derived'){
    return{key,label,verified:verified===true,state:verified===true?state:'unavailable',evidence:verified===true?evidence:MISSING,provenance:verified===true?source:'unavailable'};
  }
  function crossState(r,fast,slow,look=5){
    if(!Array.isArray(r)||r.length<slow+look+1)return{verified:false,state:'unavailable',evidence:MISSING};
    const end=r.length-1,start=Math.max(slow,end-look);let golden=false,death=false,lastFast=null,lastSlow=null;
    for(let i=start;i<=end;i++){
      const f=maAt(r,fast,i),s=maAt(r,slow,i),pf=maAt(r,fast,i-1),ps=maAt(r,slow,i-1);
      if(![f,s,pf,ps].every(Number.isFinite))continue;
      if(pf<=ps&&f>s)golden=true;
      if(pf>=ps&&f<s)death=true;
      lastFast=f;lastSlow=s;
    }
    if(golden&&!death)return{verified:true,state:'positive',evidence:`最近 ${look} 個交易日出現 MA${fast}/MA${slow} 黃金交叉`};
    if(death&&!golden)return{verified:true,state:'negative',evidence:`最近 ${look} 個交易日出現 MA${fast}/MA${slow} 死亡交叉`};
    if(!Number.isFinite(lastFast)||!Number.isFinite(lastSlow))return{verified:false,state:'unavailable',evidence:MISSING};
    return{verified:true,state:'neutral',evidence:`最近 ${look} 個交易日未出現新交叉；MA${fast} ${lastFast>=lastSlow?'≥':'<'} MA${slow}`};
  }
  function nineFactors(r,a={}){
    const out={};
    if(!Array.isArray(r)||r.length<60){for(const [k,l] of KEYS)out[k]=factor(k,l,false,'unavailable',MISSING);return out}
    const L=r.at(-1),P=r.at(-2),cl=r.map(x=>Number(x.c)),ma5=avg(cl.slice(-5)),ma10=avg(cl.slice(-10)),ma20=avg(cl.slice(-20)),ma60=avg(cl.slice(-60));
    const w20=r.slice(-20),support=Math.min(...w20.map(x=>Number(x.l)).filter(Number.isFinite)),resistance=Math.max(...w20.map(x=>Number(x.h)).filter(Number.isFinite));
    const pxOK=[L?.c,ma20,support,resistance].every(finite);
    let trendState='neutral',trendEvidence=MISSING;
    if(pxOK){const down=Math.max(Number(L.c)-support,0),up=Math.max(resistance-Number(L.c),0),rr=down>0?up/down:null;trendState=Number(L.c)>ma20&&rr!=null&&rr>=1?'positive':Number(L.c)<ma20?'negative':'neutral';trendEvidence=`收盤 ${Number(L.c).toLocaleString('zh-TW')}｜MA20 ${Number(ma20).toFixed(2)}｜20日支撐 ${Number(support).toLocaleString('zh-TW')}｜壓力 ${Number(resistance).toLocaleString('zh-TW')}${rr!=null?`｜上檔/下檔 ${rr.toFixed(2)}`:''}`}
    out.trend=factor('trend',KEYS[0][1],pxOK,trendState,trendEvidence);

    const vols=r.slice(-20).map(x=>Number(x.v)).filter(x=>Number.isFinite(x)&&x>0),vAvg=avg(vols),vNow=Number(L?.v),vr=Number.isFinite(vNow)&&vAvg? vNow/vAvg:null;
    const volOK=Number.isFinite(vr)&&finite(L?.c)&&finite(P?.c);let volState='neutral';if(volOK&&vr>=1.2)volState=Number(L.c)>Number(P.c)?'positive':Number(L.c)<Number(P.c)?'negative':'neutral';
    out.volume=factor('volume',KEYS[1][1],volOK,volState,volOK?`今日量 / 20日均量 ${vr.toFixed(2)}x；收盤較前一日 ${Number(L.c)>Number(P.c)?'上升':Number(L.c)<Number(P.c)?'下降':'持平'}`:MISSING);

    const maOK=[ma5,ma10,ma20,ma60].every(Number.isFinite);const maState=maOK&&ma5>=ma10&&ma10>=ma20&&ma20>=ma60?'positive':maOK&&ma5<ma10&&ma10<ma20&&ma20<ma60?'negative':'neutral';
    out.movingAverages=factor('movingAverages',KEYS[2][1],maOK,maState,maOK?`MA5 ${ma5.toFixed(2)}｜MA10 ${ma10.toFixed(2)}｜MA20 ${ma20.toFixed(2)}｜MA60 ${ma60.toFixed(2)}`:MISSING);

    const instOK=a?.integrity?.institution?.ok===true&&finite(a?.inst?.total);const instTotal=instOK?Number(a.inst.total):null,instRatio=instOK&&finite(L?.v)&&Number(L.v)!==0?instTotal/Number(L.v):null;const instState=instOK?(instTotal>0?'positive':instTotal<0?'negative':'neutral'):'unavailable';
    out.institution=factor('institution',KEYS[3][1],instOK,instState,instOK?`已驗證同交易日法人合計 ${instTotal.toLocaleString('zh-TW')} 股${Number.isFinite(instRatio)?`｜約占成交量 ${(instRatio*100).toFixed(2)}%`:''}`:MISSING,'observed');

    const macdOK=finite(a?.macd?.dif)&&finite(a?.macd?.sig)&&finite(a?.macd?.hist);const macdState=macdOK?(Number(a.macd.dif)>Number(a.macd.sig)&&Number(a.macd.hist)>=0?'positive':Number(a.macd.dif)<Number(a.macd.sig)&&Number(a.macd.hist)<=0?'negative':'neutral'):'unavailable';
    out.macd=factor('macd',KEYS[4][1],macdOK,macdState,macdOK?`DIF ${Number(a.macd.dif).toFixed(2)}｜Signal ${Number(a.macd.sig).toFixed(2)}｜Hist ${Number(a.macd.hist).toFixed(2)}`:MISSING);

    const rsiOK=finite(a?.rsi),rv=rsiOK?Number(a.rsi):null;const rsiState=rsiOK?(rv>=50&&rv<=70?'positive':rv<40?'negative':'neutral'):'unavailable';
    out.rsi=factor('rsi',KEYS[5][1],rsiOK,rsiState,rsiOK?`RSI14 ${rv.toFixed(1)}${rv>70?'｜偏熱，只列風險，不直接當賣出訊號':''}`:MISSING);

    const kdOK=finite(a?.kd?.k)&&finite(a?.kd?.d),kv=kdOK?Number(a.kd.k):null,dv=kdOK?Number(a.kd.d):null;const kdState=kdOK?(kv>dv&&kv<80?'positive':kv<dv?'negative':'neutral'):'unavailable';
    out.kd=factor('kd',KEYS[6][1],kdOK,kdState,kdOK?`K ${kv.toFixed(1)}｜D ${dv.toFixed(1)}`:MISSING);

    const c1=crossState(r,5,20,5),c2=crossState(r,20,60,5);const crossOK=c1.verified&&c2.verified;const crossStateFinal=crossOK?(c1.state==='negative'||c2.state==='negative'?'negative':c1.state==='positive'||c2.state==='positive'?'positive':'neutral'):'unavailable';
    out.crossovers=factor('crossovers',KEYS[7][1],crossOK,crossStateFinal,crossOK?`${c1.evidence}；${c2.evidence}`:MISSING);

    const candle=String(a?.candle||''),candleOK=!!candle&&candle!=='—';const bullish=['多方吞噬','錘子線','長紅K'],bearish=['空方吞噬','長上影','長黑K'];const candleState=candleOK?(bullish.includes(candle)?'positive':bearish.includes(candle)?'negative':'neutral'):'unavailable';
    out.candlestick=factor('candlestick',KEYS[8][1],candleOK,candleState,candleOK?candle:MISSING);
    return out;
  }
  function marketContexts(sectorFamily='general'){
    const us=window.StockLabExternalMarket?.context?window.StockLabExternalMarket.context(sectorFamily):{verified:false,state:'unknown',reason:'美股資料層未接入'};
    const tx=window.StockLabTX?.context?window.StockLabTX.context():{verified:false,state:'unknown',reason:'台指期資料層未接入'};
    const events=window.StockLabEvents?.context?window.StockLabEvents.context():{verified:false,state:'unknown',reason:'國際事件資料層未接入'};
    return{us,tx,events};
  }
  function summarize(factors,contexts){
    const vals=KEYS.map(([k])=>factors?.[k]),missing=vals.filter(x=>x?.verified!==true),positive=vals.filter(x=>x?.state==='positive').length,negative=vals.filter(x=>x?.state==='negative').length,neutral=vals.filter(x=>x?.state==='neutral').length;
    const contextMissing=['us','tx','events'].filter(k=>contexts?.[k]?.verified!==true);
    const complete=missing.length===0&&contextMissing.length===0;
    return{complete,positive,negative,neutral,missingFactors:missing.map(x=>x?.label||'未知因子'),missingContexts:contextMissing,decision:complete?'等待已驗證 OOS 決策模型':'資料不完整，禁止形成入場結論'};
  }
  function evaluate(r,a={}){const factors=nineFactors(r,a),contexts=marketContexts(a?.sectorFamily||'general'),summary=summarize(factors,contexts);return{factors,contexts,summary,model:'TW-entry-9plus3-contract-v1'}}
  function factorList(){return KEYS.map(([key,label])=>({key,label}))}
  window.StockLabEntryDecision={nineFactors,marketContexts,summarize,evaluate,factorList,MISSING};
})();
