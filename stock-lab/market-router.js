// Public single-stock router: users do not need GPT or to know whether the stock is TWSE/TPEx.
(function(){
  const btn=document.querySelector('#analyzeBtn');if(!btn)return;
  function renderDayGate(code,marketName,a,vf){
    const box=document.querySelector('#result');
    if(!vf.complete){box.innerHTML=`<h3 class=bad>⛔ 資料驗證未通過</h3><p>日期 ${vf.date||'—'}｜${vf.text||'無法交叉驗證'}</p>`;box.classList.remove('hidden');return;}
    box.innerHTML=`<div class=toprow><div><div class=muted>${code}｜${marketName}｜當沖</div><h2>⛔ 當沖買賣建議未啟用</h2><div class=mini>目前僅有官方日線資料，沒有即時授權分K、成交明細與委託簿，因此不產生進場價、停損價或當沖目標價。</div></div><div class=bubble>${a.score}</div></div><h3>日線方向參考</h3><div class=sourcegrid><div class=sourceitem><b>最新收盤</b>${fmt(a.last.c)}<br><span class=mini>${vf.date}</span></div><div class=sourceitem><b>MA20 / MA60</b>${fmt(a.m20)} / ${fmt(a.m60)}</div><div class=sourceitem><b>MACD</b>DIF ${fmt(a.macd.dif)}｜Signal ${fmt(a.macd.sig)}</div><div class=sourceitem><b>RSI</b>${a.rsi!=null?a.rsi.toFixed(1):'—'}</div><div class=sourceitem><b>KD</b>K ${a.kd.k!=null?a.kd.k.toFixed(1):'—'}｜D ${a.kd.d!=null?a.kd.d.toFixed(1):'—'}</div><div class=sourceitem><b>K線</b>${a.candle}</div></div><div class=disclaimer><b>當沖資料限制</b>此模式只顯示日線方向研究，不構成盤中進出場依據。要提供真正當沖訊號，必須另接具授權且可驗證的即時成交、分K與委託簿資料源。</div>`;
    box.classList.remove('hidden');
  }
  btn.onclick=async()=>{
    const code=document.querySelector('#ticker').value.trim(),h=document.querySelector('#horizon').value;
    if(!/^\d{4,6}$/.test(code))return alert('請輸入股票代號');
    document.querySelector('#singleLoad').classList.remove('hidden');
    try{
      const tp=window.StockLabTPEx,[twSnap,tpSnap,ir]=await Promise.all([jget(U.snap),tp?tp.tpexSnapshot().catch(()=>[]):Promise.resolve([]),ihist(6)]),m=market(ir);showMarket(m);
      const twRow=twSnap.find(x=>String(x.Code)===code),otcRow=tpSnap.find(x=>x.code===code);
      if(!twRow&&!otcRow)throw Error('官方上市／上櫃快照找不到此代號，或該市場資料健康驗證未通過');
      let r,vf,e,marketName;
      if(otcRow&&!twRow){
        marketName='TPEx';r=await tp.tpexHist(code,h==='long'?12:6);if(!r.length)throw Error('TPEx 歷史行情不足或來源未通過');vf=await tp.verifyTpex(code,r,otcRow);e=await tp.tpexExtras();
      }else{
        marketName='TWSE';r=await hist(code,h==='long'?12:6);if(!r.length)throw Error('TWSE 歷史行情不足');vf=await verify(code,r);e=await extras(r.at(-1).iso);
      }
      const a=combine(tech(r,h),h,m,e.V.get(code),e.I.get(code),e.R.get(code));a.exchange=marketName;
      if(h==='day'){renderDayGate(code,marketName,a,vf);return;}
      render(code,a,h,vf);
      const result=document.querySelector('#result');
      if(result&&vf.complete){
        const head=result.querySelector('.toprow .muted');if(head)head.textContent=`${code}｜${marketName}｜${h}`;
        if(marketName==='TPEx')for(const el of result.querySelectorAll('.sourceitem')){el.innerHTML=el.innerHTML.replace(/TWSE/g,'TPEx').replace(/T86／BWIBBU_ALL／MOPS OpenAPI/g,'TPEx OpenAPI／MOPS OpenAPI');}
      }
    }catch(e){document.querySelector('#result').innerHTML=`<h3 class=bad>分析失敗</h3><p>${e.message}</p>`;document.querySelector('#result').classList.remove('hidden')}
    finally{document.querySelector('#singleLoad').classList.add('hidden')}
  };
})();
