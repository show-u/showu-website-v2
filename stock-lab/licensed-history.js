// Licensed historical-data loader. Same-origin bundle only; no website/API fallback.
// Missing manifest, licence evidence, hashes or source provenance => unavailable.
(function(){
  const MANIFEST='./licensed-data/manifest.json';
  let manifestPromise=null,fileCache=new Map();
  const req=(o,keys,where)=>{for(const k of keys)if(o?.[k]===undefined||o?.[k]===null||o?.[k]==='')throw Error(`${where}.${k} 缺漏`)};
  function sameOriginPath(rel){const u=new URL(rel,location.href);if(u.origin!==location.origin)throw Error('合法資料 bundle 禁止跨網域 payload');return u.href}
  async function sha256(buf){const d=await crypto.subtle.digest('SHA-256',buf),a=[...new Uint8Array(d)];return a.map(x=>x.toString(16).padStart(2,'0')).join('')}
  function validSha(s){return /^[a-f0-9]{64}$/i.test(String(s||''))}
  function validateManifest(m){
    req(m,['schema_version','bundle_id','created_at','provider','license','sources','coverage','datasets'],'manifest');if(m.schema_version!==1)throw Error('合法資料 manifest 版本不符');
    const L=m.license;req(L,['license_name','legal_basis','evidence_reference','automated_processing_allowed','derived_outputs_allowed','local_storage_allowed','raw_redistribution_allowed'],'license');
    for(const k of ['automated_processing_allowed','derived_outputs_allowed','local_storage_allowed'])if(L[k]!==true)throw Error(`license.${k} 未允許，禁止模型使用`);
    if(!Array.isArray(m.sources)||!m.sources.length)throw Error('來源 registry 缺漏');
    const ids=new Set();for(const s of m.sources){req(s,['source_id','provider','dataset_name','evidence_reference','provenance_class'],'source');if(s.provenance_class!=='observed')throw Error(`來源 ${s.source_id} provenance 不可作市場事實`);if(ids.has(s.source_id))throw Error(`來源 ID 重複 ${s.source_id}`);ids.add(s.source_id)}
    for(const k of ['security_master','trading_calendar','daily_ohlc','corporate_actions','risk_states']){const d=m.datasets[k];if(!d)throw Error(`必要合法資料集缺漏：${k}`);req(d,['path','sha256','row_count','format','source_ids'],`datasets.${k}`);if(!validSha(d.sha256))throw Error(`${k} SHA-256 格式錯誤`);if(!Array.isArray(d.source_ids)||!d.source_ids.length||d.source_ids.some(x=>!ids.has(x)))throw Error(`${k} source_ids 未能解析`);sameOriginPath(d.path)}
    return m
  }
  async function manifest(){
    if(!manifestPromise)manifestPromise=fetch(MANIFEST,{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('合法歷史資料 bundle 尚未提供');return validateManifest(await r.json())}).catch(e=>{manifestPromise=null;throw e});return manifestPromise
  }
  function parseJsonl(text){const out=[];for(const [i,line] of text.split(/\r?\n/).entries()){if(!line.trim())continue;try{out.push(JSON.parse(line))}catch{throw Error(`JSONL 第 ${i+1} 行格式錯誤`)}}return out}
  function parseCsv(text){
    const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.length);if(!lines.length)return[];
    const split=line=>{const a=[];let s='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){s+='"';i++}else q=!q}else if(c===','&&!q){a.push(s);s=''}else s+=c}a.push(s);return a};
    const h=split(lines[0]);return lines.slice(1).map((line,idx)=>{const v=split(line);if(v.length!==h.length)throw Error(`CSV 第 ${idx+2} 行欄位數不符`);return Object.fromEntries(h.map((k,i)=>[k,v[i]]))})
  }
  async function dataset(name){
    if(fileCache.has(name))return fileCache.get(name);const m=await manifest(),d=m.datasets[name];if(!d)throw Error(`資料集不存在：${name}`);
    const p=(async()=>{const u=sameOriginPath(d.path),r=await fetch(u,{cache:'no-store'});if(!r.ok)throw Error(`${name} payload 讀取失敗`);const buf=await r.arrayBuffer(),digest=await sha256(buf);if(digest.toLowerCase()!==String(d.sha256).toLowerCase())throw Error(`${name} SHA-256 驗證失敗`);const text=new TextDecoder('utf-8').decode(buf);let rows;if(d.format==='json'){rows=JSON.parse(text);if(!Array.isArray(rows))throw Error(`${name} JSON 必須是陣列`)}else if(d.format==='jsonl')rows=parseJsonl(text);else if(d.format==='csv')rows=parseCsv(text);else throw Error(`${name} 格式不支援`);if(rows.length!==Number(d.row_count))throw Error(`${name} row_count 不一致`);return rows})();
    fileCache.set(name,p);try{return await p}catch(e){fileCache.delete(name);throw e}
  }
  function bar(x){const n=k=>{const v=Number(x[k]);if(!Number.isFinite(v))throw Error(`OHLC ${k} 無效`);return v},iso=String(x.date||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))throw Error('OHLC 日期無效');const o=n('open'),h=n('high'),l=n('low'),c=n('close'),v=Number(x.volume);if(Math.min(o,h,l,c)<=0||h<Math.max(o,l,c)||l>Math.min(o,h,c))throw Error('OHLC 邏輯不可能');return{iso,d:iso,o,h,l,c,v:Number.isFinite(v)?v:null,source_id:x.source_id,provenance:'observed'}}
  async function load({code,market,minimumBars=60,from=null}={}){
    code=String(code||'').trim();if(!/^\d{4,6}$/.test(code))throw Error('股票代號格式錯誤');if(!['TWSE','TPEx'].includes(market))throw Error('市場別未驗證');
    const [m,master,calendar,ohlc,actions,risks]=await Promise.all([manifest(),dataset('security_master'),dataset('trading_calendar'),dataset('daily_ohlc'),dataset('corporate_actions'),dataset('risk_states')]);
    const security=master.find(x=>String(x.ticker)===code&&x.market===market&&x.security_type==='ordinary_stock');if(!security)throw Error('合法商品分類沒有此普通股，禁止套用普通股模型');
    const rows=ohlc.filter(x=>String(x.ticker)===code&&x.market===market&&(!from||String(x.date)>=from)).map(bar).sort((a,b)=>a.iso.localeCompare(b.iso));if(rows.length<minimumBars)throw Error(`合法歷史行情不足：${rows.length}/${minimumBars}`);
    const tradeDates=new Set(calendar.filter(x=>x.market===market&&(x.is_trading_day===true||String(x.is_trading_day).toLowerCase()==='true'||String(x.is_trading_day)==='1')).map(x=>String(x.date)));
    for(const x of rows)if(!tradeDates.has(x.iso))throw Error(`OHLC ${x.iso} 不在已驗證交易日曆`);
    const sourceIds=new Set(m.sources.map(x=>x.source_id));for(const x of rows)if(!sourceIds.has(x.source_id))throw Error(`OHLC source_id 未解析：${x.source_id}`);
    return rows
  }
  async function context({code,market,from=null}={}){const [actions,risks]=await Promise.all([dataset('corporate_actions'),dataset('risk_states')]);return{corporateActions:actions.filter(x=>String(x.ticker)===String(code)&&x.market===market&&(!from||String(x.effective_date)>=from)),riskStates:risks.filter(x=>String(x.ticker)===String(code)&&x.market===market&&(!from||String(x.date)>=from)),provenance:'observed'}}
  async function status(){try{const m=await manifest();return{usable:true,bundle_id:m.bundle_id,provider:m.provider,license_name:m.license.license_name,coverage:m.coverage,networkFallback:false,imputation:false}}catch(e){return{usable:false,reason:String(e.message||e),networkFallback:false,imputation:false}}}
  window.StockLabLicensedHistory={load,context,status,manifest,dataset,mode:'licensed-bundle-only'};
})();
