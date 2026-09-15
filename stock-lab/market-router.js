// Public single-stock router: users do not need GPT or to know whether the stock is TWSE/TPEx.
(function(){
  const btn=document.querySelector('#analyzeBtn');if(!btn)return;
  btn.onclick=async()=>{
    const code=document.querySelector('#ticker').value.trim(),h=document.querySelector('#horizon').value;
    if(!/^\d{4,6}$/.test(code))return alert('請輸入股票代號');
    document.querySelector('#singleLoad').classList.remove('hidden');
    try{
      const tp=window.StockLabTPEx,[twSnap,tpSnap,ir]=await Promise.all([jget(U.snap),tp?tp.tpexSnapshot():Promise.resolve([]),ihist(6)]),m=market(ir);showMarket(m);
      const twRow=twSnap.find(x=>String(x.Code)===code),otcRow=tpSnap.find(x=>x.code===code);
      if(!twRow&&!otcRow)throw Error('官方上市／上櫃快照找不到此代號');
      let r,vf,e,marketName;
      if(otcRow&&!twRow){
        marketName='TPEx';r=await tp.tpexHist(code,h==='long'?12:6);if(!r.length)throw Error('TPEx 歷史行情不足或來源未通過');vf=await tp.verifyTpex(code,r,otcRow);e=await tp.tpexExtras();
      }else{
        marketName='TWSE';r=await hist(code,h==='long'?12:6);if(!r.length)throw Error('TWSE 歷史行情不足');vf=await verify(code,r);e=await extras(r.at(-1).iso);
      }
      const a=combine(tech(r,h),h,m,e.V.get(code),e.I.get(code),e.R.get(code));a.exchange=marketName;render(code,a,h,vf);
      const result=document.querySelector('#result');
      if(result&&vf.complete){
        const head=result.querySelector('.toprow .muted');if(head)head.textContent=`${code}｜${marketName}｜${h}`;
        if(marketName==='TPEx')for(const el of result.querySelectorAll('.sourceitem')){el.innerHTML=el.innerHTML.replace(/TWSE/g,'TPEx').replace(/T86／BWIBBU_ALL／MOPS OpenAPI/g,'TPEx OpenAPI／MOPS OpenAPI');}
      }
    }catch(e){document.querySelector('#result').innerHTML=`<h3 class=bad>分析失敗</h3><p>${e.message}</p>`;document.querySelector('#result').classList.remove('hidden')}
    finally{document.querySelector('#singleLoad').classList.add('hidden')}
  };
})();
