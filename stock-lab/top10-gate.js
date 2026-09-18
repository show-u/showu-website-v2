// Sector research screener.
// Uses only normalized OGDL completed-session facts + official-derived Taiwan industry/risk metadata.
// Deterministic research shortlist; not a predictive TOP10 model.
(function(){
  const btn=document.querySelector('#scanBtn'),box=document.querySelector('#top10'),load=document.querySelector('#scanLoad');
  if(!btn||!box||!load)return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>{const x=Number(String(v??'').replace(/,/g,''));return Number.isFinite(x)?x:null};
  const money=x=>Number.isFinite(Number(x))?Number(x).toLocaleString('zh-TW',{maximumFractionDigits:0}):'—';
  const SECTORS={
    '01':'水泥工業','02':'食品工業','03':'塑膠工業','04':'紡織纖維','05':'電機機械','06':'電器電纜',
    '08':'玻璃陶瓷','09':'造紙工業','10':'鋼鐵工業','11':'橡膠工業','12':'汽車工業','14':'建材營造',
    '15':'航運業','16':'觀光餐旅','17':'金融保險','18':'貿易百貨','19':'綜合','20':'其他',
    '21':'化學工業','22':'生技醫療業','23':'油電燃氣業','24':'半導體業','25':'電腦及週邊設備業',
    '26':'光電業','27':'通信網路業','28':'電子零組件業','29':'電子通路業','30':'資訊服務業',
    '31':'其他電子','35':'綠能環保','36':'數位雲端','37':'運動休閒','38':'居家生活'
  };
  function metric(row){
    const op=n(row.open),hi=n(row.high),lo=n(row.low),cl=n(row.close),tv=n(row.trade_value);
    if(!(op>0&&hi>0&&lo>0&&cl>0))return null;
    const move=(cl/op-1)*100,loc=hi>lo?(cl-lo)/(hi-lo):0.5;
    return{move,loc,tradeValue:tv>0?tv:0};
  }
  function common(code,f){return /^\d{4}$/.test(String(code))&&!String(code).startsWith('00')&&SECTORS[String(f?.industry||'')]}
  async function run(){
    const src=window.StockLabSameOrigin;if(!src?.loadMarketFacts)throw Error('合法市場事實層尚未就緒');
    await window.StockLabTaiwan?.loadFactors?.();
    const facts=await src.loadMarketFacts(),latest=new Map();
    for(const r of facts.rows||[]){
      const code=String(r.ticker||''),old=latest.get(code);
      if(!old||String(r.date)>String(old.date))latest.set(code,r);
    }
    const groups={};
    for(const [code,r] of latest){
      const f=window.StockLabTaiwan?.stockFactor?.(code)||{};
      if(!common(code,f))continue;
      const m=metric(r);if(!m)continue;
      const risk=window.StockLabTaiwan?.riskState?.(code,r.market)||{};
      if(risk.riskBlocked===true||f.attention===true)continue;
      if(!(m.move>0))continue;
      const industry=String(f.industry),x={code,row:r,f,m,risk};
      (groups[industry]||(groups[industry]=[])).push(x);
    }
    for(const a of Object.values(groups))a.sort((x,y)=>y.m.move-x.m.move||y.m.loc-x.m.loc||y.m.tradeValue-x.m.tradeValue);
    return groups;
  }
  function card(x,i){
    const r=x.row,m=x.m,known=x.risk?.verified===true?'風險狀態已完整驗證':'部分風險狀態仍未知';
    return '<div class="item"><div class="rank">#'+(i+1)+'</div><div><b>'+esc(r.name)+'／'+esc(x.code)+'</b>'+
      '<div class="mini">'+esc(r.market)+'｜資料日 '+esc(r.date)+'</div>'+
      '<div style="margin-top:5px">完成交易日表現 <b>'+(m.move>=0?'+':'')+m.move.toFixed(2)+'%</b>｜收盤位置 '+Math.round(m.loc*100)+'%</div>'+
      '<div class="mini" style="margin-top:4px">成交金額 '+money(m.tradeValue)+'｜'+esc(known)+'</div></div></div>';
  }
  btn.onclick=async()=>{
    load.classList.remove('hidden');box.classList.remove('hidden');
    try{
      const groups=await run(),keys=Object.keys(groups).filter(k=>groups[k].length).sort((a,b)=>a.localeCompare(b));
      if(!keys.length)throw Error('目前沒有股票符合「完成交易日上漲＋普通股＋無已知處置／注意旗標」條件');
      const html=keys.map((k,idx)=>{
        const items=groups[k].slice(0,5);
        return '<details class="source-note" '+(idx<3?'open':'')+'><summary><b>'+esc(SECTORS[k]||k)+'</b><span class="status-pill">'+items.length+' 檔</span></summary>'+
          '<div class="list" style="margin-top:10px">'+items.map(card).join('')+'</div></details>';
      }).join('');
      box.innerHTML=
        '<div class="toprow"><div><h2>各類股近期績優研究標的</h2><div class="muted">每一類股最多 5 檔｜免費官方資料版</div></div></div>'+
        '<div class="source-note"><b>目前「近期績優」定義</b><div class="mini">以最新完成交易日為基準：普通股、當日收盤高於開盤，依「漲幅 → 收盤位於日內高低區間的位置 → 成交金額」排序；已知處置／注意股票排除。這是研究候選，不是勝率排名。隨免費官方 archive 累積到 5／10 個交易日後，會升級為多日相對強弱。</div></div>'+
        html+
        '<div class="disclaimer"><b>篩選限制</b>每類股不足 5 檔就只顯示實際合格數。未知風險狀態不會被寫成「沒有風險」；本頁不顯示未校準勝率或預測報酬。</div>';
    }catch(e){
      box.innerHTML='<h3 class="bad">目前無法形成類股候選</h3><p>'+esc(e.message||e)+'</p><div class="mini">缺少資料不補值。</div>';
    }finally{load.classList.add('hidden')}
  };
})();
