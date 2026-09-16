#!/usr/bin/env python3
"""Build a StockLab licensed-history manifest from already-authorised local files.

This tool NEVER downloads market data. It only validates files that the operator has
lawfully obtained under an explicit licence/contract. Missing fields, unverifiable
licence rights, impossible OHLC, duplicate observations, or missing context cause a
hard failure. It does not impute or proxy-fill anything.
"""
import argparse, csv, hashlib, json, os, pathlib, sys
from datetime import datetime, timezone

REQUIRED_DATASETS = {
    'security_master': {'ticker','market','security_type'},
    'trading_calendar': {'date','market','is_trading_day'},
    'daily_ohlc': {'date','ticker','market','open','high','low','close','volume','source_id'},
    'corporate_actions': {'ticker','market','effective_date','action_type','source_id'},
    'risk_states': {'ticker','market','date','attention','disposition','suspended','source_id'},
}
SUPPORTED_FORMATS = {'csv','json','jsonl'}


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


def validate_date(s,label):
    s=str(s or '').strip()
    try: datetime.strptime(s,'%Y-%m-%d')
    except: raise ValueError(f'{label}: invalid ISO date {s!r}')
    return s


def ensure_columns(name,rows):
    if not rows: raise ValueError(f'{name}: empty dataset')
    cols=set(rows[0].keys())
    miss=REQUIRED_DATASETS[name]-cols
    if miss: raise ValueError(f'{name}: missing columns {sorted(miss)}')


def validate_security_master(rows):
    seen=set()
    for i,x in enumerate(rows,1):
        t=str(x.get('ticker','')).strip(); m=str(x.get('market','')).strip(); st=str(x.get('security_type','')).strip()
        if not t or m not in {'TWSE','TPEx'}: raise ValueError(f'security_master:{i}: invalid ticker/market')
        if st!='ordinary_stock': raise ValueError(f'security_master:{i}: unsupported security_type {st!r}; ordinary_stock only')
        k=(m,t)
        if k in seen: raise ValueError(f'security_master:{i}: duplicate {k}')
        seen.add(k)
    return seen


def validate_calendar(rows):
    trade=set(); seen=set()
    for i,x in enumerate(rows,1):
        d=validate_date(x.get('date'),f'trading_calendar:{i}'); m=str(x.get('market','')).strip()
        if m not in {'TWSE','TPEx'}: raise ValueError(f'trading_calendar:{i}: invalid market')
        k=(m,d)
        if k in seen: raise ValueError(f'trading_calendar:{i}: duplicate {k}')
        seen.add(k)
        if truth(x.get('is_trading_day')): trade.add(k)
    if not trade: raise ValueError('trading_calendar: no verified trading sessions')
    return trade


def validate_ohlc(rows,master,trade,source_id):
    seen=set(); first=None; last=None; per={}
    for i,x in enumerate(rows,1):
        d=validate_date(x.get('date'),f'daily_ohlc:{i}'); t=str(x.get('ticker','')).strip(); m=str(x.get('market','')).strip(); sid=str(x.get('source_id','')).strip()
        if sid!=source_id: raise ValueError(f'daily_ohlc:{i}: source_id mismatch')
        if (m,t) not in master: raise ValueError(f'daily_ohlc:{i}: security not in ordinary-stock master {(m,t)}')
        if (m,d) not in trade: raise ValueError(f'daily_ohlc:{i}: {d} is not a verified trading session for {m}')
        o,h,l,c=(n(x.get(k)) for k in ('open','high','low','close')); v=n(x.get('volume'))
        if None in (o,h,l,c,v) or min(o,h,l,c)<=0 or v<0: raise ValueError(f'daily_ohlc:{i}: missing/invalid numeric observation')
        if h < max(o,l,c) or l > min(o,h,c): raise ValueError(f'daily_ohlc:{i}: impossible OHLC')
        k=(m,t,d)
        if k in seen: raise ValueError(f'daily_ohlc:{i}: duplicate observation {k}')
        seen.add(k); first=d if first is None or d<first else first; last=d if last is None or d>last else last; per[(m,t)]=per.get((m,t),0)+1
    return {'first_date':first,'last_date':last,'rows':len(rows),'max_bars_per_security':max(per.values()) if per else 0,'securities':len(per)}


