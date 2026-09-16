#!/usr/bin/env python3
"""Build a StockLab licensed-history manifest from already-authorised local files.

This tool NEVER downloads market data. It validates only files lawfully obtained under
explicit licence/contract rights. Missing fields, unverifiable rights, impossible data,
duplicate observations, missing context, or unresolved provenance cause hard failure.
No value is imputed or proxy-filled.
"""
import argparse, csv, hashlib, json, pathlib, sys
from datetime import datetime, timezone

REQUIRED_DATASETS = {
    'security_master': {'ticker','market','security_type','valid_from','valid_to','source_id'},
    'trading_calendar': {'date','market','is_trading_day','source_id'},
    'daily_ohlc': {'date','ticker','market','open','high','low','close','volume','source_id'},
    'corporate_actions': {'ticker','market','effective_date','action_type','source_id'},
    'risk_states': {'ticker','market','date','attention','disposition','suspended','source_id'},
    'market_index': {'date','market','index_code','close','source_id'},
}
SUPPORTED_FORMATS = {'csv','json','jsonl'}
MARKETS={'TWSE','TPEx'}


def sha256(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()


def read_rows(path,fmt):
    if fmt=='json':
        x=json.load(open(path,encoding='utf-8'))
        if not isinstance(x,list): raise ValueError(f'{path}: JSON must be an array')
        return x
    if fmt=='jsonl':
        out=[]
        with open(path,encoding='utf-8') as f:
            for i,line in enumerate(f,1):
                if not line.strip(): continue
                try: out.append(json.loads(line))
                except Exception as e: raise ValueError(f'{path}:{i}: invalid JSONL: {e}')
        return out
    with open(path,encoding='utf-8-sig',newline='') as f:
        return list(csv.DictReader(f))


def n(v):
    try:
        s=str(v).strip().replace(',','')
        return float(s) if s else None
    except: return None


def truth(v):
    return str(v).strip().lower() in {'1','true','yes','y'} or v is True


def validate_date(s,label,allow_blank=False):
    s=str(s or '').strip()
    if allow_blank and not s:return ''
    try: datetime.strptime(s,'%Y-%m-%d')
    except: raise ValueError(f'{label}: invalid ISO date {s!r}')
    return s


def ensure_columns(name,rows):
    if not rows: raise ValueError(f'{name}: empty dataset')
    cols=set(rows[0].keys()); miss=REQUIRED_DATASETS[name]-cols
    if miss: raise ValueError(f'{name}: missing columns {sorted(miss)}')


def source_registry(args):
    if args.source_registry:
        x=json.load(open(args.source_registry,encoding='utf-8'))
        if not isinstance(x,list) or not x: raise ValueError('source-registry must be a non-empty JSON array')
        out=[]; seen=set()
        for i,s in enumerate(x,1):
            for k in ('source_id','provider','dataset_name','evidence_reference','provenance_class'):
                if not str(s.get(k,'')).strip(): raise ValueError(f'source-registry[{i}]: missing {k}')
            sid=str(s['source_id']).strip()
            if sid in seen: raise ValueError(f'source-registry duplicate source_id {sid}')
            if s.get('provenance_class')!='observed': raise ValueError(f'{sid}: provenance_class must be observed')
            seen.add(sid); out.append({k:s[k] for k in ('source_id','provider','dataset_name','evidence_reference','provenance_class')})
        return out
    if not args.source_id or not args.dataset_name: raise ValueError('provide --source-registry or both --source-id and --dataset-name')
    return [{'source_id':args.source_id,'provider':args.provider,'dataset_name':args.dataset_name,'evidence_reference':args.evidence_reference,'provenance_class':'observed'}]


def check_source(x,label,allowed):
    sid=str(x.get('source_id','')).strip()
    if sid not in allowed: raise ValueError(f'{label}: unresolved source_id {sid!r}')
    return sid


def validate_security_master(rows,allowed):
    seen=set(); master={}
    for i,x in enumerate(rows,1):
        t=str(x.get('ticker','')).strip(); m=str(x.get('market','')).strip(); st=str(x.get('security_type','')).strip(); check_source(x,f'security_master:{i}',allowed)
        if not t or m not in MARKETS: raise ValueError(f'security_master:{i}: invalid ticker/market')
        if st!='ordinary_stock': raise ValueError(f'security_master:{i}: unsupported security_type {st!r}; ordinary_stock only')
        vf=validate_date(x.get('valid_from'),f'security_master:{i}.valid_from'); vt=validate_date(x.get('valid_to'),f'security_master:{i}.valid_to',allow_blank=True)
        if vt and vt<vf: raise ValueError(f'security_master:{i}: valid_to before valid_from')
        k=(m,t)
        if k in seen: raise ValueError(f'security_master:{i}: duplicate {k}')
        seen.add(k); master[k]={'valid_from':vf,'valid_to':vt}
    return master


def validate_calendar(rows,allowed):
    trade=set(); seen=set()
    for i,x in enumerate(rows,1):
        d=validate_date(x.get('date'),f'trading_calendar:{i}'); m=str(x.get('market','')).strip(); check_source(x,f'trading_calendar:{i}',allowed)
        if m not in MARKETS: raise ValueError(f'trading_calendar:{i}: invalid market')
        k=(m,d)
        if k in seen: raise ValueError(f'trading_calendar:{i}: duplicate {k}')
        seen.add(k)
        if truth(x.get('is_trading_day')): trade.add(k)
    if not trade: raise ValueError('trading_calendar: no verified trading sessions')
    return trade


def security_valid(meta,date):
    return date>=meta['valid_from'] and (not meta['valid_to'] or date<=meta['valid_to'])


def validate_ohlc(rows,master,trade,allowed):
    seen=set(); first=None; last=None; per={}; markets=set()
    for i,x in enumerate(rows,1):
        d=validate_date(x.get('date'),f'daily_ohlc:{i}'); t=str(x.get('ticker','')).strip(); m=str(x.get('market','')).strip(); check_source(x,f'daily_ohlc:{i}',allowed)
        meta=master.get((m,t))
        if not meta: raise ValueError(f'daily_ohlc:{i}: security not in ordinary-stock master {(m,t)}')
        if not security_valid(meta,d): raise ValueError(f'daily_ohlc:{i}: security {(m,t)} not valid on {d}')
        if (m,d) not in trade: raise ValueError(f'daily_ohlc:{i}: {d} is not a verified trading session for {m}')
        o,h,l,c=(n(x.get(k)) for k in ('open','high','low','close')); v=n(x.get('volume'))
        if None in (o,h,l,c,v) or min(o,h,l,c)<=0 or v<0: raise ValueError(f'daily_ohlc:{i}: missing/invalid numeric observation')
        if h < max(o,l,c) or l > min(o,h,c): raise ValueError(f'daily_ohlc:{i}: impossible OHLC')
        k=(m,t,d)
        if k in seen: raise ValueError(f'daily_ohlc:{i}: duplicate observation {k}')
        seen.add(k); markets.add(m); first=d if first is None or d<first else first; last=d if last is None or d>last else last; per[(m,t)]=per.get((m,t),0)+1
    return {'markets':sorted(markets),'start_date':first,'end_date':last,'securities_count':len(per),'first_date':first,'last_date':last,'rows':len(rows),'max_bars_per_security':max(per.values()) if per else 0,'securities':len(per)}


def validate_context(name,rows,master,allowed,date_key):
    seen=set()
    for i,x in enumerate(rows,1):
        d=validate_date(x.get(date_key),f'{name}:{i}'); t=str(x.get('ticker','')).strip(); m=str(x.get('market','')).strip(); check_source(x,f'{name}:{i}',allowed)
        meta=master.get((m,t))
        if not meta: raise ValueError(f'{name}:{i}: security not in master {(m,t)}')
        if not security_valid(meta,d): raise ValueError(f'{name}:{i}: security {(m,t)} not valid on {d}')
        k=(m,t,d,str(x.get('action_type','')) if name=='corporate_actions' else '')
        if k in seen: raise ValueError(f'{name}:{i}: duplicate {k}')
        seen.add(k)


def validate_market_index(rows,trade,allowed):
    seen=set(); markets=set()
    for i,x in enumerate(rows,1):
        d=validate_date(x.get('date'),f'market_index:{i}'); m=str(x.get('market','')).strip(); code=str(x.get('index_code','')).strip(); check_source(x,f'market_index:{i}',allowed); c=n(x.get('close'))
        if m not in MARKETS or not code: raise ValueError(f'market_index:{i}: invalid market/index_code')
        if (m,d) not in trade: raise ValueError(f'market_index:{i}: {d} is not a verified trading session for {m}')
        if not (c and c>0): raise ValueError(f'market_index:{i}: invalid close')
        k=(m,code,d)
        if k in seen: raise ValueError(f'market_index:{i}: duplicate {k}')
        seen.add(k); markets.add(m)
    if not markets: raise ValueError('market_index: no usable broad-market history')
    return markets


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--bundle-dir',required=True)
    ap.add_argument('--provider',required=True,help='Bundle/provider label; may be a combined label when source-registry has multiple licensed sources')
    ap.add_argument('--source-id')
    ap.add_argument('--dataset-name')
    ap.add_argument('--source-registry',help='Optional JSON array of multiple observed source registry entries')
    ap.add_argument('--license-name',required=True)
    ap.add_argument('--legal-basis',required=True)
    ap.add_argument('--evidence-reference',required=True)
    ap.add_argument('--terms-reference',required=True,help='Order/contract/terms version or retained evidence reference')
    ap.add_argument('--terms-reviewed-date',required=True,help='YYYY-MM-DD')
    ap.add_argument('--acquisition-mode',required=True,help='Exact authorised method, e.g. manual_provider_portal, provider_api, provider_sftp')
    ap.add_argument('--acquisition-mode-authorized',action='store_true')
    ap.add_argument('--automated-processing-allowed',action='store_true')
    ap.add_argument('--derived-outputs-allowed',action='store_true')
    ap.add_argument('--public-derived-outputs-allowed',action='store_true')
    ap.add_argument('--local-storage-allowed',action='store_true')
    ap.add_argument('--processing-location',required=True,help='Exact private processing environment/location approved under the licence')
    ap.add_argument('--processing-location-authorized',action='store_true')
    ap.add_argument('--raw-redistribution-allowed',action='store_true')
    ap.add_argument('--out',default='manifest.json')
    args=ap.parse_args()

    validate_date(args.terms_reviewed_date,'terms-reviewed-date')
    for label,value in (
        ('terms-reference',args.terms_reference),
        ('acquisition-mode',args.acquisition_mode),
        ('processing-location',args.processing_location),
        ('legal-basis',args.legal_basis),
        ('evidence-reference',args.evidence_reference),
    ):
        if not str(value).strip(): raise SystemExit(f'LICENCE_GATE_FAIL: {label} must be non-empty')
    required_rights=(
        args.acquisition_mode_authorized,
        args.automated_processing_allowed,
        args.derived_outputs_allowed,
        args.public_derived_outputs_allowed,
        args.local_storage_allowed,
        args.processing_location_authorized,
    )
    if not all(required_rights):
        raise SystemExit('LICENCE_GATE_FAIL: acquisition method, automated processing, derived output, public derived output, local storage and processing location must all be explicitly authorised')

    root=pathlib.Path(args.bundle_dir).resolve()
    if not root.is_dir(): raise SystemExit('bundle-dir not found')
    sources=source_registry(args); allowed={str(s['source_id']) for s in sources}
    specs={}
    for name in REQUIRED_DATASETS:
        found=[]
        for ext in SUPPORTED_FORMATS:
            p=root/f'{name}.{ext}'
            if p.exists(): found.append((p,ext))
        if len(found)!=1: raise SystemExit(f'{name}: expected exactly one of .csv/.json/.jsonl, found {len(found)}')
        specs[name]=found[0]

    rows={}
    for name,(p,fmt) in specs.items():
        rows[name]=read_rows(p,fmt); ensure_columns(name,rows[name])

    master=validate_security_master(rows['security_master'],allowed)
    trade=validate_calendar(rows['trading_calendar'],allowed)
    coverage=validate_ohlc(rows['daily_ohlc'],master,trade,allowed)
    validate_context('corporate_actions',rows['corporate_actions'],master,allowed,'effective_date')
    validate_context('risk_states',rows['risk_states'],master,allowed,'date')
    index_markets=validate_market_index(rows['market_index'],trade,allowed)
    missing_index=set(coverage['markets'])-set(index_markets)
    if missing_index: raise ValueError(f'market_index missing tested markets {sorted(missing_index)}')

    datasets={}
    for name,(p,fmt) in specs.items():
        source_ids=sorted({str(x.get('source_id','')).strip() for x in rows[name]})
        if not source_ids or any(s not in allowed for s in source_ids): raise ValueError(f'{name}: unresolved source_ids')
        datasets[name]={'path':p.name,'sha256':sha256(p),'row_count':len(rows[name]),'format':fmt,'source_ids':source_ids}

    manifest={
      'schema_version':1,
      'bundle_id':f"licensed-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
      'created_at':datetime.now(timezone.utc).isoformat(),
      'provider':args.provider,
      'license':{
        'license_name':args.license_name,
        'legal_basis':args.legal_basis,
        'evidence_reference':args.evidence_reference,
        'terms_reference':args.terms_reference,
        'terms_reviewed_date':args.terms_reviewed_date,
        'acquisition_mode':args.acquisition_mode,
        'acquisition_mode_authorized':True,
        'automated_processing_allowed':True,
        'derived_outputs_allowed':True,
        'public_derived_outputs_allowed':True,
        'local_storage_allowed':True,
        'processing_location':args.processing_location,
        'processing_location_authorized':True,
        'raw_redistribution_allowed':bool(args.raw_redistribution_allowed),
      },
      'sources':sources,
      'coverage':coverage,
      'datasets':datasets,
      'no_imputation':True,
      'network_collection_performed_by_importer':False,
      'raw_publication_permitted':bool(args.raw_redistribution_allowed),
    }
    out=(root/args.out).resolve()
    if root not in out.parents: raise SystemExit('manifest output must remain inside bundle-dir')
    with open(out,'w',encoding='utf-8') as f: json.dump(manifest,f,ensure_ascii=False,indent=2)
    print(json.dumps({'ok':True,'manifest':str(out),'coverage':coverage,'sources':len(sources),'raw_redistribution_allowed':args.raw_redistribution_allowed,'acquisition_mode':args.acquisition_mode,'processing_location':args.processing_location},ensure_ascii=False,indent=2))

if __name__=='__main__':
    try: main()
    except Exception as e:
        print(f'IMPORT_REJECTED: {e}',file=sys.stderr)
        raise SystemExit(2)
