// Taiwan data integrity layer: validates factor dates/periods before scoring.
const _integrityExtras=extras,_integrityCombine=combine,_integrityRender=render;
function parseTWDate(s){if(!s)return null;let t=String(s).trim(),m;if((m=t.match(/^(\d{4})[-\/]?(\d{2})[-\/]?(\d{2})$/)))return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+08:00`);if((m=t.match(/^(\d{2,3})\/(\d{2})\/(\d{2})$/)))return new Date(`${+m[1]+1911}-${m[2]}-${m[3]}T00:00:00+08:00`);return null}
function dateGap(a,b){const x=parseTWDate(a),y=parseTWDate(b);return x&&y?Math.abs(Math.floor((x-y)/86400000)):9999}
function normalizePeriod(p){let s=String(p||'').replace(/\D/g,'');if(/^\d{6}$/.test(s))return s;if(/^\d{5}$/.test(s)){const y=+s.slice(0,3)+1911;return `${y}${s.slice(3)}`}return null}
function expectedRevenueMinPeriod(){const d=new Date(),cut=d.getDate()>=12?1:2,x=new Date(d.getFullYear(),d.getMonth()-cut,1);return `${x.getFullYear()}${String(x.getMonth()+1).padStart(2,'0')}`}
function quarterFresh(q){if(!q)return false;const rd=parseTWDate(q.reportDate);if(!rd)return false;const age=(Date.now()-rd.getTime())/86400000;return age>=-2&&age<=220}
function factorIntegrity(stockDate,v,i,r,q){const valuationDate=v?.date||null,revPeriod=normalizePeriod(r?.period),minRev=expectedRevenueMinPeriod(),instDate=i?.date||null;return{
 price:{ok:!!stockDate,date:stockDate,reason:stockDate?'價格日已交叉驗證':'缺少交易日'},
 institution:{ok:!!i&&dateGap(instDate,stockDate)===0,date:instDate,reason:!i?'未取得法人資料':dateGap(instDate,stockDate)===0?'法人日期與價格日一致':'法人日期不一致'},
 valuation:{ok:!!v&&dateGap(valuationDate,stockDate)<=7,date:valuationDate,reason:!v?'未取得估值':dateGap(valuationDate,stockDate)<=7?'估值日期在容許範圍':'估值日期過舊或不一致'},
 revenue:{ok:!!r&&!!revPeriod&&revPeriod>=minRev,date:revPeriod,reason:!r?'未取得月營收':revPeriod&&revPeriod>=minRev?'月營收期別符合最新應公布範圍':`月營收期別過舊，最低應為 ${minRev}`},
 quarterly:{ok:quarterFresh(q),date:q?`${q.year||'—'}Q${q.quarter||'—'} / ${q.reportDate||'—'}`:null,reason:q?(quarterFresh(q)?'季報期別與出表日有效':'季報出表日過舊或異常'):'未取得季報'}
}}
extras=async function(date){const base=await _integrityExtras(date);for(const [,x] of base.I||[])x.date=date;return base};
combine=function(a,h,m,v,i,r){a=_integrityCombine(a,h,m,v,i,r);const integ=factorIntegrity(a.last?.iso,v,i,r,a.fin);let correction=0;
 if(!integ.institution.ok&&a.instRatio!=null){if(a.instRatio>=.02)correction-=4;else if(a.instRatio<=-.02)correction+=4;a.inst=null;a.instRatio=null;}
 if(!integ.valuation.ok)a.val=null;
 if(!integ.revenue.ok&&r?.yoy!=null&&h!=='day'){const w=h==='3m'?5:h==='long'?4:3;if(r.yoy>=20)correction-=w;else if(r.yoy<=-15)correction+=w;a.rev=null;}
 if(!integ.quarterly.ok&&a.finDelta){correction-=a.finDelta;a.finDelta=0;a.fin=null;}
 a.integrity=integ;a.integrityCorrection=correction;a.score=Math.max(0,Math.min(100,a.score+correction));a.action=a.score>=75?'偏多｜等拉回可分批':a.score>=60?'觀察｜不追價':a.score>=45?'中性｜等待確認':'偏弱｜暫避';return a};
function integrityPanel(a){const q=a.integrity||{},row=(name,x)=>`<div class=sourceitem><b>${x?.ok?'✅':'⚠️'} ${name}</b>${x?.date||'—'}<br><span class=mini>${x?.reason||'未驗證'}</span></div>`;return `<h3>資料完整性</h3><div class=sourcegrid>${row('價格',q.price)}${row('三大法人',q.institution)}${row('估值',q.valuation)}${row('月營收',q.revenue)}${row('季報',q.quarterly)}<div class=sourceitem><b>計分修正</b>${a.integrityCorrection>0?'+':''}${a.integrityCorrection||0}<br><span class=mini>未通過期別驗證的因子已退出分數</span></div></div>`}
render=function(code,a,h,vf){_integrityRender(code,a,h,vf);if(!vf.complete)return;const result=$('#result');if(!result)return;const box=document.createElement('div');box.innerHTML=integrityPanel(a);const reason=[...result.querySelectorAll('h3')].find(x=>x.textContent.includes('理由'));result.insertBefore(box,reason||null);const bubble=result.querySelector('.bubble');if(bubble)bubble.textContent=a.score;};
