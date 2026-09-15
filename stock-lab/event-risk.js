// International event policy. No event feed => unknown, never "no event".
const EVENT_POLICY={
 A:{label:'A｜已驗證重大事件',rule:'政府／監管機關正式文件、已生效規則、公司正式重大公告或財報。'},
 B:{label:'B｜高度可信',rule:'公司 IR，或兩個彼此獨立的高品質媒體對同一事件相互印證。'},
 C:{label:'C｜暫定觀察',rule:'單一可信媒體報導；必須標示發布日與事件日，只能觀察，不得冒充已驗證事實。'},
 D:{label:'D｜排除',rule:'社群、論壇、匿名消息、未交叉驗證傳聞或單純評論。'}
};
let EVENT_SNAPSHOT=null;
function eventContext(){
 if(!EVENT_SNAPSHOT||EVENT_SNAPSHOT.verified!==true)return{verified:false,state:'unknown',reason:'國際時事自動資料流尚未完成合法來源、日期與交叉驗證；未知不能寫成「無事件」',provenance:'unavailable'};
 const items=Array.isArray(EVENT_SNAPSHOT.items)?EVENT_SNAPSHOT.items:[];
 if(!items.length)return{verified:true,state:'neutral',reason:'已驗證事件資料流本期沒有符合 A/B 等級的重大事件',items:[],provenance:'observed'};
 const adverse=items.some(x=>x.impact==='adverse'&&['A','B'].includes(x.level)),supportive=items.some(x=>x.impact==='supportive'&&['A','B'].includes(x.level));
 return{verified:true,state:adverse&&!supportive?'adverse':supportive&&!adverse?'supportive':'mixed',reason:`已驗證事件 ${items.length} 筆`,items,provenance:'derived'};
}
function eventPolicyPanel(){const c=eventContext();return `<h3>國際時事</h3><div class=sourcegrid>${Object.values(EVENT_POLICY).map(x=>`<div class=sourceitem><b>${x.label}</b><span class=mini>${x.rule}</span></div>`).join('')}</div><div class=sourceitem style="margin-top:8px"><b>${c.verified?'✅ 事件資料已驗證':'⚠️ 事件資料未取得／未通過驗證'}</b><span class=mini>${c.reason}</span></div><div class=mini style="margin-top:8px">完整入場判斷必須知道國際事件資料狀態。未接入時直接阻擋完整結論，不以 AI、新聞標題、社群或「看起來沒事」補值。</div>`}
const _eventShowMarket=showMarket;
showMarket=function(m){_eventShowMarket(m);const target=document.querySelector('#marketDetailsBody');if(!target)return;let box=target.querySelector('[data-event-policy]');if(!box){box=document.createElement('div');box.dataset.eventPolicy='1';target.appendChild(box)}box.innerHTML=eventPolicyPanel()};
window.StockLabEvents={context:eventContext,setVerifiedSnapshot(x){EVENT_SNAPSHOT=x},policy:EVENT_POLICY};
