const http = require('http');

const PORT = process.env.PORT || 3000;
const UA = 'ShowU-Stock-Analyzer/1.0 (+https://www.showujapan.com/)';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = v => {
  if (v == null) return null;
  const s = String(v).replaceAll(',','').replace(/[＋+]/g,'').trim();
  if (!s || ['--','---','----','除權','除息'].includes(s)) return null;
  const x = Number(s);
  return Number.isFinite(x) ? x : null;
};
const mean = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
const ma = (b,k) => b.length>=k ? mean(b.slice(-k).map(x=>x.c)) : null;
const atr = (b,k=14) => {
  if (b.length<k+1) return null;
  const t=[];
  for(let i=1;i<b.length;i++){
    const x=b[i],p=b[i-1];
    t.push(Math.max(x.h-x.l,Math.abs(x.h-p.c),Math.abs(x.l-p.c)));
  }
  return mean(t.slice(-k));
};
const minLow=(b,k)=>{const a=b.slice(-Math.min(k,b.length));return a.length?Math.min(...a.map(x=>x.l)):null};
const maxHigh=(b,k)=>{const a=b.slice(-Math.min(k,b.length));return a.length?Math.max(...a.map(x=>x.h)):null};
function swings(b,side){
  const out=[];
  for(let i=2;i<b.length-2;i++){
    const x=b[i];
    if(side==='low'&&x.l<=b[i-1].l&&x.l<=b[i-2].l&&x.l<=b[i+1].l&&x.l<=b[i+2].l) out.push(x.l);
    if(side==='high'&&x.h>=b[i-1].h&&x.h>=b[i-2].h&&x.h>=b[i+1].h&&x.h>=b[i+2].h) out.push(x.h);
  }
  return out.slice(-12);
}
function volumeNodes(b){
  const a=b.slice(-Math.min(120,b.length));
  if(!a.length) return [];
  const lo=Math.min(...a.map(x=>x.l)),hi=Math.max(...a.map(x=>x.h));
  if(!(hi>lo)) return [];
  const bins=24,step=(hi-lo)/bins,vol=Array(bins).fill(0);
  for(const x of a){
    const tp=(x.h+x.l+x.c)/3;
    const i=Math.max(0,Math.min(bins-1,Math.floor((tp-lo)/step)));
    vol[i]+=x.v||0;
  }
  return vol.map((v,i)=>({p:lo+(i+.5)*step,v}))
    .sort((a,b)=>b.v-a.v).slice(0,4).map(x=>x.p);
}
function cluster(levels,tol){
  const xs=levels.filter(Number.isFinite).sort((a,b)=>a-b),out=[];
  for(const p of xs){
    const last=out.at(-1);
    if(!last||p-last.max>tol) out.push({vals:[p],min:p,max:p});
    else {last.vals.push(p);last.min=Math.min(last.min,p);last.max=Math.max(last.max,p)}
  }
  return out.map(c=>({min:c.min,max:c.max,mid:mean(c.vals),count:c.vals.length}))
    .filter(c=>c.count>=2);
}
const round2=n=>Number.isFinite(n)?Math.round(n*100)/100:null;
function band(c,a){
  if(!c) return null;
  const pad=Math.max((a||0)*.12,c.mid*.0015);
  return {low:round2(Math.max(.01,c.min-pad)),high:round2(c.max+pad)};
}
function engine(b){
  const close=b.at(-1).c,a=atr(b),tol=Math.max((a||close*.02)*.7,close*.008);
  const mas=[ma(b,20),ma(b,60),ma(b,120)],nodes=volumeNodes(b);
  const supports=cluster(
    [...mas,minLow(b,20),minLow(b,60),minLow(b,120),...swings(b,'low'),...nodes]
      .filter(x=>x&&x<=close*1.01),tol
  ).filter(c=>c.mid<=close*1.005).sort((x,y)=>y.mid-x.mid);
  const resist=cluster(
    [maxHigh(b,20),maxHigh(b,60),maxHigh(b,120),...swings(b,'high'),...nodes]
      .filter(x=>x&&x>=close*.995),tol
  ).filter(c=>c.mid>=close*.995).sort((x,y)=>x.mid-y.mid);

  const s1=supports[0],s2=supports[1],r1=resist[0],r2=resist[1];
  const defense=s1?Math.max(.01,s1.min-(a||0)*.35):null;
  const invalidation=s2?Math.max(.01,s2.min-(a||0)*.45):(s1?Math.max(.01,s1.min-(a||0)*1.1):null);
  const decision=s1&&close<=s1.max+tol*.25?'接近買入區':
    r1&&close>=r1.min-tol*.2?'接近壓力，不追價':'等待回檔';

  const hist=Math.min(25,10+Math.max(0,b.length-60)/60*15);
  const ev=Math.min(35,((s1?.count||0)+(r1?.count||0))*8.75);
  const tightOne=c=>!c||!a?0:Math.max(0,1-Math.min(1,(c.max-c.min)/(a*1.5)));
  const tight=25*((tightOne(s1)+tightOne(r1))/2);
  const volPct=a&&close?a/close:null;
  const vol=volPct==null?0:volPct<=.02?15:volPct<=.035?12:volPct<=.05?8:4;
  const confidence=Math.round(Math.max(0,Math.min(100,hist+ev+tight+vol)));
  const confidenceLabel=confidence>=80?'高':confidence>=65?'中高':confidence>=50?'中':'低';

  return {
    latest:round2(close),
    decision,
    confidence:{score:confidence,label:confidenceLabel,meaning:'價格結構證據完整度，不是勝率或上漲機率'},
    indicators:{ma20:round2(ma(b,20)),ma60:round2(ma(b,60)),ma120:round2(ma(b,120)),atr14:round2(a)},
    prices:{
      firstEntry:band(s1,a),
      secondEntry:band(s2,a),
      noChase:r1?round2(r1.min):null,
      firstExit:band(r1,a),
      secondExit:band(r2,a),
      defense:round2(defense),
      invalidation:round2(invalidation)
    }
  };
}

