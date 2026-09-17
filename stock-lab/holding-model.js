// Existing-position management is separate from buy-entry analysis.
// OOS status controls only statistical claims (confidence/win-rate), not deterministic holding-risk rules.
(function(){
  function num(v){if(v==null)return null;const x=Number(String(v).replace(/,/g,''));return Number.isFinite(x)?x:null}
  function avg(a){const v=a.filter(Number.isFinite);return v.length?v.reduce((x,y)=>x+y,0)/v.length:null}
  function qtile(a,q){const v=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!v.length)return null;const p=(v.length-1)*q,l=Math.floor(p),h=Math.ceil(p);return l===h?v[l]:v[l]+(v[h]-v[l])*(p-l)}
  function tickSize(p){if(p<10)return .01;if(p<50)return .05;if(p<100)return .1;if(p<500)return .5;if(p<1000)return 1;return 5}
  function roundTick(p,mode='nearest'){if(!Number.isFinite(p))return null;const t=tickSize(Math.max(.01,p)),q=p/t,z=mode==='up'?Math.ceil(q):mode==='down'?Math.floor(q):Math.round(q);return +(z*t).toFixed(t<.1?2:t<1?1:0)}
  function dateMs(v){if(!v)return null;const d=new Date(`${v}T00:00:00+08:00`);return Number.isNaN(d.getTime())?null:d.getTime()}
  function barDate(x){return x?.iso||x?.date||null}
  function positionInput(x){const averageCost=num(x?.averageCost),shares=num(x?.shares),buyDate=x?.buyDate||null;if(!(averageCost>0))throw Error('成本均價必須大於 0');if(!(shares>0))throw Error('持有股數必須大於 0');if(!buyDate||dateMs(buyDate)==null)throw Error('首次買入日必須由使用者輸入有效日期');return{averageCost,shares,buyDate,lots:Array.isArray(x?.lots)?x.lots:null,provenance:x?.provenance||{averageCost:'user_observed',shares:'user_observed',buyDate:'user_observed'}}}
  function normalizeBars(bars){return (Array.isArray(bars)?bars:[]).filter(x=>Number.isFinite(Number(x?.c))&&Number(x.c)>0).map(x=>({...x,c:Number(x.c),o:num(x.o),h:num(x.h),l:num(x.l)})).sort((a,b)=>String(barDate(a)).localeCompare(String(barDate(b))))}
  function analyze(input,bars,ctx={}){
    const p=positionInput(input),r=normalizeBars(bars);if(!r.length)throw Error('沒有可用的已驗證收盤資料');if(ctx.legalSource!==true)throw Error('行情來源授權未通過');if(ctx.priceVerified!==true)throw Error('最新收盤尚未通過驗證');
    const L=r.at(-1),dataDate=barDate(L);if(!dataDate)throw Error('最新交易日缺漏');
    const cost=p.averageCost*p.shares,marketValue=L.c*p.shares,pnl=marketValue-cost,pnlPct=cost?100*pnl/cost:null;
    const usable=r.slice(-Math.min(20,r.length)),lows=usable.map(x=>x.l).filter(Number.isFinite),highs=usable.map(x=>x.h).filter(Number.isFinite),closes=usable.map(x=>x.c).filter(Number.isFinite);
    const support=lows.length?(r.length>=20?qtile(lows,.20):Math.min(...lows)):null,resistance=highs.length?(r.length>=20?qtile(highs,.80):Math.max(...highs)):null,ma5=closes.length>=2?avg(closes.slice(-Math.min(5,closes.length))):null,ma20=closes.length>=20?avg(closes.slice(-20)):null;
    const trendKnown=ma5!=null&&(ma20!=null||closes.length>=2),trendUp=trendKnown&&(ma20!=null?L.c>=ma5&&ma5>=ma20:L.c>=ma5),trendWeak=trendKnown&&(ma20!=null?L.c<ma5&&ma5<ma20:L.c<ma5);
    const riskBlocked=ctx.riskBlocked===true,riskKnown=ctx.activeRiskKnown===true,corporateKnown=ctx.corporateActionKnown===true;
    let state,reason,nextAction;
    if(riskBlocked){state='風險事件優先';reason='已驗證的特殊交易／處置風險優先於一般技術條件';nextAction='下一合法交易時段先檢視減碼或退出可行性';}
    else if(pnl<0&&trendWeak){state='虧損且結構轉弱';reason='目前低於成本，且可用的已驗證價格結構偏弱';nextAction='不加碼；下一完成交易日若再跌破風險觸發線，進入減碼／出場檢視';}
    else if(pnl>0&&trendWeak){state='獲利保護';reason='仍有未實現獲利，但可用價格結構轉弱';nextAction='保護既有獲利；下一完成交易日若跌破風險觸發線，檢視分批減碼';}
    else if(pnl>0&&trendUp){state='續抱條件仍成立';reason='目前有未實現獲利，且可用價格結構尚未轉弱';nextAction='續抱觀察；接近壓力參考時再檢視分批停利';}
    else if(pnl<0){state='虧損部位防守';reason='目前低於成本，但現有合法資料不足以宣稱完整趨勢反轉';nextAction='不因猜測價格加碼；以下一完成交易日的已驗證風險觸發條件作防守';}
    else{state='成本附近觀察';reason='目前接近成本，沒有足夠證據支持強制出場或加碼';nextAction='等待下一完成交易日確認，不用短／中／長假設硬做決策';}
    const trigger=support!=null?roundTick(support,'down'):null,pressure=resistance!=null?roundTick(resistance,'up'):null;
    const historyLevel=r.length>=20?'20日結構':r.length>=2?`近 ${r.length} 個已驗證交易日`:'單一完成交易日';
    return{
      model:'TW-holding-rule-v1',validation:'RULE_BASED',dataDate,latestClose:L.c,
      position:p,derived:{cost,marketValue,pnl,pnlPct,availableBars:r.length,historyLevel,ma5,ma20,support:trigger,resistance:pressure},
      decision:{state,reason,nextAction,riskTrigger:trigger,pressureReference:pressure,riskTriggerMeaning:trigger!=null?'最近已驗證價格結構的防守參考；不是預測賣價':'目前資料不足以產生價格型防守線',pressureMeaning:pressure!=null?'最近已驗證價格結構的壓力參考；不是保證成交價':'目前資料不足以產生壓力價'},
      audit:{legal_source_verified:true,price_verified:true,active_risk_known:riskKnown,corporate_action_known:corporateKnown,oos_status:ctx.oosStatus||'NOT_REQUIRED_FOR_RULE_BASED_OUTPUT',confidence_calibrated:false,imputation_used:false},
      limits:{statement:'OOS 未通過時仍可顯示由已驗證事實直接推導的持倉風險規則；不得顯示勝率、成功率、機率或校準信心指數。'},
      provenance:{position:p.provenance,latestClose:'observed',pnl:'derived',support:trigger!=null?'derived_from_verified_bars':'unavailable',resistance:pressure!=null?'derived_from_verified_bars':'unavailable',decision:'deterministic_rule'}
    };
  }
  window.StockLabHolding={analyze,positionInput,requiredBars:()=>1};
})();