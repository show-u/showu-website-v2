// TOP 10 eligibility gate: broad TWSE universe -> liquidity shortlist -> verified-data eligibility -> ranking.
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
      const [all,ir]=await Promise.all([jget(U.snap),ihist(6)]),m=market(ir);showMarket(m);
      const universe=all.map(x=>({code:String(x.Code||''),name:x.Name,c:n(x.ClosingPrice),v:n(x.TradeValue)})).filter(x=>/^\d{4}$/.test(x.code)&&x.c&&x.v);
      const c=universe.sort((a,b)=>b.v-a.v).slice(0,40);
      if(!c.length)throw Error('TWSE 全市場快照沒有可用候選');
      const date=(await hist(c[0].code,2)).at(-1)?.iso;
      if(!date)throw Error('無法確認最新交易日');
      const e=await extras(date),qualified=[],rejected=[];
      for(const x of c){
        try{
          const r=await hist(x.code,h==='long'?12:6),L=r.at(-1);
          if(!L||old(L.iso)>4||Math.abs(L.c-x.c)>.001){rejected.push({...x,reason:'價格日期或收盤價交叉驗證未通過'});continue;}
          const a=combine(tech(r,h),h,m,e.V.get(x.code),e.I.get(x.code),e.R.get(x.code));
          const gate=completeness(a,h);a.completeness=gate;
          if(!gate.eligible){rejected.push({...x,score:gate.score,reason:`資料完整度 ${gate.score}%（門檻 ${gate.threshold}%）或關鍵資料缺漏`});continue;}
          qualified.push({...x,...a,date:L.iso});
        }catch(err){rejected.push({...x,reason:String(err.message||err)});}
      }
      qualified.sort((a,b)=>b.score-a.score);const out=qualified.slice(0,10);
      const box=document.querySelector('#top10');
      box.innerHTML=`<h2>值得優先研究 TOP 10</h2><p class=muted>母體：TWSE 全上市股票快照 → 依成交值做流動性初篩前 40 檔 → 官方資料完整性閘門 → 同一公式排名。資料不足者不得進榜。</p><div class=list>${out.length?out.map((x,i)=>`<div class=item><div class=rank>#${i+1}</div><div><b>${x.code} ${x.name}</b><div class=mini>✅ ${x.date}｜完整度 ${x.completeness.score}%｜${x.action}｜法人比 ${x.instRatio!=null?(x.instRatio*100).toFixed(1)+'%':'—'}｜營收YoY ${x.rev?.yoy??'—'}%</div></div><div class=price>${x.score}分<br><span class=mini>${fmt(x.c)}</span></div></div>`).join(''):`<p class=bad>目前沒有足夠資料完整度的股票符合入榜資格。</p>`}</div><p class=muted>本次合格 ${qualified.length} 檔／深入分析 ${c.length} 檔；${rejected.length} 檔因來源、日期、期別或完整度不足被排除。分數不是上漲機率。</p>`;
      box.classList.remove('hidden');
    }catch(e){const box=document.querySelector('#top10');box.innerHTML=`<h3 class=bad>掃描失敗</h3><p>${e.message}</p>`;box.classList.remove('hidden');}
    finally{document.querySelector('#scanLoad').classList.add('hidden');}
  };
})();
