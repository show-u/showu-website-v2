const $=s=>document.querySelector(s);
const fmt=n=>Number.isFinite(n)?new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(n):'尚未成立';
const num=v=>{const x=Number(String(v??'').replaceAll(',','').replace('X',''));return Number.isFinite(x)?x:null};
const ymd=d=>`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}01`;
function addMonths(d,m){const x=new Date(d);x.setDate(1);x.setMonth(x.getMonth()+m);return x}
function rocToIso(s){const m=String(s||'').match(/^(\d{3})\/(\d{2})\/(\d{2})$/);return m?`${Number(m[1])+1911}-${m[2]}-${m[3]}`:String(s||'')}
function mean(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:null}
function ma(b,k){return b.length>=k?mean(b.slice(-k).map(x=>x.c)):null}
function atr(b,k=14){if(b.length<k+1)return null;const t=[];for(let i=1;i<b.length;i++){const x=b[i],p=b[i-1];t.push(Math.max(x.h-x.l,Math.abs(x.h-p.c),Math.abs(x.l-p.c)))}return mean(t.slice(-k))}
function minLow(b,k){const a=b.slice(-Math.min(k,b.length));return a.length?Math.min(...a.map(x=>x.l)):null}
function maxHigh(b,k){const a=b.slice(-Math.min(k,b.length));return a.length?Math.max(...a.map(x=>x.h)):null}
function swings(b,side){const out=[];for(let i=2;i<b.length-2;i++){const x=b[i];if(side==='low'&&x.l<=b[i-1].l&&x.l<=b[i-2].l&&x.l<=b[i+1].l&&x.l<=b[i+2].l)out.push(x.l);if(side==='high'&&x.h>=b[i-1].h&&x.h>=b[i-2].h&&x.h>=b[i+1].h&&x.h>=b[i+2].h)out.push(x.h)}return out.slice(-12)}
function volumeNodes(b){const a=b.slice(-Math.min(120,b.length));if(!a.length)return[];const lo=Math.min(...a.map(x=>x.l)),hi=Math.max(...a.map(x=>x.h));if(!(hi>lo))return[];const bins=24,step=(hi-lo)/bins,vol=Array(bins).fill(0);for(const x of a){const tp=(x.h+x.l+x.c)/3,i=Math.max(0,Math.min(bins-1,Math.floor((tp-lo)/step)));vol[i]+=x.v||0}return vol.map((v,i)=>({p:lo+(i+.5)*step,v})).sort((a,b)=>b.v-a.v).slice(0,4).map(x=>x.p)}
function cluster(levels,tol){const xs=levels.filter(Number.isFinite).sort((a,b)=>a-b),out=[];for(const p of xs){const last=out.at(-1);if(!last||p-last.max>tol)out.push({vals:[p],min:p,max:p});else{last.vals.push(p);last.min=Math.min(last.min,p);last.max=Math.max(last.max,p)}}return out.map(c=>({min:c.min,max:c.max,mid:mean(c.vals),count:c.vals.length})).filter(c=>c.count>=2)}
function band(c,a){if(!c)return null;const pad=Math.max((a||0)*.12,c.mid*.0015);return `${fmt(Math.max(.01,c.min-pad))}～${fmt(c.max+pad)}`}
function engine(b){const close=b.at(-1).c,a=atr(b),tol=Math.max((a||close*.02)*.7,close*.008),mas=[ma(b,20),ma(b,60),ma(b,120)],nodes=volumeNodes(b);
 const supports=cluster([...mas,minLow(b,20),minLow(b,60),minLow(b,120),...swings(b,'low'),...nodes].filter(x=>x&&x<=close*1.01),tol).filter(c=>c.mid<=close*1.005).sort((x,y)=>y.mid-x.mid);
 const resist=cluster([maxHigh(b,20),maxHigh(b,60),maxHigh(b,120),...swings(b,'high'),...nodes].filter(x=>x&&x>=close*.995),tol).filter(c=>c.mid>=close*.995).sort((x,y)=>x.mid-y.mid);
 const s1=supports[0],s2=supports[1],r1=resist[0],r2=resist[1],def=s1?Math.max(.01,s1.min-(a||0)*.35):null,inv=s2?Math.max(.01,s2.min-(a||0)*.45):(s1?Math.max(.01,s1.min-(a||0)*1.1):null);
 const decision=s1&&close<=s1.max+tol*.25?'接近買入區':r1&&close>=r1.min-tol*.2?'接近壓力，不追價':'等待回檔';
 const hist=Math.min(25,10+Math.max(0,b.length-60)/60*15);
 const ev=Math.min(35,((s1?.count||0)+(r1?.count||0))*8.75);
 const tightOne=c=>!c||!a?0:Math.max(0,1-Math.min(1,(c.max-c.min)/(a*1.5)));
 const tight=25*((tightOne(s1)+tightOne(r1))/2);
 const volPct=a&&close?a/close:null;
 const vol=volPct==null?0:volPct<=.02?15:volPct<=.035?12:volPct<=.05?8:4;
 const confidence=Math.round(Math.max(0,Math.min(100,hist+ev+tight+vol)));
 const confidenceLabel=confidence>=80?'高':confidence>=65?'中高':confidence>=50?'中':'低';
 return{close,a,ma20:ma(b,20),ma60:ma(b,60),ma120:ma(b,120),decision,confidence,confidenceLabel,prices:{firstEntry:band(s1,a),secondEntry:band(s2,a),noChase:r1?fmt(r1.min):null,firstExit:band(r1,a),secondExit:band(r2,a),defense:def?fmt(def):null,invalidation:inv?fmt(inv):null}}}