async function fetchJson(url,retries=2,extraHeaders={}){
  let last;
  for(let i=0;i<=retries;i++){
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),12000);
    try{
      const r=await fetch(url,{headers:{'User-Agent':UA,'Accept':'application/json',...extraHeaders},signal:ctrl.signal});
      if(r.ok) return await r.json();
      last=new Error('HTTP '+r.status+' '+url);
      if(![429,500,502,503,504].includes(r.status)) break;
    }catch(e){last=e}
    finally{clearTimeout(timer)}
    if(i<retries) await sleep(600*(i+1));
  }
  throw last||new Error('官方資料連線失敗');
}
function addMonths(d,m){const x=new Date(d);x.setUTCDate(1);x.setUTCMonth(x.getUTCMonth()+m);return x}
const twseMonth=d=>`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}01`;
const rocMonth=d=>`${d.getUTCFullYear()-1911}/${String(d.getUTCMonth()+1).padStart(2,'0')}`;
function rocDateToIso(s){
  const m=String(s||'').match(/^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/);
  if(!m) return String(s||'');
  return `${Number(m[1])+1911}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
}

async function resolveStock(q){
  const s=String(q||'').trim();
  if(!s) throw new Error('請輸入股票名稱或代碼');

  const [twse,tpex]=await Promise.allSettled([
    fetchJson('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',1),
    fetchJson('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes',1)
  ]);

  const tw=twse.status==='fulfilled'&&Array.isArray(twse.value)?twse.value:[];
  const tp=tpex.status==='fulfilled'&&Array.isArray(tpex.value)?tpex.value:[];

  const codeKeys=['Code','SecuritiesCompanyCode','SecuritiesCompanyCode'];
  const nameKeys=['Name','CompanyName','SecuritiesCompanyName'];

  const getCode=r=>codeKeys.map(k=>r?.[k]).find(v=>v!=null)?.toString().trim()||'';
  const getName=r=>nameKeys.map(k=>r?.[k]).find(v=>v!=null)?.toString().trim()||'';

  const exact=(arr)=>arr.find(r=>getCode(r)===s);
  let row=exact(tw);
  if(row) return {code:getCode(row),name:getName(row)||s,market:'TWSE'};
  row=exact(tp);
  if(row) return {code:getCode(row),name:getName(row)||s,market:'TPEx'};

  row=tw.find(r=>getName(r)===s)||tw.find(r=>getName(r).includes(s));
  if(row) return {code:getCode(row),name:getName(row),market:'TWSE'};
  row=tp.find(r=>getName(r)===s)||tp.find(r=>getName(r).includes(s));
  if(row) return {code:getCode(row),name:getName(row),market:'TPEx'};

  throw new Error('找不到上市或上櫃股票');
}

async function fetchTwseHistory(code){
  const now=new Date(),rows=[];
  let okMonths=0,failedMonths=0;
  for(let i=0;i<10;i++){
    const d=addMonths(now,-i),date=twseMonth(d);
    const urls=[
      `https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?response=json&date=${date}&stockNo=${encodeURIComponent(code)}`,
      `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${date}&stockNo=${encodeURIComponent(code)}`
    ];
    let j=null;
    for(const url of urls){
      try{
        const x=await fetchJson(url,2);
        if(Array.isArray(x?.data)&&x.data.length){j=x;break}
      }catch{}
    }
    if(!j){failedMonths++;continue}
    okMonths++;
    for(const r of j.data){
      const o=num(r[3]),h=num(r[4]),l=num(r[5]),c=num(r[6]),v=num(r[1]);
      if([o,h,l,c].every(Number.isFinite)&&h>=Math.max(o,l,c)&&l<=Math.min(o,h,c))
        rows.push({date:rocDateToIso(r[0]),o,h,l,c,v:Number.isFinite(v)?v:null});
    }
    if(new Set(rows.map(x=>x.date)).size>=150) break;
    await sleep(250);
  }
  return finalizeHistory(rows,okMonths,failedMonths);
}

async function fetchTpexHistory(code){
  const now=new Date(),rows=[];
  let okMonths=0,failedMonths=0;
  const referer='https://www.tpex.org.tw/zh-tw/mainboard/trading/info/stock-day.html';
  const headers={
    'Referer':referer,
    'X-Requested-With':'XMLHttpRequest',
    'Accept':'application/json, text/plain, */*'
  };
  for(let i=0;i<10;i++){
    const d=addMonths(now,-i);
    const date=`${d.getUTCFullYear()}/${String(d.getUTCMonth()+1).padStart(2,'0')}/01`;
    const url=`https://www.tpex.org.tw/www/zh-tw/afterTrading/tradingStock?code=${encodeURIComponent(code)}&date=${encodeURIComponent(date)}&response=json`;
    try{
      const j=await fetchJson(url,2,headers);
      const table=Array.isArray(j?.tables)?j.tables[0]:null;
      const data=Array.isArray(table?.data)?table.data:[];
      if(String(j?.stat||'').toLowerCase()!=='ok'||!data.length){failedMonths++;continue}
      okMonths++;
      for(const r of data){
        const o=num(r[3]),h=num(r[4]),l=num(r[5]),c=num(r[6]),v=num(r[1]);
        if([o,h,l,c].every(Number.isFinite)&&h>=Math.max(o,l,c)&&l<=Math.min(o,h,c))
          rows.push({date:rocDateToIso(r[0]),o,h,l,c,v:Number.isFinite(v)?v*1000:null});
      }
    }catch{failedMonths++}
    if(new Set(rows.map(x=>x.date)).size>=150) break;
    await sleep(250);
  }
  return finalizeHistory(rows,okMonths,failedMonths);
}
function finalizeHistory(rows,okMonths,failedMonths){
  const m=new Map(rows.map(x=>[x.date,x]));
  const out=[...m.values()].sort((a,b)=>a.date.localeCompare(b.date));
  if(out.length<60) throw new Error(`官方歷史資料不足：取得 ${out.length} 根（成功月份 ${okMonths}、失敗月份 ${failedMonths}）`);
  return {bars:out.slice(-180),okMonths,failedMonths};
}

