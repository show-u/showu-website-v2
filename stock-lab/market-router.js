// StockLab single-stock Taiwan analyst 9+3 research router.
// No short/mid/long buy models. No one-bar single-price shortcut. Missing data stays missing.
(function(){
  const btn=document.querySelector('#analyzeBtn'),input=document.querySelector('#ticker'),load=document.querySelector('#singleLoad'),box=document.querySelector('#result');
  if(!btn||!input||!load||!box)return;
  const MISSING='資料未取得／未通過驗證';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{if(v==null||v==='')return null;const x=Number(String(v).replace(/,/g,''));return Number.isFinite(x)?x:null};
  const money=v=>num(v)==null?'—':num(v).toLocaleString('zh-TW',{maximumFractionDigits:2});
  const pct=v=>num(v)==null?'—':(num(v)>=0?'+':'')+num(v).toFixed(2)+'%';
  const avg=a=>{const v=a.filter(Number.isFinite);return v.length?v.reduce((x,y)=>x+y,0)/v.length:null};
  const qtile=(a,q)=>{const v=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!v.length)return null;const p=(v.length-1)*q,l=Math.floor(p),h=Math.ceil(p);return l===h?v[l]:v[l]+(v[h]-v[l])*(p-l)};
  let researchPromise=null;

  async function latest(code){
    const c=window.StockLabSameOrigin;if(!c?.latest)throw Error('合法 OGDL 市場事實層尚未就緒');
    const r=await c.latest(code);
    if(!r||r.provenance!=='observed'||r.licence!=='OGDL-1.0')throw Error('市場事實來源授權／驗證未通過');
    for(const k of ['open','high','low','close'])if(!(num(r[k])>0))throw Error('最新完成交易日 '+k+' 未通過驗證');
    return r;
  }
  async function factors(code,market){
    try{
      await window.StockLabTaiwan?.loadFactors?.();
      return {
        stock:window.StockLabTaiwan?.stockFactor?.(code)||{},
        risk:window.StockLabTaiwan?.riskState?.(code,market)||{},
        all:window.StockLabTaiwan?.factors||{}
      };
    }catch(e){return{stock:{},risk:{flags:['台股風險狀態未完整驗證']},all:{error:String(e.message||e)}}}
  }
  async function research(){
    if(researchPromise)return researchPromise;
    researchPromise=fetch('./research-facts.json',{cache:'no-store'}).then(async r=>{
      if(!r.ok)throw Error('研究資料快照尚未產生');
      const x=await r.json();
      if(x.schema_version!==1||x.source!=='ogdl-normalized-research-facts'||x.licence!=='OGDL-1.0'||x.no_imputation!==true)throw Error('研究資料授權／版本驗證未通過');
      return x;
    }).catch(e=>({source:'unavailable',stocks:{},market:{},source_status:{},error:String(e.message||e)}));
    return researchPromise;
  }
  async function history(code,market){
    const h=window.StockLabLicensedHistory;
    if(!h?.load)return{bars:null,reason:'合法歷史資料層尚未接入'};
    try{return{bars:await h.load({code,market,minimumBars:60}),reason:null}}
    catch(e){return{bars:null,reason:String(e.message||e)}}
  }
  const common=(code,f)=>/^\d{4}$/.test(String(code))&&!String(code).startsWith('00')&&!!String(f?.industry||'').trim();
  const row=(x,label,evidence,detail,state='neutral')=>({key:x,label,verified:true,state,evidence,detail,provenance:'observed+derived'});
  const missing=(x,label,detail)=>({key:x,label,verified:false,state:'unavailable',evidence:MISSING,detail:detail||MISSING,provenance:'unavailable'});
  const badge=s=>s==='positive'?'偏正面':s==='negative'?'偏負面':s==='neutral'?'中性／混合':'未取得';
  const card=s=>'<div class=sourceitem><b>'+esc(s.label)+'｜'+esc(badge(s.state))+'</b><div>'+esc(s.evidence)+'</div><div class=mini style="margin-top:5px">'+esc(s.detail||'')+'</div></div>';
  const sr=(x,market,code)=>x?.stocks?.[market+':'+code]||null;

  function technical(bars){
    if(!bars||bars.length<60)return null;
    const c=bars.map(x=>num(x.c)),ma=p=>avg(c.slice(-p)),m5=ma(5),m10=ma(10),m20=ma(20),m60=ma(60),L=bars.at(-1);
    let g=0,l=0;for(let i=bars.length-14;i<bars.length;i++){const d=num(bars[i].c)-num(bars[i-1].c);d>0?g+=d:l-=d}
    const rsi=l===0?100:100-100/(1+(g/14)/(l/14));
    const ema=(v,p)=>{if(v.length<p)return null;let e=avg(v.slice(0,p)),k=2/(p+1);for(let i=p;i<v.length;i++)e=v[i]*k+e*(1-k);return e};
    const e12=ema(c,12),e26=ema(c,26),dif=e12!=null&&e26!=null?e12-e26:null,w20=bars.slice(-20);
    const support=Math.min(...w20.map(x=>num(x.l))),resist=Math.max(...w20.map(x=>num(x.h)));
    let K=50,D=50;for(let i=Math.max(8,bars.length-30);i<bars.length;i++){const w=bars.slice(i-8,i+1),lo=Math.min(...w.map(x=>num(x.l))),hi=Math.max(...w.map(x=>num(x.h))),v=hi===lo?50:(num(bars[i].c)-lo)/(hi-lo)*100;K=K*2/3+v/3;D=D*2/3+K/3}
    return{m5,m10,m20,m60,rsi,dif,K,D,support,resist,state:num(L.c)>m20&&m20>m60?'positive':num(L.c)<m20&&m20<m60?'negative':'neutral'};
  }
  function contexts(family){
    const raw=window.StockLabEntryDecision?.marketContexts?.(family)||{
      us:window.StockLabExternalMarket?.context?.(family)||{verified:false,reason:'美股／SOX 資料未取得'},
      tx:window.StockLabTX?.context?.()||{verified:false,reason:'台指期 TX 資料未取得'},
      events:window.StockLabEvents?.context?.()||{verified:false,reason:'國際事件資料未取得'}
    };
    const cv=(key,label,x)=>{
      if(x?.verified!==true)return missing(key,label,x?.reason||MISSING);
      const st=(x.state==='supportive'||x.state==='up')?'positive':(x.state==='adverse'||x.state==='down')?'negative':'neutral';
      return row(key,label,x.reason||'已通過來源與日期驗證','來源 '+(x.provenance||'derived'),st);
    };
    return[cv('us','＋1 美股／SOX',raw.us),cv('tx','＋2 台指期 TX',raw.tx),cv('events','＋3 國際事件',raw.events)];
  }
  function makeSections(r,fx,R,H){
    const S=sr(R,r.market,r.ticker),bars=H.bars,op=num(r.open),hi=num(r.high),lo=num(r.low),cl=num(r.close),vol=num(r.volume),tv=num(r.trade_value),day=op>0?(cl/op-1)*100:null,loc=hi>lo?(cl-lo)/(hi-lo):null;
    let histText='合法多日歷史未取得；不宣稱 5 日／20 日趨勢或量能放大';
    if(bars?.length>=21){
      const p5=num(bars.at(-6).c),p20=num(bars.at(-21).c),v20=avg(bars.slice(-20).map(x=>num(x.v))),vr=v20&&vol?vol/v20:null;
      histText='5日 '+pct(p5?(cl/p5-1)*100:null)+'｜20日 '+pct(p20?(cl/p20-1)*100:null)+(vr!=null?'｜量比20日 '+vr.toFixed(2)+'x':'');
    }
    const price=row('priceVolume','① 價格與成交量',r.date+' 開 '+money(op)+'｜高 '+money(hi)+'｜低 '+money(lo)+'｜收 '+money(cl)+'｜相對開盤 '+pct(day),'成交量 '+money(vol)+'｜成交金額 '+money(tv)+'。'+histText,day>0&&loc>=.6?'positive':day<0&&loc<=.4?'negative':'neutral');

    let market;
    if(r.market==='TWSE'){
      const x=R?.market?.taiex,b=R?.market?.twse_breadth;
      market=x?.verified===true&&num(x.close)!=null?row('taiwanMarket','② 台股大盤／市場環境','TAIEX '+money(x.close)+'｜'+(num(x.change_points)>=0?'+':'')+money(x.change_points)+' 點'+(b?.verified===true?'｜上漲 '+b.up+'／下跌 '+b.down:''),'資料日 '+x.date+'｜官方 OGDL 市場資料',num(x.change_points)>0?'positive':num(x.change_points)<0?'negative':'neutral'):missing('taiwanMarket','② 台股大盤／市場環境','TAIEX／市場廣度資料未合法完整取得');
    }else{
      const x=fx.all?.market;
      market=x?.otc_verified===true&&num(x.otc_close)!=null?row('taiwanMarket','② 台股大盤／市場環境','TPEx 指數 '+money(x.otc_close)+'｜'+pct(x.otc_change_pct),'資料日 '+x.otc_date+'｜官方衍生、無補值',num(x.otc_change_pct)>0?'positive':num(x.otc_change_pct)<0?'negative':'neutral'):missing('taiwanMarket','② 台股大盤／市場環境','OTC 市場環境未取得／未通過驗證');
    }

    const t=technical(bars),tech=t?row('technical','③ 技術面','MA5 '+money(t.m5)+'｜MA10 '+money(t.m10)+'｜MA20 '+money(t.m20)+'｜MA60 '+money(t.m60),'RSI14 '+t.rsi.toFixed(1)+'｜KD '+t.K.toFixed(1)+' / '+t.D.toFixed(1)+'｜MACD DIF '+money(t.dif)+'｜20日支撐 '+money(t.support)+'／壓力 '+money(t.resist),t.state):missing('technical','③ 技術面',(H.reason||'合法歷史不足')+'；MA／MACD／RSI／KD／支撐壓力不以其他網站或假資料補齊');

    const cp=[],verified=[];
    if(fx.stock?.margin_change_pct!=null){cp.push('融資餘額變化 '+pct(fx.stock.margin_change_pct));verified.push('margin')}else cp.push('融資：未取得');
    if(fx.stock?.short_change_pct!=null){cp.push('融券餘額變化 '+pct(fx.stock.short_change_pct));verified.push('short')}else cp.push('融券：未取得');
    const inst=S?.institution;if(inst?.verified===true){cp.push('外資 '+money(inst.foreign)+'｜投信 '+money(inst.trust)+'｜自營 '+money(inst.dealer)+'｜合計 '+money(inst.total));verified.push('institution')}else cp.push(r.market==='TWSE'?'上市個股三大法人：授權未確認，禁止補值':'三大法人：未取得／未驗證');
    const chips=verified.includes('margin')&&verified.includes('institution')?row('chips','④ 籌碼／法人／融資融券',cp.join('｜'),(fx.risk?.flags||[]).join('；')||'風險狀態未知',num(inst?.total)>0?'positive':num(inst?.total)<0?'negative':'neutral'):missing('chips','④ 籌碼／法人／融資融券',cp.join('｜')+'。缺少項目不視為 0 或中性');

    const v=S?.valuation;
    let valuation=missing('valuation','⑤ 估值','PE／PB／殖利率未取得／未驗證');
    if(v?.verified===true){
      const peers=[],industry=fx.stock?.industry;
      for(const [k,z] of Object.entries(R?.stocks||{})){if(!k.startsWith(r.market+':')||z?.valuation?.verified!==true)continue;const cc=k.split(':')[1];if(fx.all?.stocks?.[cc]?.industry!==industry)continue;const pe=num(z.valuation.pe);if(pe>0)peers.push(pe)}
      const pe=num(v.pe),pr=pe>0&&peers.length>=8?peers.filter(x=>x<=pe).length/peers.length:null;
      valuation=row('valuation','⑤ 估值','PE '+money(pe)+'｜PB '+money(v.pb)+'｜殖利率 '+(num(v.dividend_yield)!=null?num(v.dividend_yield).toFixed(2)+'%':'—'),(pr!=null?'同產業 PE 約第 '+Math.round(pr*100)+' 百分位（樣本 '+peers.length+'）':'同產業可比較樣本不足，不硬做高低估判定')+'｜資料日 '+(v.date||'—'),pr==null?'neutral':pr>=.75?'negative':pr<=.35?'positive':'neutral');
    }

    const rev=S?.revenue;
    const revenue=rev?.verified===true?row('revenue','⑥ 月營收',rev.period+'｜當月營收 '+money(rev.current_revenue)+'｜YoY '+pct(rev.yoy)+'｜MoM '+pct(rev.mom),'累計營收 '+money(rev.ytd_revenue)+'｜累計 YoY '+pct(rev.ytd),num(rev.yoy)>0&&num(rev.mom)>0?'positive':num(rev.yoy)<0&&num(rev.mom)<0?'negative':'neutral'):missing('revenue','⑥ 月營收','最新月營收未取得／期別未通過驗證');

    const q=S?.quarterly;
    const quarterly=q?.verified===true?row('quarterly','⑦ 季報／獲利',q.year+' Q'+q.quarter+'｜營收 '+money(q.revenue)+'｜EPS '+money(q.eps),'毛利率 '+pct(q.gross_margin)+'｜營益率 '+pct(q.operating_margin)+'｜本期淨利 '+money(q.net_income)+'｜出表 '+q.report_date,num(q.operating_margin)>0?'positive':'negative'):missing('quarterly','⑦ 季報／獲利','適用會計類別的最新季報未取得／未通過驗證');

    const fq=S?.financial_quality;
    const financial=fq?.verified===true?row('financialQuality','⑧ 財務品質','負債比 '+pct(fq.debt_ratio)+'｜流動比 '+money(fq.current_ratio),'總資產 '+money(fq.total_assets)+'｜總負債 '+money(fq.total_liabilities)+'｜權益 '+money(fq.total_equity)+'｜現金／庫存來源未提供就維持未取得',num(fq.debt_ratio)<60&&num(fq.current_ratio)>=1?'positive':num(fq.debt_ratio)>80||num(fq.current_ratio)<.7?'negative':'neutral'):missing('financialQuality','⑧ 財務品質','資產負債表或適用會計類別未取得；現金、庫存不補');

    const industry=fx.stock?.industry;
    const industryTrend=industry&&S?.company_momentum?.verified===true?row('industryTrend','⑨ 產業／產品／公司動能',S.company_momentum.summary,S.company_momentum.details||('產業代碼 '+industry),S.company_momentum.state||'neutral'):missing('industryTrend','⑨ 產業／產品／公司動能',industry?'已驗證產業代碼 '+industry+'；產品、AI、新客戶與公司展望尚未完成合法 IR／事件資料流，因此不把傳聞補成公司動能':'產業分類未取得');

    return{priceVolume:price,taiwanMarket:market,technical:tech,chips,valuation,revenue,quarterly,financialQuality:financial,industryTrend};
  }

  function scenarios(bars,r){
    if(!bars||bars.length<60)return{available:false,reason:'合法歷史 OHLC 未達 60 根；A／B／C 不以第三方資料、固定百分比或 AI 補出'};
    const round=window.StockLabTaiwan?.roundTick||((x)=>x),cl=num(r.close),c=bars.map(x=>num(x.c)),ma=p=>avg(c.slice(-p)),m5=ma(5),m10=ma(10),m20=ma(20),m60=ma(60),l5=bars.slice(-5).map(x=>num(x.l)),l20=bars.slice(-20).map(x=>num(x.l)),h20=bars.slice(-20).map(x=>num(x.h)),h60=bars.slice(-60).map(x=>num(x.h));
    const tr=[];for(let i=1;i<bars.length;i++){const p=num(bars[i-1].c),h=num(bars[i].h),l=num(bars[i].l);if([p,h,l].every(Number.isFinite))tr.push(Math.max(h-l,Math.abs(h-p),Math.abs(l-p)))}
    const atr=avg(tr.slice(-14)),pull=[];for(let i=Math.max(1,bars.length-40);i<bars.length;i++){const p=num(bars[i-1].c),l=num(bars[i].l);if(p>0&&l>0)pull.push((p-l)/p)}
    const reach80=qtile(pull,.8),near=[m5,m10,qtile(l5,.5)].filter(Number.isFinite),aLo=Math.min(...near),aHi=Math.max(...near),aDist=cl>0?(cl-aHi)/cl:null;
    const A=Number.isFinite(aLo)&&aDist>=0&&(reach80==null||aDist<=reach80)?{low:round(aLo,'up'),high:round(aHi,'down')}:null;
    const deep=[m20,m60,qtile(l20,.25)].filter(Number.isFinite),bLo=Math.min(...deep),bHi=Math.max(...deep),bDist=cl>0?(cl-bHi)/cl:null;
    const B=Number.isFinite(bLo)&&bDist>=0&&(atr==null||cl-bHi<=2*atr)?{low:round(bLo,'up'),high:round(bHi,'down')}:null;
    const breakout=round(Math.max(...h20.filter(Number.isFinite),...h60.filter(Number.isFinite)),'up'),invalid=round(Math.min(...l20.filter(Number.isFinite)),'down');
    return{available:true,A,B,breakout,invalid};
  }
  function scenarioHtml(s){
    if(!s.available)return '<div class=source-note><b>入場情境 A／B／C</b><div class=mini>'+esc(s.reason)+'</div></div>';
    const band=x=>x?money(x.low)+'–'+money(x.high):'不顯示數字';
    return '<h3>把 9+3 轉成有交易意義的入場條件</h3><div class=sourcegrid>'+
      '<div class=sourceitem><b>A｜正常回檔第一觀察</b>'+band(s.A)+'<br><span class=mini>'+(s.A?'近期結構與歷史回檔可達性同時成立；價格未到就不交易':'未通過可達性條件，不顯示假買價')+'</span></div>'+
      '<div class=sourceitem><b>B｜較深回檔第二條件</b>'+band(s.B)+'<br><span class=mini>'+(s.B?'實際回到且 9+3 未惡化才重新評估':'距離／可達性不足，不把深層支撐當目前買價')+'</span></div>'+
      '<div class=sourceitem><b>C｜突破後回測</b>'+money(s.breakout)+'<br><span class=mini>有效突破後不追突破本身；等待壓力轉支撐再重新判斷</span></div>'+
      '<div class=sourceitem><b>原入場邏輯失效參考</b>'+money(s.invalid)+'<br><span class=mini>還要搭配量價、籌碼、市場同步轉弱確認；不是越跌越便宜。</span></div></div>';
  }
  function conclusion(sections,ctx){
    const a=Object.values(sections),ok=a.filter(x=>x.verified).length,cok=ctx.filter(x=>x.verified).length,missing=[...a.filter(x=>!x.verified).map(x=>x.label),...ctx.filter(x=>!x.verified).map(x=>x.label)];
    const pos=a.filter(x=>x.verified&&x.state==='positive').map(x=>x.label),neg=a.filter(x=>x.verified&&x.state==='negative').map(x=>x.label);
    const known='已驗證 '+ok+'/9 主項、'+cok+'/3 外部背景'+(pos.length?'；偏正面：'+pos.join('、'):'')+(neg.length?'；偏負面：'+neg.join('、'):'');
    return '<div class=source-note><b>9+3 分析結論｜'+(ok===9&&cok===3?'資料完整':'目前不做假完整判斷')+'</b><div>'+esc(known)+'</div><div class=mini style="margin-top:6px">'+(missing.length?'缺少：'+esc(missing.join('、'))+'。缺少不是中性，也不以第三方網站、舊值、0、固定百分比或 AI 推測補上。':'資料完整只代表可以進入正式決策層；若 predictive OOS／執行可達性未 PASS，研究區間仍不是保證成交或勝率。')+'</div></div>';
  }
  async function render(code,r,fx,R,H){
    if(!common(code,fx.stock))throw Error('目前 9+3 入場分析只支援可驗證產業別的台灣普通股');
    const sections=makeSections(r,fx,R,H),family=window.StockLabTaiwan?.sectorFamily?.(fx.stock.industry)||'general',ctx=contexts(family),s=scenarios(H.bars,r),title=esc(r.name?(r.name+'／'+code):code);
    box.innerHTML='<div class=toprow><div><h2>'+title+'</h2><div class=muted>'+esc(r.market)+'｜9+3 入場研究｜資料基準 '+esc(r.date)+'</div></div></div>'+
      conclusion(sections,ctx)+
      '<h3>9 項主體分析</h3><div class=sourcegrid>'+Object.values(sections).map(card).join('')+'</div>'+
      '<h3>＋3 外部背景</h3><div class=sourcegrid>'+ctx.map(card).join('')+'</div>'+
      scenarioHtml(s)+
      '<details class=source-note><summary><b>資料來源／完整性</b></summary><div class=mini style="margin-top:8px">價格：OGDL 1.0 已驗證完成交易日 '+esc(r.date)+'。研究資料：'+esc(R.source||'unavailable')+'。歷史技術：'+(H.bars?H.bars.length+' 根合法已驗證 OHLC':'未使用（'+esc(H.reason||MISSING)+'）')+'。上市個股三大法人若授權未確認就維持未取得。任何缺漏都不以第三方網站、0、平均值、舊值或 AI 補齊。</div></details>'+
      '<div class=disclaimer><b>使用方式</b>這一頁用分析師 9+3 把理由攤開，不製造漂亮分數。A／B／C 只有在合法歷史與可達性條件成立時才顯示；未觸價就不交易。沒有合法即時／延遲行情時，也不把完成交易日資料冒充盤中現在價格。</div>';
    box.classList.remove('hidden');
  }
  btn.onclick=async()=>{
    load.classList.remove('hidden');box.classList.remove('hidden');box.innerHTML='';
    try{
      const resolver=window.StockLabTickerResolver;if(!resolver?.resolve)throw Error('股票代號／名稱解析器尚未就緒');
      const code=await resolver.resolve(input.value);input.value=code;
      const r=await latest(code);r.ticker=code;
      const [fx,R,H]=await Promise.all([factors(code,r.market),research(),history(code,r.market)]);
      await render(code,r,fx,R,H);
    }catch(e){box.innerHTML='<h3 class=bad>9+3 分析無法完成</h3><p>'+esc(e.message||e)+'</p><div class=mini>缺少資料維持缺少，不以假資料補值。</div>'}
    finally{load.classList.add('hidden')}
  };
})();