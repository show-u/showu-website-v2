// StockLab shared deterministic primitives. No network-history collection and no horizon-specific buy model.
const $=s=>document.querySelector(s),OA='https://openapi.twse.com.tw';
// Only datasets explicitly registered in the licensed same-origin adapter may be read.
const U={snap:`${OA}/v1/exchangeReport/STOCK_DAY_ALL`,val:`${OA}/v1/exchangeReport/BWIBBU_ALL`,rev:`${OA}/v1/opendata/t187ap05_L`};
const n=v=>{if(v==null)return null;const s=String(v).trim();if(!s||['-','--','—','N/A','NA','null','undefined'].includes(s))return null;const x=Number(s.replace(/,/g,'').replace(/%$/,''));return Number.isFinite(x)?x:null};
const avg=a=>{const v=(a||[]).filter(Number.isFinite);return v.length?v.reduce((x,y)=>x+y,0)/v.length:null};
const fmt=x=>x==null?'—':Number(x).toLocaleString('zh-TW',{maximumFractionDigits:2});
function old(iso){return iso?Math.floor((Date.now()-new Date(`${iso}T00:00:00+08:00`))/864e5):999}
// same-origin-cache.js replaces this with the licensed OGDL adapter. Direct remote fallback is forbidden.
async function jget(){throw Error('合法同網域資料介面尚未初始化；禁止直接改抓交易所網站補值')}
function historyIntegrity(r,minimumBars=60){
  const need=Math.max(60,Number(minimumBars)||60);
  if(!Array.isArray(r)||r.length<need)return{ok:false,reason:`有效日線不足：${r?.length||0}/${need}`,need,count:r?.length||0};
  const L=r.at(-1);if(!L?.iso||old(L.iso)>4)return{ok:false,reason:'最新交易日過舊',need,count:r.length};
  for(const x of r){if(!x?.iso||![x.o,x.h,x.l,x.c].every(v=>Number.isFinite(Number(v))&&Number(v)>0))return{ok:false,reason:'歷史日線存在缺值或格式異常',need,count:r.length}}
  for(let i=1;i<r.length;i++)if(String(r[i].iso)<=String(r[i-1].iso))return{ok:false,reason:'歷史交易日未嚴格遞增',need,count:r.length};
  return{ok:true,reason:'合法歷史日線基本完整性通過',need,count:r.length};
}
const ma=(r,k)=>avg(r.slice(-k).map(x=>Number(x.c)));
function ema(v,p){if(v.length<p)return[];const k=2/(p+1),o=[];let q=avg(v.slice(0,p));for(let i=0;i<v.length;i++){if(i<p-1)o.push(null);else if(i===p-1)o.push(q);else{q=v[i]*k+q*(1-k);o.push(q)}}return o}
function macd(r){const c=r.map(x=>Number(x.c)),a=ema(c,12),b=ema(c,26),d=c.map((_,i)=>a[i]!=null&&b[i]!=null?a[i]-b[i]:null),valid=d.filter(x=>x!=null),e=ema(valid,9);let j=0;const s=d.map(x=>x==null?null:e[j++]),h=d.map((x,i)=>x!=null&&s[i]!=null?x-s[i]:null);return{dif:d.at(-1),sig:s.at(-1),hist:h.at(-1)}}
// Wilder RSI14 is the only RSI implementation; the old override layer was removed.
function rsi(r,p=14){if(!Array.isArray(r)||r.length<=p)return null;let gain=0,loss=0;for(let i=1;i<=p;i++){const d=Number(r[i].c)-Number(r[i-1].c);if(d>0)gain+=d;else loss-=d}let avgGain=gain/p,avgLoss=loss/p;for(let i=p+1;i<r.length;i++){const d=Number(r[i].c)-Number(r[i-1].c),g=d>0?d:0,l=d<0?-d:0;avgGain=(avgGain*(p-1)+g)/p;avgLoss=(avgLoss*(p-1)+l)/p}if(avgLoss===0)return avgGain===0?50:100;return 100-(100/(1+avgGain/avgLoss))}
function kd(r,p=9){if(r.length<p+2)return{k:null,d:null};let K=50,D=50,pk=50,pd=50;for(let i=p-1;i<r.length;i++){const w=r.slice(i-p+1,i+1),lo=Math.min(...w.map(x=>Number(x.l))),hi=Math.max(...w.map(x=>Number(x.h))),v=hi===lo?50:(Number(r[i].c)-lo)/(hi-lo)*100;pk=K;pd=D;K=K*2/3+v/3;D=D*2/3+K/3}return{k:K,d:D,pk,pd}}
function candle(r){const a=r.at(-1),b=r.at(-2);if(!a||!b)return null;const body=Math.abs(a.c-a.o),rg=Math.max(.001,a.h-a.l),up=a.h-Math.max(a.o,a.c),lo=Math.min(a.o,a.c)-a.l;if(a.c>b.o&&a.o<b.c&&b.c<b.o)return'多方吞噬';if(a.c<b.o&&a.o>b.c&&b.c>b.o)return'空方吞噬';if(lo>body*2&&up<body)return'錘子線';if(up>body*2&&lo<body)return'長上影';if(body/rg<.12)return'十字線';if(a.c>a.o&&body/rg>.65)return'長紅K';if(a.c<a.o&&body/rg>.65)return'長黑K';return'一般K線'}
function tech(r){
  const hg=historyIntegrity(r,60);if(!hg.ok)throw Error(hg.reason);
  const L=r.at(-1),P=r.at(-2),m5=ma(r,5),m10=ma(r,10),m20=ma(r,20),m60=ma(r,60),m240=r.length>=240?ma(r,240):null,v20=avg(r.slice(-20).map(x=>Number(x.v)).filter(x=>Number.isFinite(x)&&x>0)),vr=Number.isFinite(Number(L.v))&&v20?Number(L.v)/v20:null,w20=r.slice(-20),hi=Math.max(...w20.map(x=>Number(x.h))),lo=Math.min(...w20.map(x=>Number(x.l)));
  return{last:L,previous:P,m5,m10,m20,m60,m240,vr,macd:macd(r),rsi:rsi(r),kd:kd(r),candle:candle(r),support:lo,resist:hi,historyIntegrity:hg,provenance:'derived_from_licensed_history'};
}
async function verify(code,r){
  const hg=historyIntegrity(r,60),s=await jget(U.snap),x=s.find(z=>String(z.Code)===String(code)),L=r.at(-1),c=x?n(x.ClosingPrice):null,match=Number.isFinite(c)&&Number.isFinite(Number(L?.c))&&Math.abs(c-Number(L.c))<.001,fresh=!!L?.iso&&old(L.iso)<=4;
  return{fresh,match,history:hg,complete:fresh&&match&&hg.ok,date:L?.iso||null,text:x&&L?`${fmt(L.c)} / ${fmt(c)}｜${hg.reason}`:'找不到代號',provenance:'observed_cross_check'};
}
// External market modules use this hook only to render verified observation panels.
function showMarket(m){const body=$('#marketBody');if(!body)return;if(!m){body.textContent='市場預測尚未通過驗證。';return}body.innerHTML=`<div class=mini>市場背景僅顯示已驗證觀測；不以未驗證分數替代資料。</div>`}
window.StockLabFormulaVersion={rsi:'Wilder RSI 14 v2'};