async function analyze(stock){
  const resolved=await resolveStock(stock);
  const hist=resolved.market==='TWSE'
    ? await fetchTwseHistory(resolved.code)
    : await fetchTpexHistory(resolved.code);
  const result=engine(hist.bars);
  return {
    ok:true,
    stock:{...resolved,date:hist.bars.at(-1).date,bars:hist.bars.length},
    ...result,
    audit:{
      source:resolved.market==='TWSE'?'TWSE STOCK_DAY':'TPEx individual daily trading info',
      fetchedOnline:true,
      database:false,
      validOHLC:hist.bars.length,
      successfulMonths:hist.okMonths,
      failedMonths:hist.failedMonths,
      generatedAt:new Date().toISOString()
    }
  };
}

function send(res,status,obj){
  const body=JSON.stringify(obj);
  res.writeHead(status,{
    'Content-Type':'application/json; charset=utf-8',
    'Access-Control-Allow-Origin':'*',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'
  });
  res.end(body);
}

const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){
    res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});
    return res.end();
  }
  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  if(url.pathname==='/health') return send(res,200,{ok:true,service:'stock-api',database:false});
  if(url.pathname!=='/api/analyze') return send(res,404,{ok:false,error:'not found'});
  try{
    const stock=url.searchParams.get('stock');
    const data=await analyze(stock);
    return send(res,200,data);
  }catch(e){
    return send(res,422,{ok:false,error:e?.message||String(e)});
  }
});

server.listen(PORT,()=>console.log(`stock-api listening on ${PORT}`));
