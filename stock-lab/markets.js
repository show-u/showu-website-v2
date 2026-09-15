// External market risk observation layer. Verified sources only; never changes stock scores here.
let EXTERNAL_MARKET=null;
function extDate(s){if(!s)return null;let d;if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)){let [m,day,y]=s.split('/').map(Number);d=new Date(Date.UTC(y,m-1,day));}else d=new Date(s);return Number.isNaN(d?.getTime())?null:d}
function ageDays(s){const d=extDate(s);return d?Math.floor((Date.now()-d.getTime())/86400000):999}
function verifiedExternal(x,key){
 if(!x||x.verified!==true)return{ok:false,why:'來源尚未驗證'};
 const expected={vix:['CBOE','cdn.cboe.com'],sox:['Nasdaq','indexes.nasdaq.com'],nasdaq:['Nasdaq','indexes.nasdaq.com']}[key];
 if(!expected)return{ok:false,why:'未知資料類型'};
 let host='';try{host=new URL(x.final_url||x.url).hostname}catch{}
 if(x.source!==expected[0]||host!==expected[1])return{ok:false,why:'來源主機不符白名單'};
 const checks=Array.isArray(x.validation)?x.validation:[];
 if(!checks.includes('official_host')||!checks.includes('content_type_ok'))return{ok:false,why:'來源／格式驗證不完整'};
 if(!checks.includes('date_not_future'))return{ok:false,why:'日期驗證未通過'};
 if(!x.raw_sha256||!/^[a-f0-9]{64}$/i.test(x.raw_sha256))return{ok:false,why:'缺少原始內容雜湊'};
 if(!Number.isFinite(Number(x.value))||Number(x.value)<=0)return{ok:false,why:'數值格式異常'};
 if(ageDays(x.date)>5)return{ok:false,why:'資料日期過舊'};
 if(Array.isArray(x.anomalies)&&x.anomalies.some(a=>/^fatal_/i.test(a)))return{ok:false,why:'偵測到重大異常'};
 return{ok:true,why:'verified'};
}
async function loadExternalMarket(){try{const r=await fetch('./market-data.json',{cache:'no-store'});if(!r.ok)throw Error('market-data.json unavailable');const x=await r.json();if(x.schema_version!==3)throw Error('snapshot schema invalid');if(!x.generated_at||ageDays(x.generated_at)>5)throw Error('snapshot stale');EXTERNAL_MARKET=x;return x}catch(e){EXTERNAL_MARKET={status:'unavailable',sources:{},error:String(e.message||e)};return EXTERNAL_MARKET}}
function marketItem(label,key,x){const v=verifiedExternal(x,key);if(!v.ok)return `<div class=sourceitem><b>⚠️ ${label}</b><span class=mini>${v.why}；略過、不補值</span></div>`;const pct=x.change_pct!=null?`${x.change_pct>0?'+':''}${Number(x.change_pct).toFixed(2)}%`:'—';return `<div class=sourceitem><b>${label}</b>${fmt(x.value)}｜${pct}<br><span class=mini>${x.date}｜${x.source}</span></div>`}
const _showMarketBase=showMarket;
showMarket=function(m){
 _showMarketBase(m);
 const target=document.querySelector('#marketDetailsBody');if(!target)return;
 let box=target.querySelector('[data-external-market]');if(!box){box=document.createElement('div');box.dataset.externalMarket='1';target.appendChild(box)}
 box.innerHTML=`<h3>國際市場觀察</h3><div class=sourcegrid>${marketItem('SOX 費城半導體','sox',EXTERNAL_MARKET?.sources?.sox)}${marketItem('NASDAQ','nasdaq',EXTERNAL_MARKET?.sources?.nasdaq)}${marketItem('VIX','vix',EXTERNAL_MARKET?.sources?.vix)}</div><div class=mini style="margin-top:8px">只作背景觀察；未通過驗證時直接略過，不改變個股或選股分數。</div>`;
};
loadExternalMarket();
