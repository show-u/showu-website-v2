// International event risk policy display. Observation only; no headline can change scores.
const EVENT_POLICY={
 A:{label:'A｜已驗證重大事件',rule:'政府／監管機關正式文件、已生效規則、公司正式重大公告或財報。'},
 B:{label:'B｜高度可信',rule:'公司 IR，或兩個彼此獨立的高品質媒體對同一事件相互印證。'},
 C:{label:'C｜暫定觀察',rule:'單一可信媒體報導；必須標示 publication date 與 event date，不得進分數。'},
 D:{label:'D｜排除',rule:'社群、論壇、匿名消息、未交叉驗證傳聞或單純評論；不得進核心分析。'}
};
function eventPolicyPanel(){return `<h3>國際事件風險｜規則層</h3><div class=sourcegrid>${Object.values(EVENT_POLICY).map(x=>`<div class=sourceitem><b>${x.label}</b>${x.rule}</div>`).join('')}</div><p class=muted>目前尚未啟用自動事件資料流，因此不顯示「今日重大事件」清單，也不改變個股／TOP 10 分數。未來事件資料必須同時保存來源、事件發生日、發布日與驗證等級。</p>`}
const _eventShowMarket=showMarket;
showMarket=function(m){_eventShowMarket(m);const box=document.createElement('div');box.innerHTML=eventPolicyPanel();$('#marketBody').appendChild(box)};
