// TOP 10 eligibility gate: TWSE + TPEx universe -> liquidity shortlist -> verified-data eligibility -> ranking.
(function(){
  const btn=document.querySelector('#scanBtn');
  if(!btn)return;
  function completeness(a,h){
    const q=a.integrity||{};
    const checks={price:!!q.price?.ok,institution:!!q.institution?.ok,valuation:!!q.valuation?.ok,revenue:!!q.revenue?.ok,quarterly:!!q.quarterly?.ok};
    const weights=h==='1m'?{price:30,institution:25,valuation:10,revenue:25,quarterly:10}:h==='3m'?{price:25,institution:20,valuation:10,revenue:20,quarterly:25}:{price:25,institution:10,valuation:20,revenue:20,quarterly:25};
    let score=0;for(const [k,w] of Object.entries(weights))if(checks[k])score+=w;
    const critical=h==='1m'?(checks.price&&checks.institution&&checks.revenue):h==='3m'?(checks.price&&checks.institution&&checks.revenue&&checks.quarterly):(checks.price&&checks.valuation&&checks.revenue&&checks.quarterly);
    const threshold=h==='1m'?80:85;
    return{score,critical,eligible:critical&&score>=threshold,checks,threshold};
  }
  btn.onclick=async()=>{
    const h=document.querySelector('#scanHorizon').value;
    document.querySelector('#scanLoad').classList.remove('hidden');
    try{
      const tp=window.StockLabTPEx;
      const [twAll,otcAll,ir]=await Promise.all([jget(U.snap),tp?tp.tpexSnapshot():Promise.resolve([]),ihist(6)]),m=market(ir);showMarket(m);
      const tw=twAll.map(x=>({market:'TWSE',code:String(x.Code||''),name:x.Name,c:n(x.ClosingPrice),v:n(x.TradeValue),date:null})).filter(x=>/^\d{4}$/.test(x.code)&&x.c&&x.v);
      const universe=[...tw,...otcAll].sort((a,b)=>b.v-a.v);
      const c=universe.slice(0,40);
      if(!c.length)throw Error('上市櫃全市場快照沒有可用候選');
      const firstTw=c.find(x=>x.market==='TWSE')||tw[0],twDate=firstTw?(await hist(firstTw.code,2)).at(-1)?.iso:null;
      const [twExtra,tpExtra]=await Promise.all([twDate?extras(twDate):Promise.resolve({V:new Map(),I:new Map(),R:new Map()}),tp?tp.tpexExtras():Promise.resolve({V:new Map(),I:new Map(),R:new Map()})]);
      const qualified=[],rejected=[];
      for(const x of c){
        try{
          const isOtc=x.market==='TPEx',r=isOtc?await tp.tpexHist(x.code,h==='long'?12:6):await hist(x.code,h==='long'?12:6),L=r.at(-1);
          if(!L){rejected.push({...x,reason:'沒有足夠歷史行情'});continue;}
          let vf;if(isOtc)vf=await tp.verifyTpex(x.code,r,x);else vf={complete:old(L.iso)<=4&&Math.abs(L.c-x.c)<.001,date:L.iso};
          if(!vf.complete){rejected.push({...x,reason:'價格日期或收盤價交叉驗證未通過'});continue;}
          const e=isOtc?tpExtra:twExtra;
          const a=combine(tech(r,h),h,m,e.V.get(x.code),e.I.get(x.code),e.R.get(x.code));
          const gate=completeness(a,h);a.completeness=gate;
          if(!gate.eligible){rejected.push({...x,score:gate.score,reason:`資料完整度 ${gate.score}%（門檻 ${gate.threshold}%）或關鍵資料缺漏`});continue;}
          qualified.push({...x,...a,date:L.iso});
        }catch(err){rejected.push({...x,reason:String(err.message||err)});}
      }
      qualified.sort((a,b)=>b.score-a.score);const out=qualified.slice(0,10),twCount=qualified.filter(x=>x.market==='TWSE').length,tpCount=qualified.filter(x=>x.market==='TPEx').length;
      const box=document.querySelector('#top10');
      box.innerHTML=`<h2>值得優先研究 TOP 10</h2><p class=muted>母體：TWSE 上市 + TPEx 上櫃官方快照 → 依成交值做流動性初篩前 40 檔 → 官方資料完整性閘門 → 同一公式排名。資料不足者不得進榜。</p><div class=list>${out.length?out.map((x,i)=>`<div class=item><div class=rank>#${i+1}</div><div><b>${x.code} ${x.name}</b><div class=mini>${x.market}｜✅ ${x.date}｜完整度 ${x.completeness.score}%｜${x.action}｜法人比 ${x.instRatio!=null?(x.instRatio*100).toFixed(1)+'%':'—'}｜營收YoY ${x.rev?.yoy??'—'}%</div></div><div class=price>${x.score}分<br><span class=mini>${fmt(x.c)}</span></div></div>`).join(''):`<p class=bad>目前沒有足夠資料完整度的股票符合入榜資格。</p>`}</div><p class=muted>本次合格 ${qualified.length} 檔（TWSE ${twCount}／TPEx ${tpCount}）／深入分析 ${c.length} 檔；${rejected.length} 檔因來源、日期、期別或完整度不足被排除。分數不是上漲機率。</p>`;
      box.classList.remove('hidden');
    }catch(e){const box=document.querySelector('#top10');box.innerHTML=`<h3 class=bad>掃描失敗</h3><p>${e.message}</p>`;box.classList.remove('hidden');}
    finally{document.querySelector('#scanLoad').classList.add('hidden');}
  };
})();
