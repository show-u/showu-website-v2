// Taiwan-specific model layer: adaptive price bands, sector-aware fundamentals/valuation, and Taiwan risk factors.
(function(){
  const FACTOR_URL='./taiwan-factors.json';
  let FACTORS={generated_at:null,stocks:{},market:{}};
  let factorPromise=null;
  const _extrasTW=extras,_combineTW=combine,_renderTW=render,_techTW=tech;
  function num(v){const x=Number(v);return Number.isFinite(x)?x:null}
  function quantile(a,q){const v=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!v.length)return null;const p=(v.length-1)*q,l=Math.floor(p),h=Math.ceil(p);return l===h?v[l]:v[l]+(v[h]-v[l])*(p-l)}
  function atr(r,p=14){if(!r||r.length<=p)return null;const t=[];for(let i=r.length-p;i<r.length;i++){const x=r[i],pc=r[i-1].c;t.push(Math.max(x.h-x.l,Math.abs(x.h-pc),Math.abs(x.l-pc)))}return avg(t)}
  function sectorFamily(industry){const s=String(industry||'');if(/金融|銀行|保險|證券|金控/.test(s))return'financial';if(/半導體/.test(s))return'semiconductor';if(/電子|電腦|通信|光電|電子零組件|資訊服務|其他電子/.test(s))return'electronics';if(/航運/.test(s))return'shipping';if(/生技|醫療/.test(s))return'biotech';if(/營建|建材/.test(s))return'construction';return'general'}
  function tickSize(p){if(p<10)return .01;if(p<50)return .05;if(p<100)return .1;if(p<500)return .5;if(p<1000)return 1;return 5}
  function roundTick(p,mode='nearest'){const t=tickSize(Math.max(.01,p)),q=p/t,z=mode==='up'?Math.ceil(q):mode==='down'?Math.floor(q):Math.round(q);return +(z*t).toFixed(t<.1?2:t<1?1:0)}
  function adaptiveBand(r,h){
    if(!r?.length)throw Error('價格模型缺少歷史資料');
    const L=r.at(-1),look=h==='1m'?20:h==='3m'?60:Math.min(240,r.length),maP=h==='1m'?20:h==='3m'?60:Math.min(120,r.length),cl=r.map(x=>x.c),m=avg(cl.slice(-maP)),a=atr(r,14),w=r.slice(-look);
    if(!m||!a||w.length<15)throw Error('自適應價格模型資料不足');
    const qLow=quantile(w.map(x=>x.l),.20),qHigh=quantile(w.map(x=>x.h),.80),recentLow=Math.min(...w.slice(-Math.min(10,w.length)).map(x=>x.l));
    const support=Math.max(Math.min(m,L.c),Math.max(qLow,recentLow-a*.6));
    const resistance=Math.max(L.c,qHigh);
    const mult=h==='1m'?.45:h==='3m'?.70:1.0;
    let lo=Math.max(qLow,support-a*mult),hi=Math.min(L.c,support+a*(h==='1m'?.25:h==='3m'?.35:.5));
    if(lo>hi){lo=Math.min(support,L.c);hi=Math.max(lo,Math.min(L.c,support+a*.2));}
    return{entryLow:roundTick(lo,'up'),entryHigh:roundTick(hi,'down'),support:roundTick(support,'nearest'),resist:roundTick(resistance,'nearest'),atr:a};
  }
  async function loadFactors(force=false){if(factorPromise&&!force)return factorPromise;factorPromise=fetch(FACTOR_URL,{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('台股衍生因子尚未產生');const x=await r.json();if(x.schema_version!==1)throw Error('台股衍生因子版本不符');FACTORS=x;return x}).catch(e=>{FACTORS={generated_at:null,stocks:{},market:{},error:String(e.message||e)};return FACTORS});return factorPromise}
  function stockFactor(code){return FACTORS.stocks?.[String(code)]||{}}
  function sectorValuationDelta(code,v){const f=stockFactor(code),fam=sectorFamily(f.industry),pe=num(v?.pe),pb=num(v?.pb),dy=num(v?.yield);let d=0;
    if(fam==='financial'){if(pb!=null){if(pb<=1.2)d+=3;else if(pb>=2.2)d-=3}if(pe!=null&&pe>0){if(pe<=15)d+=2;else if(pe>=28)d-=2}if(dy!=null&&dy>=4)d+=2;}
    else if(fam==='shipping'){if(pe!=null&&pe>0&&pe<=12)d+=2;if(pe!=null&&pe>=30)d-=2;if(pb!=null&&pb<=1.5)d+=1;}
    else if(fam==='semiconductor'||fam==='electronics'){if(pe!=null&&pe>0){if(pe<=25)d+=2;else if(pe>=55)d-=2}if(pb!=null&&pb>=8)d-=1;}
    else if(fam==='biotech'){if(pb!=null&&pb>=10)d-=2;if(dy!=null&&dy>=2)d+=1;}
    else {if(pe!=null&&pe>0){if(pe<=20)d+=2;else if(pe>=45)d-=2}if(pb!=null&&pb<=2)d+=1;if(dy!=null&&dy>=3)d+=1;}
    return Math.max(-4,Math.min(4,d));
  }
  financialScore=function(q,h){if(!q||h==='day')return 0;const fam=sectorFamily(stockFactor(q.code).industry),eps=num(q.eps),gm=num(q.grossMargin),om=num(q.opMargin),debt=num(q.debtRatio),cr=num(q.currentRatio);let d=0;
    if(fam==='financial'){if(eps!=null)d+=eps>0?3:-4;return Math.max(-8,Math.min(8,d));}
    if(eps!=null)d+=eps>0?(h==='long'?3:2):(h==='long'?-4:-3);
    if(fam==='semiconductor'||fam==='electronics'){if(gm!=null){if(gm>=30)d+=2;else if(gm<10)d-=2}if(om!=null){if(om>=12)d+=2;else if(om<0)d-=3}}
    else if(fam==='shipping'){if(om!=null){if(om>=10)d+=2;else if(om<0)d-=3}}
    else if(fam==='biotech'){if(gm!=null&&gm>=40)d+=2;if(om!=null&&om<0)d-=1;}
    else {if(gm!=null&&gm>=20)d+=1;if(om!=null){if(om>=8)d+=2;else if(om<0)d-=3}}
    if(debt!=null){if(fam==='construction'){if(debt>=85)d-=3}else{if(debt<=50)d+=1;else if(debt>=75)d-=3}}
    if(cr!=null&&fam!=='financial'){if(cr>=1.2)d+=1;else if(cr<.8)d-=2}
    return Math.max(-8,Math.min(8,d));
  };
  tech=function(r,h){const a=_techTW(r,h);if(h==='day')return a;const b=adaptiveBand(r,h);a.entryLow=b.entryLow;a.entryHigh=b.entryHigh;a.support=b.support;a.resist=b.resist;a.atr=b.atr;a.priceModel='TW-adaptive-v2';return a};
  extras=async function(date){const x=await _extrasTW(date);await loadFactors();return x};
  combine=function(a,h,m,v,i,r){a=_combineTW(a,h,m,v,i,r);const code=v?.code||r?.code||i?.code||a.fin?.code||null,f=code?stockFactor(code):{};
    // Remove the legacy long-horizon fixed PE adjustment from the old core before applying sector-aware valuation.
    if(h==='long'&&v?.pe){if(v.pe<=35)a.score-=3;else if(v.pe>=70)a.score+=4;}
    const vd=code?sectorValuationDelta(code,v):0;a.sectorValuationDelta=vd;a.score=Math.max(0,Math.min(100,a.score+vd));a.industry=f.industry||null;a.sectorFamily=sectorFamily(a.industry);
    let riskDelta=0;const risk=[];
    if(f.disposition){riskDelta-=30;risk.push('處置股票');a.riskBlocked=true;}
    else if(f.attention){riskDelta-=8;risk.push('注意股票');}
    if(num(f.margin_change_pct)!=null&&f.margin_change_pct>=12){riskDelta-=3;risk.push('融資餘額快速增加');}
    if(num(f.margin_change_pct)!=null&&f.margin_change_pct<=-10){riskDelta+=1;risk.push('融資餘額下降');}
    if(f.margin_suspended){riskDelta-=6;risk.push('信用交易受限');}
    a.taiwanRisk={...f,delta:riskDelta,flags:risk};a.score=Math.max(0,Math.min(100,a.score+riskDelta));
    if(a.riskBlocked){a.action='處置股｜不納入一般推薦或開盤前掛單';if(a.integrity?.price)a.integrity.price.ok=false;}
    else a.action=a.score>=75?'偏多｜等拉回可分批':a.score>=60?'觀察｜不追價':a.score>=45?'中性｜等待確認':'偏弱｜暫避';
    return a};
  render=function(code,a,h,vf){_renderTW(code,a,h,vf);if(!vf.complete)return;const box=document.querySelector('#result');if(!box)return;const f=a.taiwanRisk||{};const p=document.createElement('div');p.innerHTML=`<h3>台股專用因子</h3><div class=sourcegrid><div class=sourceitem><b>產業</b>${a.industry||'未取得'}｜${a.sectorFamily||'general'}</div><div class=sourceitem><b>產業估值調整</b>${a.sectorValuationDelta>0?'+':''}${a.sectorValuationDelta||0}</div><div class=sourceitem><b>融資餘額變化</b>${f.margin_change_pct!=null?Number(f.margin_change_pct).toFixed(1)+'%':'未取得'}</div><div class=sourceitem><b>注意／處置</b>${f.disposition?'⛔ 處置':f.attention?'⚠️ 注意':'✅ 無旗標'}</div><div class=sourceitem><b>OTC 市場環境</b>${FACTORS.market?.otc_state||'未取得'}</div><div class=sourceitem><b>價格模型</b>${a.priceModel||'TW-adaptive-v2'}</div></div>`;box.appendChild(p);const bubble=box.querySelector('.bubble');if(bubble)bubble.textContent=a.score;};
  window.StockLabTaiwan={loadFactors,adaptiveBand,sectorFamily,stockFactor,roundTick,get factors(){return FACTORS}};
})();
