// Holding-position router. No short/mid/long buy logic, no OOS lock.
// User position + legally verified market facts => actionable deterministic holding rules.
(function(){
  const btn=document.querySelector('#holdAnalyzeBtn'),input=document.querySelector('#holdTicker'),load=document.querySelector('#holdLoad'),box=document.querySelector('#holdResult');
  if(!btn||!input||!load||!box)return;
  const MISSING='資料未取得／未通過驗證';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>{const x=Number(String(v??'').replace(/,/g,''));return Number.isFinite(x)?x:null};
  const money=x=>Number.isFinite(Number(x))?Number(x).toLocaleString('zh-TW',{maximumFractionDigits:2}):'—';
  const pick=(o,keys)=>{for(const k of keys){const v=o?.[k];if(v!=null&&String(v).trim()!=='')return v}return null};
  const ageDays=iso=>{const d=new Date(iso);return Number.isNaN(d.getTime())?999:Math.floor((Date.now()-d.getTime())/86400000)};
  const withTimeout=(promise,ms,label)=>Promise.race([Promise.resolve(promise),new Promise((_,reject)=>setTimeout(()=>reject(Error(label)),ms))]);
  const stage=name=>{window.StockLabHoldingRuntime={stage:name,at:Date.now()};console.info('StockLabHoldingStage:'+name)};

  function positionFacts(code,name,p){return `<div class=toprow><div><h2>${esc(name?`${name}／${code}`:code)}</h2><div class=muted>已持有｜持有／減碼／出場分析</div></div></div><div class=sourcegrid style="margin-top:10px"><div class=sourceitem><b>成本均價</b>${money(p.averageCost)}</div><div class=sourceitem><b>目前持有股數</b>${money(p.shares)}</div><div class=sourceitem><b>目前部位總成本</b>${money(p.totalCost)}<br><span class=mini>系統計算：成本均價 × 持有股數</span></div><div class=sourceitem><b>首次買入時間</b>${esc(p.buyTime)}</div></div>`}

  async function loadSnapshot(code,market){
    const src=window.StockLabSameOrigin;if(!src?.latest)throw Error('合法市場事實介面尚未初始化');
    const row=await src.latest(code,market);
    if(row.licence!=='OGDL-1.0'||row.provenance!=='observed')throw Error('市場事實授權／來源驗證未通過');
    const close=n(row.close),open=n(row.open),high=n(row.high),low=n(row.low),date=String(row.date||'').trim();
    if(!(close>0)||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error(`${market} 收盤價／交易日格式未通過`);
    return{close,open,high,low,date,source:`${market} OGDL 授權市場事實｜${row.source_id||'source-id unavailable'}`,licence:'OGDL-1.0'};
  }

  async function legalBars(code,market,snap){
    try{
      if(window.STOCKLAB_RUNTIME?.gates?.licensedHistoricalOHLC!==true)throw Error('合法歷史資料尚未啟用');
      const h=window.StockLabLicensedHistory;
      if(h?.load){
        const bars=await withTimeout(h.load({code,market,minimumBars:1}),1500,'合法歷史資料逾時');
        if(Array.isArray(bars)&&bars.length)return{bars,source:'licensed-history'};
      }
    }catch{}
    return{bars:[{iso:snap.date,date:snap.date,c:snap.close,o:snap.open,h:snap.high,l:snap.low,provenance:'observed'}],source:'latest-verified-snapshot'};
  }

  async function context(code,market){
    let riskKnown=false,riskBlocked=false,riskLabel='注意／處置狀態未完整驗證',corporateKnown=false;
    const factorTask=(async()=>{
      try{
        if(window.StockLabTaiwan?.loadFactors){
          await withTimeout(window.StockLabTaiwan.loadFactors(),1200,'台股風險因子逾時');
          const f=window.StockLabTaiwan.stockFactor?.(code)||{};
          riskKnown=Object.prototype.hasOwnProperty.call(f,'disposition')||Object.prototype.hasOwnProperty.call(f,'attention')||Object.prototype.hasOwnProperty.call(f,'margin_suspended');
          riskBlocked=f.disposition===true||f.margin_suspended===true;
          riskLabel=riskKnown?(f.disposition?'處置':f.attention?'注意':f.margin_suspended?'信用交易受限':'已驗證無旗標'):'注意／處置狀態未完整驗證';
        }
      }catch{}
    })();
    const corporateTask=(async()=>{
      try{
        if(window.STOCKLAB_RUNTIME?.gates?.corporateActions!==true)return;
        const h=window.StockLabLicensedHistory;
        if(h?.context){
          await withTimeout(h.context({code,market}),1200,'公司行動資料逾時');
          corporateKnown=true;
        }
      }catch{}
    })();
    await Promise.all([factorTask,corporateTask]);
    return{riskKnown,riskBlocked,riskLabel,corporateKnown};
  }

  async function sessionInfo(market,dataDate){
    try{
      if(window.STOCKLAB_RUNTIME?.gates?.tradingCalendar!==true)return'下一合法交易日尚未驗證';
      const resolver=window.StockLabSessionContext?.resolve;
      if(!resolver)return'下一合法交易日尚未驗證';
      const s=await withTimeout(resolver({market,dataDate}),1200,'交易日曆逾時');
      return s?.verified?`${s.label||''}${s.targetDate?`｜下一合法交易日 ${s.targetDate}`:''}`:'下一合法交易日尚未驗證';
    }catch{return'下一合法交易日尚未驗證'}
  }

  function render(code,name,market,p,snap,res,ctx,barSource,session){
    const d=res.derived||{},q=res.decision||{},profit=Number(d.pnl),pct=Number(d.pnlPct),trigger=q.riskTrigger,pressure=q.pressureReference;
    const triggerText=trigger!=null?money(trigger):'—',pressureText=pressure!=null?money(pressure):'—';
    box.innerHTML=positionFacts(code,name,p)+`<div class=source-note><b>目前持倉判斷：${esc(q.state)}</b><div class=mini>${esc(q.reason)}</div><div style="margin-top:6px"><b>下一步：</b>${esc(q.nextAction)}</div><div style="margin-top:6px"><b>出場條件：</b>${esc(q.exitAction||'—')}</div><div class=mini style="margin-top:4px"><b>判斷依據：</b>${esc(q.riskTriggerBasis||'—')}；壓力依據：${esc(q.pressureBasis||'—')}</div></div><div class=source-note style="margin-top:8px"><b>建議出場／減碼條件</b><div style="margin-top:6px"><b>出場檢視：</b>${esc(q.exitCondition||'無法判定')}</div><div style="margin-top:6px"><b>減碼／停利檢視：</b>${esc(q.reduceCondition||'無法判定')}</div><div class=mini style="margin-top:6px">數字價格只在已取得足夠且合法驗證的價格結構時顯示；不足時明確說明缺少什麼，不用假價格補齊。</div></div><div class=sourcegrid style="margin-top:8px"><div class=sourceitem><b>最新已驗證收盤</b>${money(snap.close)}${snap.date?`｜${esc(snap.date)}`:''}<br><span class=mini>${esc(snap.source)}｜非盤中即時價</span></div><div class=sourceitem><b>依收盤估算損益</b>${profit>=0?'+':''}${money(profit)}｜${pct>=0?'+':''}${Number.isFinite(pct)?pct.toFixed(2):'—'}%</div><div class=sourceitem><b>建議出場觸發價</b>${triggerText}<br><span class=mini>${esc(q.riskTriggerMeaning)}</span></div><div class=sourceitem><b>停利／壓力參考</b>${pressureText}<br><span class=mini>${esc(q.pressureMeaning)}</span></div><div class=sourceitem><b>可用價格資料</b>${esc(d.historyLevel||'—')}｜${money(d.availableBars)} 根<br><span class=mini>${esc(barSource)}</span></div><div class=sourceitem><b>台股特殊狀態</b>${esc(ctx.riskLabel)}<br><span class=mini>${ctx.corporateKnown?'公司行動資料層已取得':'公司行動狀態未完整驗證'}</span></div></div><div class=source-note><b>執行時間</b><div class=mini>${esc(session)}。本頁用完成交易日資料形成條件；沒有合法即時行情時，不宣稱知道盤中現在價格。</div></div><div class=disclaimer><b>這不是 OOS 鎖定模型</b>持倉管理採已驗證事實＋確定性規則。OOS 尚未通過只代表不能宣稱勝率、成功率、機率或校準信心；不再把持股分析整頁鎖住。資料不足時不捏造賣價，價格型觸發線會顯示「—」，但仍提供可執行的下一步與風險條件。</div>`;
  }

  btn.onclick=async()=>{stage('clicked');load.classList.remove('hidden');try{
    const resolver=window.StockLabTickerResolver;if(!resolver?.resolve||!resolver?.loadUniverse)throw Error('股票代號／名稱解析器尚未就緒');const code=await resolver.resolve(input.value);input.value=code;stage('resolved');
    const p=window.StockLabPositionInput?.collect?.();if(!p)throw Error('持股輸入模組尚未就緒');stage('position-collected');
    const u=await resolver.loadUniverse(),meta=u.find(x=>x.code===code)||{},name=meta.name||'',market=meta.market;if(!market)throw Error('股票市場別未能由合法名稱索引驗證');stage('market-resolved');
    const snap=await loadSnapshot(code,market);stage('snapshot-loaded');
    const [hb,ctx]=await Promise.all([legalBars(code,market,snap),context(code,market)]);stage('enrichments-finished');
    const model=window.StockLabHolding;if(!model?.analyze)throw Error('持倉規則模型尚未載入');
    const res=model.analyze(p,hb.bars,{legalSource:true,priceVerified:true,activeRiskKnown:ctx.riskKnown,corporateActionKnown:ctx.corporateKnown,riskBlocked:ctx.riskBlocked,oosStatus:window.StockLabDataStatus?.validation?.models?.holding_exit?.status||'UNVALIDATED'});stage('model-finished');
    const session=await sessionInfo(market,snap.date||res.dataDate);stage('session-finished');
    render(code,name,market,p,snap,res,ctx,hb.source,session);stage('rendered');
  }catch(e){stage('error');box.innerHTML=`<h3 class=bad>持倉分析失敗</h3><p>${esc(e.message||e)}</p><div class=mini>缺少的資料維持缺少，不以假資料補值。</div>`}finally{load.classList.add('hidden')}};
})();