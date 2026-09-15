// TOP 10 eligibility gate: TWSE + TPEx universe -> liquidity shortlist -> verified-data eligibility -> ranking.
(function(){
  const btn=document.querySelector('#scanBtn');
  if(!btn)return;
  const CACHE_TTL=10*60*1000;
  const scanCache=new Map();
  function completeness(a,h){
    const q=a.integrity||{};
    const checks={price:!!q.price?.ok,institution:!!q.institution?.ok,valuation:!!q.valuation?.ok,revenue:!!q.revenue?.ok,quarterly:!!q.quarterly?.ok};
    const weights=h==='1m'?{price:30,institution:25,valuation:10,revenue:25,quarterly:10}:h==='3m'?{price:25,institution:20,valuation:10,revenue:20,quarterly:25}:{price:25,institution:10,valuation:20,revenue:20,quarterly:25};
    let score=0;for(const [k,w] of Object.entries(weights))if(checks[k])score+=w;
    const critical=h==='1m'?(checks.price&&checks.institution&&checks.revenue):h==='3m'?(checks.price&&checks.institution&&checks.revenue&&checks.quarterly):(checks.price&&checks.valuation&&checks.revenue&&checks.quarterly);
    const threshold=h==='1m'?80:85;
    return{score,critical,eligible:critical&&score>=threshold,checks,threshold};
  }
  async function mapLimit(items,limit,worker){
    const out=new Array(items.length);let next=0;
    async function run(){
      while(true){const i=next++;if(i>=items.length)return;out[i]=await worker(items[i],i);}
    }
    await Promise.all(Array.from({length:Math.min(limit,items.length)},run));
    return out;
  }
  function renderCached(html){const box=document.querySelector('#top10');box.innerHTML=html;box.classList.remove('hidden');}
  btn.onclick=async()=>{
    const h=document.querySelector('#scanHorizon').value;
    const cached=scanCache.get(h);
    if(cached&&Date.now()-cached.at<CACHE_TTL){renderCached(cached.html);return;}
    document.querySelector('#scanLoad').classList.remove('hidden');
    try{
      const tp=window.StockLabTPEx;
      const [twAll,ir]=await Promise.all([jget(U.snap),ihist(6)]),m=market(ir);showMarket(m);
      let otcAll=[],tpHealth={usable:false,status:'unavailable'};
      if(tp){
        tpHealth=await tp.tpexHealth().catch(e=>({usable:false,status:'failed',error:String(e.message||e)}));
        if(tpHealth.usable)otcAll=await tp.tpexSnapshot().catch(()=>[]);
      }
      const tw=twAll.map(x=>({market:'TWSE',code:String(x.Code||''),name:x.Name,c:n(x.ClosingPrice),v:n(x.TradeValue),date:null})).filter(x=>/^\d{4}$/.test(x.code)&&x.c&&x.v);
      const universe=[...tw,...otcAll].sort((a,b)=>b.v-a.v);
      const c=universe.slice(0,40);
      if(!c.length)throw Error('上市櫃全市場快照沒有可用候選');
      const firstTw=c.find(x=>x.market==='TWSE')||tw[0],twDate=firstTw?(await hist(firstTw.code,2)).at(-1)?.iso:null;
      const [twExtra,tpExtra]=await Promise.all([
        twDate?extras(twDate):Promise.resolve({V:new Map(),I:new Map(),R:new Map()}),
        tpHealth.usable&&tp?tp.tpexExtras().catch(()=>({V:new Map(),I:new Map(),R:new Map()})):Promise.resolve({V:new Map(),I:new Map(),R:new Map()})
      ]);
      const results=await mapLimit(c,3,async x=>{
        try{
          const isOtc=x.market==='TPEx',r=isOtc?await tp.tpexHist(x.code,h==='long'?12:6):await hist(x.code,h==='long'?12:6),L=r.at(-1);
          if(!L)return{ok:false,x,reason:'沒有足夠歷史行情'};
          let vf;if(isOtc)vf=await tp.verifyTpex(x.code,r,x);else vf={complete:old(L.iso)<=4&&Math.abs(L.c-x.c)<.001,date:L.iso};
          if(!vf.complete)return{ok:false,x,reason:'價格日期或收盤價交叉驗證未通過'};
          const e=isOtc?tpExtra:twExtra;
          const a=combine(tech(r,h),h,m,e.V.get(x.code),e.I.get(x.code),e.R.get(x.code));
          const gate=completeness(a,h);a.completeness=gate;
          if(!gate.eligible)return{ok:false,x,score:gate.score,reason:`資料完整度 ${gate.score}%（門檻 ${gate.threshold}%）或關鍵資料缺漏`};
          return{ok:true,item:{...x,...a,date:L.iso}};
        }catch(err){return{ok:false,x,reason:String(err.message||err)};}
      });
      const qualified=results.filter(z=>z?.ok).map(z=>z.item),rejected=results.filter(z=>z&&!z.ok).map(z=>({...z.x,score:z.score,reason:z.reason}));
      qualified.sort((a,b)=>b.score-a.score);const out=qualified.slice(0,10),twCount=qualified.filter(x=>x.market==='TWSE').length,tpCount=qualified.filter(x=>x.market==='TPEx').length;
      const scope=tpHealth.usable?'TWSE 上市 + TPEx 上櫃':'目前僅 TWSE 上市（TPEx 健康驗證尚未通過）',tpStatus=tpHealth.usable?'✅ TPEx verified':`⚠️ TPEx ${tpHealth.status||'unavailable'}：上櫃資料暫不納入`;
      const html=`<h2>值得優先研究 TOP 10</h2><p class=muted>本次母體：${scope} → 依成交值做流動性初篩前 40 檔 → 官方資料完整性閘門 → 同一公式排名。資料不足者不得進榜。</p><div class=sourceitem><b>${tpStatus}</b><span class=mini>Source Guard 採 fail-closed；TPEx 未驗證時不會用舊值或猜測補入排名。</span></div><div class=list>${out.length?out.map((x,i)=>`<div class=item><div class=rank>#${i+1}</div><div><b>${x.code} ${x.name}</b><div class=mini>${x.market}｜✅ ${x.date}｜完整度 ${x.completeness.score}%｜${x.action}｜法人比 ${x.instRatio!=null?(x.instRatio*100).toFixed(1)+'%':'—'}｜營收YoY ${x.rev?.yoy??'—'}%</div></div><div class=price>${x.score}分<br><span class=mini>${fmt(x.c)}</span></div></div>`).join(''):`<p class=bad>目前沒有足夠資料完整度的股票符合入榜資格。</p>`}</div><p class=muted>本次合格 ${qualified.length} 檔（TWSE ${twCount}／TPEx ${tpCount}）／深入分析 ${c.length} 檔；${rejected.length} 檔因來源、日期、期別或完整度不足被排除。採最多 3 檔有限併發，避免對官方 API 造成過量請求；同投資週期結果快取 10 分鐘。分數不是上漲機率。</p>`;
      scanCache.set(h,{at:Date.now(),html});renderCached(html);
    }catch(e){const box=document.querySelector('#top10');box.innerHTML=`<h3 class=bad>掃描失敗</h3><p>${e.message}</p>`;box.classList.remove('hidden');}
    finally{document.querySelector('#scanLoad').classList.add('hidden');}
  };
})();
