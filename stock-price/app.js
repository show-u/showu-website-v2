const $ = s => document.querySelector(s);
const API = 'https://stock-api-production-9d2c.up.railway.app';

const fmt = n => Number.isFinite(Number(n))
  ? new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(Number(n))
  : '尚未成立';

const band = x => x && Number.isFinite(Number(x.low)) && Number.isFinite(Number(x.high))
  ? `${fmt(x.low)}～${fmt(x.high)}`
  : '尚未成立';

function setText(id,value){
  const el=$(id);
  if(el) el.textContent=value;
}

function render(j){
  const s=j.stock||{};
  const p=j.prices||{};
  const c=j.confidence||{};
  const ind=j.indicators||{};

  setText('#market',`${s.market||''} · ${s.code||''}`);
  setText('#name',s.name||s.code||'');
  setText('#latest',fmt(j.latest));
  setText('#date',`最新已完成交易日 ${s.date||'—'}`);

  const d=$('#decision');
  if(d){
    d.textContent=j.decision||'—';
    d.className='decision '+(
      String(j.decision||'').includes('買入')?'good':
      String(j.decision||'').includes('壓力')?'bad':'wait'
    );
  }

  setText('#confidence',`${c.score ?? '—'} / 100（${c.label||'—'}）`);
  setText('#firstEntry',band(p.firstEntry));
  setText('#secondEntry',band(p.secondEntry));
  setText('#firstExit',band(p.firstExit));
  setText('#secondExit',band(p.secondExit));
  setText('#noChase',Number.isFinite(Number(p.noChase))?fmt(p.noChase):'尚未成立');
  setText('#defense',Number.isFinite(Number(p.defense))?fmt(p.defense):'尚未成立');
  setText('#invalidation',Number.isFinite(Number(p.invalidation))?fmt(p.invalidation):'尚未成立');

  let strategy='等待價格進入第一買入區，再重新確認。';
  if(String(j.decision||'').includes('買入')){
    strategy=`目前接近第一買入區 ${band(p.firstEntry)}，可進一步確認是否分批建立部位。`;
  }else if(String(j.decision||'').includes('壓力')){
    strategy=`現價接近上方壓力，不追價；優先等待 ${band(p.firstEntry)}。`;
  }
  setText('#strategyText',strategy);

  const rc=[
    ['大盤／產業','資料不足','尚未接入，不影響價格結構計算'],
    ['基本面','資料不足','尚未接入'],
    ['估值','資料不足','尚未接入'],
    ['法人籌碼','資料不足','尚未接入'],
    ['美國市場／重大事件','資料不足','尚未接入']
  ];
  const risks=$('#risks');
  if(risks) risks.innerHTML=rc.map(x=>`<div class="riskItem"><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>`).join('');

  const rs=[
    `MA20：${fmt(ind.ma20)}；MA60：${fmt(ind.ma60)}；MA120：${fmt(ind.ma120)}`,
    `ATR14：${fmt(ind.atr14)}，只用於波動容忍與結構邊界`,
    '第一買入區＝現價下方最近有效支撐群；第二買入區＝下一層支撐群',
    '第一賣出區＝現價上方最近有效壓力群；第二停利區若沒有可靠第二壓力就不顯示數字',
    '價格群由均線、20/60/120 日高低點、局部波段高低點與成交量價格節點共同形成，至少兩個依據重疊才成立'
  ];
  const reasons=$('#reasons');
  if(reasons) reasons.innerHTML=rs.map(x=>`<li>${x}</li>`).join('');

  const a=j.audit||{};
  setText('#audit',
    `Price Gate：通過｜合法 OHLC：${a.validOHLC ?? s.bars ?? '—'} 根｜來源：${a.source||'—'}｜線上即時取得｜無資料庫｜缺值不補 0`
  );

  const result=$('#result');
  if(result) result.hidden=false;
}

async function analyze(){
  const q=$('#query')?.value.trim();
  if(!q) return;

  const error=$('#error');
  const result=$('#result');
  const loading=$('#loading');
  const submit=$('#submit');

  if(error) error.hidden=true;
  if(result) result.hidden=true;
  if(loading) loading.classList.add('show');
  if(submit) submit.disabled=true;

  try{
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),120000);
    let r;
    try{
      r=await fetch(`${API}/api/analyze?stock=${encodeURIComponent(q)}`,{
        cache:'no-store',
        signal:ctrl.signal
      });
    }finally{
      clearTimeout(timer);
    }

    let j;
    try{ j=await r.json(); }
    catch{ throw new Error(`分析服務回傳格式錯誤（HTTP ${r.status}）`); }

    if(!r.ok || !j.ok) throw new Error(j.error || `分析失敗（HTTP ${r.status}）`);
    render(j);
  }catch(err){
    if(error){
      error.textContent=err?.name==='AbortError'
        ? '分析逾時，請稍後重試。'
        : (err?.message||String(err));
      error.hidden=false;
    }
  }finally{
    if(loading) loading.classList.remove('show');
    if(submit) submit.disabled=false;
  }
}

$('#form')?.addEventListener('submit',e=>{
  e.preventDefault();
  analyze();
});