async function get(url){
  try{
    const r=await fetch(url,{cache:'no-store'});
    if(!r.ok) throw Error('HTTP '+r.status);
    return await r.json();
  }catch(e){
    throw Error('無法取得 TWSE 官方資料，請稍後再試');
  }
}
async function resolve(q){
  const s=String(q).trim();
  if(/^\d{4,6}$/.test(s)) return {code:s,name:s,market:'TWSE'};
  const list=await get('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL');
  const row=list.find(x=>String(x.Name||'').includes(s));
  if(!row) throw Error('找不到此上市股票，請改輸入股票代號，例如 2330');
  return {code:String(row.Code),name:String(row.Name||row.Code),market:'TWSE'};
}
async function history(code){
  const now=new Date(),rows=[];
  let stockName=code;
  for(let i=0;i<8;i++){
    const d=addMonths(now,-i);
    const url=`https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?response=json&date=${ymd(d)}&stockNo=${encodeURIComponent(code)}`;
    const j=await get(url);
    if(j?.stat && !String(j.stat).includes('OK') && !(j.data||[]).length) throw Error('TWSE 暫時無法提供這個月份的資料');
    const title=String(j.title||'');
    const m=title.match(/\b\d{4,6}\s+([^\s]+)\s+各日成交資訊/);
    if(m?.[1]) stockName=m[1];
    for(const r of (j.data||[])){
      const o=num(r[3]),h=num(r[4]),l=num(r[5]),c=num(r[6]),v=num(r[1]);
      if([o,h,l,c].every(Number.isFinite)&&h>=Math.max(o,l,c)&&l<=Math.min(o,h,c))
        rows.push({date:rocToIso(r[0]),o,h,l,c,v:Number.isFinite(v)?v:null});
    }
    await new Promise(res=>setTimeout(res,180));
  }
  const m=new Map(rows.map(x=>[x.date,x]));
  const out=[...m.values()].sort((a,b)=>a.date.localeCompare(b.date));
  if(out.length<60) throw Error(`有效 OHLC 不足：${out.length}/60 根`);
  return {bars:out.slice(-180),stockName};
}
function render(s,b,e){
  $('#market').textContent=`${s.market} · ${s.code}`;
  $('#name').textContent=s.name;
  $('#latest').textContent=fmt(e.close);
  $('#date').textContent=`最新已完成交易日 ${b.at(-1).date}`;

  const d=$('#decision');
  d.textContent=e.decision;
  d.className='decision '+(e.decision.includes('買入')?'good':e.decision.includes('壓力')?'bad':'wait');

  const p=e.prices;
  $('#confidence').textContent=`${e.confidence} / 100（${e.confidenceLabel}）`;
  $('#firstEntry').textContent=p.firstEntry||'尚未成立';
  $('#secondEntry').textContent=p.secondEntry||'尚未成立';
  $('#firstExit').textContent=p.firstExit||'尚未成立';
  $('#secondExit').textContent=p.secondExit||'尚未成立';
  $('#noChase').textContent=p.noChase||'尚未成立';
  $('#defense').textContent=p.defense||'尚未成立';
  $('#invalidation').textContent=p.invalidation||'尚未成立';

  let strategy='等待價格進入第一買入區，再重新確認。';
  if(e.decision.includes('買入')) strategy=`目前接近第一買入區 ${p.firstEntry||''}，可進一步確認是否分批建立部位。`;
  else if(e.decision.includes('壓力')) strategy=`現價接近上方壓力，不追價；優先等待 ${p.firstEntry||'第一買入區'}。`;
  $('#strategyText').textContent=strategy;

  const rc=[
    ['大盤／產業','資料不足','第一版尚未接入，不阻擋價格結構'],
    ['基本面','資料不足','第一版尚未接入'],
    ['估值','資料不足','第一版尚未接入'],
    ['法人籌碼','資料不足','第一版尚未接入'],
    ['美國市場／重大事件','資料不足','第一版尚未接入']
  ];
  $('#risks').innerHTML=rc.map(x=>`<div class="riskItem"><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>`).join('');

  const rs=[
    `MA20：${fmt(e.ma20)}；MA60：${fmt(e.ma60)}；MA120：${fmt(e.ma120)}`,
    `ATR14：${fmt(e.a)}，只用於波動容忍與結構邊界`,
    '第一買入區＝現價下方最近有效支撐群；第二買入區＝下一層支撐群',
    '第一賣出區＝現價上方最近有效壓力群；第二停利區若沒有可靠第二壓力就不顯示數字',
    '價格群由均線、20/60/120 日高低點、局部波段高低點與成交量價格節點共同形成，至少兩個依據重疊才成立'
  ];
  $('#reasons').innerHTML=rs.map(x=>`<li>${x}</li>`).join('');
  $('#audit').textContent=`Price Gate：通過｜合法 OHLC：${b.length} 根｜來源：TWSE STOCK_DAY／STOCK_DAY_ALL｜缺值不補 0`;
  $('#result').hidden=false;
}
async function analyze(){const q=$('#query').value.trim();if(!q)return;$('#error').hidden=true;$('#result').hidden=true;$('#loading').classList.add('show');$('#submit').disabled=true;try{
  const s=await resolve(q);
  const h=await history(s.code);
  if(s.name===s.code && h.stockName) s.name=h.stockName;
  const b=h.bars,e=engine(b);
  render(s,b,e)
}catch(err){$('#error').textContent=err.message||String(err);$('#error').hidden=false}finally{$('#loading').classList.remove('show');$('#submit').disabled=false}}
$('#form').addEventListener('submit',e=>{e.preventDefault();analyze()});document.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>{$('#query').value=b.dataset.q;analyze()}));