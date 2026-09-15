// External market risk display layer. Reads only the repository's verified snapshot.
let EXTERNAL_MARKET=null;
async function loadExternalMarket(){try{const r=await fetch('./market-data.json',{cache:'no-store'});if(!r.ok)throw Error('market-data.json unavailable');EXTERNAL_MARKET=await r.json();return EXTERNAL_MARKET}catch(e){EXTERNAL_MARKET={status:'unavailable',sources:{}};return EXTERNAL_MARKET}}
function marketItem(label,x){if(!x||!x.verified)return `<div class=sourceitem><b>${label}</b>⚠️ 尚未通過每日快照驗證，不計分</div>`;const pct=x.change_pct!=null?`${x.change_pct>0?'+':''}${Number(x.change_pct).toFixed(2)}%`:'—';return `<div class=sourceitem><b>${label}</b>${x.value!=null?fmt(x.value):'—'}｜${pct}<br><span class=mini>${x.date||'—'}｜${x.source}</span></div>`}
const _showMarketBase=showMarket;
showMarket=function(m){_showMarketBase(m);const box=document.createElement('div');box.innerHTML=`<h3>外部市場風險｜觀察層</h3><div class=sourcegrid>${marketItem('SOX 費城半導體',EXTERNAL_MARKET?.sources?.sox)}${marketItem('NASDAQ Composite',EXTERNAL_MARKET?.sources?.nasdaq)}${marketItem('VIX',EXTERNAL_MARKET?.sources?.vix)}</div><p class=muted>外部市場目前只顯示、不改變個股或 TOP 10 分數。只有來源、日期與解析全部驗證通過的快照才顯示數值。</p>`;$('#marketBody').appendChild(box)};
loadExternalMarket();
