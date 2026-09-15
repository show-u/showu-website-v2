// Existing-position model. One holding/exit decision model; no short/mid/long selector.
// Production use remains blocked until the dedicated holding-exit OOS gate passes.
(function(){
  function num(v){if(v==null)return null;const s=String(v).trim();if(!s||['-','--','—','N/A','NA','null','undefined'].includes(s))return null;const x=Number(s.replace(/,/g,''));return Number.isFinite(x)?x:null}
  function avg(a){const v=a.filter(Number.isFinite);return v.length?v.reduce((x,y)=>x+y,0)/v.length:null}
  function qtile(a,q){const v=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!v.length)return null;const p=(v.length-1)*q,l=Math.floor(p),h=Math.ceil(p);return l===h?v[l]:v[l]+(v[h]-v[l])*(p-l)}
  function atr(r,p=14){if(!r||r.length<=p)return null;const z=[];for(let i=r.length-p;i<r.length;i++){const x=r[i],pc=r[i-1].c;z.push(Math.max(x.h-x.l,Math.abs(x.h-pc),Math.abs(x.l-pc)))}return avg(z)}
  function tickSize(p){if(p<10)return .01;if(p<50)return .05;if(p<100)return .1;if(p<500)return .5;if(p<1000)return 1;return 5}
  function roundTick(p,mode='nearest'){const t=tickSize(Math.max(.01,p)),q=p/t,z=mode==='up'?Math.ceil(q):mode==='down'?Math.floor(q):Math.round(q);return +(z*t).toFixed(t<.1?2:t<1?1:0)}
  function positionInput(x){const avgCost=num(x?.averageCost),shares=num(x?.shares),buyDate=x?.buyDate||null;if(!(avgCost>0))throw Error('成本均價必須大於 0');if(!(shares>0))throw Error('持有股數必須大於 0');return{averageCost:avgCost,shares,buyDate,provenance:'user_observed'}}
  function analyze(input,bars,ctx={}){
    const p=positionInput(input),need=120;
    if(!Array.isArray(bars)||bars.length<need)throw Error(`持股出場模型有效日線不足：${bars?.length||0}/${need}`);
    if(ctx.legalSource!==true)throw Error('歷史行情來源授權未通過');
    if(ctx.priceVerified!==true)throw Error('最新官方收盤未完成交叉驗證');
    if(ctx.activeRiskKnown!==true)throw Error('注意／處置／特殊交易狀態尚未完整驗證');
    if(ctx.corporateActionKnown!==true)throw Error('公司行動／參考價事件尚未完整驗證');
    if(ctx.oosStatus!=='PASS')throw Error(`持股出場模型尚未通過正式 OOS：${ctx.oosStatus||'UNKNOWN'}`);
    if(ctx.entryContextComplete!==true)throw Error('九項市場訊號／美股／台指期／國際時事背景未完整驗證');

    const L=bars.at(-1),cl=bars.map(x=>x.c),w=bars.slice(-60),a=atr(bars,14),ma20=avg(cl.slice(-20)),ma60=avg(cl.slice(-60));
    if(!L||!Number.isFinite(L.c)||!(a>0)||![ma20,ma60].every(Number.isFinite))throw Error('價格／均線／ATR 資料不足');
    const structuralSupport=qtile(w.map(x=>x.l),.20),structuralResistance=qtile(w.map(x=>x.h),.80);
    if(![structuralSupport,structuralResistance].every(Number.isFinite))throw Error('持股結構資料不足');

    const defenseBase=Math.max(structuralSupport,Math.min(ma60,L.c)),defense=roundTick(Math.max(.01,defenseBase-a*.70),'down'),resistance=roundTick(Math.max(structuralResistance,L.c),'up');
    const marketValue=L.c*p.shares,cost=p.averageCost*p.shares,pnl=marketValue-cost,pnlPct=cost?100*pnl/cost:null;
    const trendUp=L.c>=ma20&&ma20>=ma60,belowDefense=L.c<defense,nearResistance=L.c>=structuralResistance-a*.20;
    let state,reason;
    if(ctx.riskBlocked){state='風險事件優先處理';reason='處置／特殊交易狀態已觸發，先依市場規則與風險限制處理，不套一般持股策略';}
    else if(belowDefense){state='出場／大幅減碼檢視';reason='最新已驗證收盤已跌破結構防守線；這是結構失效訊號，不是固定百分比停損';}
    else if(pnl>0&&nearResistance&&!trendUp){state='分批停利檢視';reason='持倉有獲利、價格接近結構壓力區，且趨勢條件轉弱';}
    else if(trendUp){state='續抱';reason='價格與主要均線結構仍維持正向；續抱同時觀察防守線與壓力區';}
    else{state='減碼／防守觀察';reason='趨勢結構未達完整續抱條件，但尚未跌破結構防守線';}

    return{
      model:'TW-holding-exit-v2',validation:'PASS',dataDate:L.iso||L.date||null,latestClose:L.c,
      position:p,derived:{cost,marketValue,pnl,pnlPct,ma20,ma60,atr:a,structuralSupport:roundTick(structuralSupport),structuralResistance:roundTick(structuralResistance),defense,resistance},
      decision:{state,reason,exitTrigger:`收盤跌破 ${defense} 時重新執行出場判定`,profitReview:`進入 ${resistance} 附近且趨勢轉弱時檢視分批停利`},
      provenance:{position:'user_observed',latestClose:'observed',structure:'derived',decision:'model_estimate'}
    };
  }
  window.StockLabHolding={analyze,positionInput,requiredBars:()=>120};
})();
