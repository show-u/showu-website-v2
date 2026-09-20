// Verified public OGDL history loader.
// Uses only StockLab's same-origin daily archive that was collected from explicitly OGDL-1.0 datasets.
// No remote website/API fallback, no backfill, no imputation.
(function(){
  const MANIFEST='./history-ogdl/manifest.json';
  let manifestPromise=null,fileCache=new Map();

  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
  const validSha=s=>/^[a-f0-9]{64}$/i.test(String(s||''));
  async function sha256(buf){const d=await crypto.subtle.digest('SHA-256',buf);return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}

  async function manifest(){
    if(!manifestPromise)manifestPromise=fetch(MANIFEST,{cache:'no-store'}).then(async r=>{
      if(!r.ok)throw Error('OGDL 歷史 manifest 尚未提供');
      const m=await r.json();
      if(m.schema_version!==1||m.source_class!=='ogdl_daily_archive'||m.licence!=='OGDL-1.0'||m.no_imputation!==true)throw Error('OGDL 歷史 manifest 驗證失敗');
      if(!Array.isArray(m.files)||!m.files.length)throw Error('OGDL 歷史檔案清單為空');
      for(const f of m.files){
        if(!String(f.file||'').endsWith('.jsonl')||!validSha(f.sha256)||!(Number(f.rows)>0))throw Error('OGDL 歷史檔案 metadata 無效');
      }
      return m;
    }).catch(e=>{manifestPromise=null;throw e});
    return manifestPromise;
  }

  async function fileRows(meta){
    if(fileCache.has(meta.file))return fileCache.get(meta.file);
    const p=(async()=>{
      const u=new URL('./history-ogdl/'+meta.file,location.href);
      if(u.origin!==location.origin)throw Error('OGDL 歷史禁止跨網域 payload');
      const r=await fetch(u.href,{cache:'no-store'});if(!r.ok)throw Error('OGDL 歷史 payload 讀取失敗');
      const buf=await r.arrayBuffer(),digest=await sha256(buf);
      if(digest.toLowerCase()!==String(meta.sha256).toLowerCase())throw Error('OGDL 歷史 SHA-256 驗證失敗');
      const text=new TextDecoder('utf-8').decode(buf),out=[];
      for(const [i,line] of text.split(/\r?\n/).entries()){
        if(!line.trim())continue;
        let x;try{x=JSON.parse(line)}catch{throw Error('OGDL 歷史 JSONL 第 '+(i+1)+' 行格式錯誤')}
        if(x.archive_schema_version!==1||x.source_class!=='ogdl_daily_archive'||x.licence!=='OGDL-1.0'||x.provenance!=='observed')throw Error('OGDL 歷史 observation provenance／licence 驗證失敗');
        out.push(x);
      }
      if(out.length!==Number(meta.rows))throw Error('OGDL 歷史 row_count 不一致');
      return out;
    })();
    fileCache.set(meta.file,p);try{return await p}catch(e){fileCache.delete(meta.file);throw e}
  }

  function bar(x){
    const o=n(x.open),h=n(x.high),l=n(x.low),c=n(x.close),v=n(x.volume),iso=String(x.date||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)||![o,h,l,c].every(z=>z>0))throw Error('OGDL OHLC 欄位無效');
    if(h<Math.max(o,l,c)||l>Math.min(o,h,c))throw Error('OGDL OHLC 邏輯不可能');
    return{iso,d:iso,o,h,l,c,v:Number.isFinite(v)?v:null,source_id:x.source_id,provenance:'observed',licence:'OGDL-1.0'};
  }

  async function load({code,market,minimumBars=60,from=null}={}){
    code=String(code||'').trim();
    if(!/^\d{4,6}$/.test(code))throw Error('股票代號格式錯誤');
    if(!['TWSE','TPEx'].includes(market))throw Error('市場別未驗證');
    const m=await manifest(),rows=[];
    for(const f of m.files){
      if(from&&String(f.last_date||'')<from)continue;
      for(const x of await fileRows(f)){
        if(String(x.ticker)!==code||x.market!==market)continue;
        if(from&&String(x.date)<from)continue;
        rows.push(bar(x));
      }
    }
    rows.sort((a,b)=>a.iso.localeCompare(b.iso));
    const dedup=[];let prev='';
    for(const x of rows){if(x.iso===prev)continue;dedup.push(x);prev=x.iso}
    if(dedup.length<minimumBars)throw Error('合法 OGDL 歷史行情不足：'+dedup.length+'/'+minimumBars);
    return dedup;
  }

  async function status(){
    try{
      const m=await manifest();
      return{usable:true,source_class:m.source_class,licence:m.licence,first_date:m.first_date,last_date:m.last_date,coverage:m.coverage_metrics,networkFallback:false,imputation:false};
    }catch(e){return{usable:false,reason:String(e.message||e),networkFallback:false,imputation:false}}
  }

  window.StockLabVerifiedHistory={load,status,manifest,mode:'same-origin-ogdl-archive-only'};
})();