def validate_context(name,rows,master,source_id,date_key):
    seen=set()
    for i,x in enumerate(rows,1):
        d=validate_date(x.get(date_key),f'{name}:{i}'); t=str(x.get('ticker','')).strip(); m=str(x.get('market','')).strip(); sid=str(x.get('source_id','')).strip()
        if sid!=source_id: raise ValueError(f'{name}:{i}: source_id mismatch')
        if (m,t) not in master: raise ValueError(f'{name}:{i}: security not in master {(m,t)}')
        k=(m,t,d,str(x.get('action_type','')) if name=='corporate_actions' else '')
        if k in seen: raise ValueError(f'{name}:{i}: duplicate {k}')
        seen.add(k)


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--bundle-dir',required=True)
    ap.add_argument('--provider',required=True)
    ap.add_argument('--source-id',required=True)
    ap.add_argument('--dataset-name',required=True)
    ap.add_argument('--license-name',required=True)
    ap.add_argument('--legal-basis',required=True)
    ap.add_argument('--evidence-reference',required=True)
    ap.add_argument('--automated-processing-allowed',action='store_true')
    ap.add_argument('--derived-outputs-allowed',action='store_true')
    ap.add_argument('--local-storage-allowed',action='store_true')
    ap.add_argument('--raw-redistribution-allowed',action='store_true')
    ap.add_argument('--out',default='manifest.json')
    args=ap.parse_args()

    if not (args.automated_processing_allowed and args.derived_outputs_allowed and args.local_storage_allowed):
        raise SystemExit('LICENCE_GATE_FAIL: automated processing, derived outputs and local storage must all be explicitly allowed')

    root=pathlib.Path(args.bundle_dir).resolve()
    if not root.is_dir(): raise SystemExit('bundle-dir not found')
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

    master=validate_security_master(rows['security_master'])
    trade=validate_calendar(rows['trading_calendar'])
    coverage=validate_ohlc(rows['daily_ohlc'],master,trade,args.source_id)
    validate_context('corporate_actions',rows['corporate_actions'],master,args.source_id,'effective_date')
    validate_context('risk_states',rows['risk_states'],master,args.source_id,'date')

    datasets={}
    for name,(p,fmt) in specs.items():
        datasets[name]={'path':p.name,'sha256':sha256(p),'row_count':len(rows[name]),'format':fmt,'source_ids':[args.source_id]}

    manifest={
      'schema_version':1,
      'bundle_id':f"licensed-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
      'created_at':datetime.now(timezone.utc).isoformat(),
      'provider':args.provider,
      'license':{
        'license_name':args.license_name,
        'legal_basis':args.legal_basis,
        'evidence_reference':args.evidence_reference,
        'automated_processing_allowed':True,
        'derived_outputs_allowed':True,
        'local_storage_allowed':True,
        'raw_redistribution_allowed':bool(args.raw_redistribution_allowed),
      },
      'sources':[{
        'source_id':args.source_id,'provider':args.provider,'dataset_name':args.dataset_name,
        'evidence_reference':args.evidence_reference,'provenance_class':'observed'
      }],
      'coverage':coverage,
      'datasets':datasets,
      'no_imputation':True,
      'network_collection_performed_by_importer':False,
      'raw_publication_permitted':bool(args.raw_redistribution_allowed),
    }
    out=(root/args.out).resolve()
    if root not in out.parents: raise SystemExit('manifest output must remain inside bundle-dir')
    with open(out,'w',encoding='utf-8') as f: json.dump(manifest,f,ensure_ascii=False,indent=2)
    print(json.dumps({'ok':True,'manifest':str(out),'coverage':coverage,'raw_redistribution_allowed':args.raw_redistribution_allowed},ensure_ascii=False,indent=2))

if __name__=='__main__':
    try: main()
    except Exception as e:
        print(f'IMPORT_REJECTED: {e}',file=sys.stderr)
        raise SystemExit(2)
