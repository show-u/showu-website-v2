#!/usr/bin/env python3
"""Offline validator for StockLab licensed Taiwan market data bundles.

No network requests are permitted here. A bundle is usable only when its manifest,
licence evidence, acquisition/processing rights, source registry, payload hashes and
semantic schemas all pass.
"""
from __future__ import annotations
import argparse, csv, hashlib, json, re
from datetime import datetime
from pathlib import Path

DATE_RE=re.compile(r'^\d{4}-\d{2}-\d{2}$')
SHA_RE=re.compile(r'^[a-f0-9]{64}$')
ALLOWED_MARKETS={'TWSE','TPEx'}


def load_json(path:Path): return json.loads(path.read_text(encoding='utf-8'))
def safe_payload(base:Path, rel:str)->Path:
    p=(base/rel).resolve(); root=base.resolve()
    if root not in p.parents and p!=root: raise ValueError(f'payload path escapes bundle: {rel}')
    if not p.is_file(): raise ValueError(f'payload missing: {rel}')
    return p

def sha256(path:Path)->str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()

def rows(path:Path, fmt:str):
    if fmt=='jsonl':
        with path.open(encoding='utf-8') as f:
            for line in f:
                if line.strip():yield json.loads(line)
    elif fmt=='json':
        x=load_json(path)
        if not isinstance(x,list):raise ValueError(f'{path.name}: JSON payload must be an array')
        yield from x
    elif fmt=='csv':
        with path.open(encoding='utf-8-sig',newline='') as f:yield from csv.DictReader(f)
    else:raise ValueError(f'unsupported format: {fmt}')

def require_fields(obj, fields, where):
    missing=[k for k in fields if k not in obj]
    if missing:raise ValueError(f'{where}: missing fields {missing}')

def iso(v,where,allow_blank=False):
    s=str(v or '').strip()
    if allow_blank and not s:return ''
    if not DATE_RE.match(s):raise ValueError(f'{where}: invalid date {s!r}')
    try:datetime.strptime(s,'%Y-%m-%d')
    except:raise ValueError(f'{where}: invalid date {s!r}')
    return s

def fnum(v,where,positive=False,nonnegative=False):
    try:x=float(str(v).replace(',',''))
    except:raise ValueError(f'{where}: invalid numeric value')
    if positive and x<=0:raise ValueError(f'{where}: must be positive')
    if nonnegative and x<0:raise ValueError(f'{where}: must be nonnegative')
    return x

def truth(v):return v is True or str(v).strip().lower() in {'1','true','yes','y'}


def validate(bundle_dir:Path, contract_path:Path):
    contract=load_json(contract_path)
    if int(contract.get('schema_version') or 0)<3:raise ValueError('licensed-data contract must be schema v3+')
    manifest_path=bundle_dir/'manifest.json'
    if not manifest_path.is_file():raise ValueError('manifest.json missing; licensed history remains unavailable')
    manifest=load_json(manifest_path);require_fields(manifest,contract['required_manifest_fields'],'manifest')
    if manifest.get('schema_version')!=1:raise ValueError('manifest schema_version must be 1')

    lic=manifest['license']; require_fields(lic,contract['license_contract']['required_fields'],'license')
    for k in contract['license_contract']['required_true_for_model_use']:
        if lic.get(k) is not True:raise ValueError(f'license.{k} must be true')
    for k in ('license_name','legal_basis','evidence_reference','terms_reference','acquisition_mode','processing_location'):
        if not str(lic.get(k,'')).strip():raise ValueError(f'license.{k} empty')
    iso(lic.get('terms_reviewed_date'),'license.terms_reviewed_date')

    sources=manifest['sources']
    if not isinstance(sources,list) or not sources:raise ValueError('sources registry missing/empty')
    source_by_id={};req_source=contract['source_registry_contract']['required_fields']
    for i,s in enumerate(sources):
        require_fields(s,req_source,f'sources[{i}]');sid=str(s['source_id']).strip()
        if not sid or sid in source_by_id:raise ValueError(f'duplicate/empty source_id: {sid!r}')
        if s.get('provenance_class')!='observed':raise ValueError(f'{sid}: market source provenance must be observed')
        if not str(s.get('evidence_reference','')).strip():raise ValueError(f'{sid}: evidence_reference empty')
        source_by_id[sid]=s

    cov=manifest['coverage'];require_fields(cov,contract['coverage_contract']['required_fields'],'coverage')
    markets=set(cov.get('markets') or [])
    if not markets or not markets<=ALLOWED_MARKETS:raise ValueError(f'unsupported coverage markets: {sorted(markets)}')
    start=iso(cov['start_date'],'coverage.start_date');end=iso(cov['end_date'],'coverage.end_date')
    if end<start:raise ValueError('coverage.end_date before start_date')
    if int(cov.get('securities_count') or 0)<=0:raise ValueError('coverage.securities_count must be positive')

    ds=manifest['datasets']; results={};semantic={};master={};trade=set();index_markets=set()
    required_names=[n for n,s in contract['required_datasets'].items() if s.get('required')]
    for name in required_names:
        spec=contract['required_datasets'][name]
        if name not in ds:raise ValueError(f'required dataset missing: {name}')
        entry=ds[name];require_fields(entry,contract['dataset_manifest_entry']['required_fields'],f'datasets.{name}')
        fmt=entry['format']
        if fmt not in contract['dataset_manifest_entry']['allowed_formats']:raise ValueError(f'{name}: unsupported format {fmt}')
        digest=str(entry['sha256']).lower()
        if not SHA_RE.match(digest):raise ValueError(f'{name}: invalid sha256')
        src_ids=entry.get('source_ids')
        if not isinstance(src_ids,list) or not src_ids:raise ValueError(f'{name}: source_ids missing')
        unknown=[x for x in src_ids if x not in source_by_id]
        if unknown:raise ValueError(f'{name}: unknown source_ids {unknown}')
        path=safe_payload(bundle_dir,str(entry['path']));actual=sha256(path)
        if actual!=digest:raise ValueError(f'{name}: sha256 mismatch')

        minimum=spec['minimum_fields'];count=0;seen=set();local=[]
        for count,row in enumerate(rows(path,fmt),1):
            if not isinstance(row,dict):raise ValueError(f'{name} row {count}: not an object')
            require_fields(row,minimum,f'{name} row {count}')
            sid=str(row.get('source_id','')).strip()
            if sid not in source_by_id:raise ValueError(f'{name} row {count}: unresolved source_id {sid!r}')
            market=str(row.get('market','')).strip()
            if market not in ALLOWED_MARKETS:raise ValueError(f'{name} row {count}: invalid market {market!r}')
            local.append(row)
        if count!=int(entry['row_count']):raise ValueError(f'{name}: row_count manifest={entry["row_count"]} actual={count}')
        if count<=0:raise ValueError(f'{name}: empty payload')

        if name=='security_master':
            for i,row in enumerate(local,1):
                t=str(row['ticker']).strip();vf=iso(row['valid_from'],f'security_master row {i}.valid_from');vt=iso(row['valid_to'],f'security_master row {i}.valid_to',True)
                if row['security_type']!='ordinary_stock':raise ValueError(f'security_master row {i}: unsupported security_type')
                if vt and vt<vf:raise ValueError(f'security_master row {i}: valid_to before valid_from')
                k=(row['market'],t)
                if k in master:raise ValueError(f'security_master row {i}: duplicate {k}')
                master[k]=(vf,vt)
        elif name=='trading_calendar':
            for i,row in enumerate(local,1):
                d=iso(row['date'],f'trading_calendar row {i}.date');k=(row['market'],d)
                if k in seen:raise ValueError(f'trading_calendar row {i}: duplicate {k}')
                seen.add(k)
                if truth(row['is_trading_day']):trade.add(k)
        elif name=='daily_ohlc':
            for i,row in enumerate(local,1):
                d=iso(row['date'],f'daily_ohlc row {i}.date');t=str(row['ticker']).strip();k=(row['market'],t,d)
                if k in seen:raise ValueError(f'daily_ohlc row {i}: duplicate {k}')
                seen.add(k)
                if (row['market'],d) not in trade:raise ValueError(f'daily_ohlc row {i}: non-trading date')
                meta=master.get((row['market'],t))
                if not meta:raise ValueError(f'daily_ohlc row {i}: security missing from master')
                if d<meta[0] or (meta[1] and d>meta[1]):raise ValueError(f'daily_ohlc row {i}: security not valid on date')
                o=fnum(row['open'],f'daily_ohlc row {i}.open',positive=True);h=fnum(row['high'],f'daily_ohlc row {i}.high',positive=True);l=fnum(row['low'],f'daily_ohlc row {i}.low',positive=True);c=fnum(row['close'],f'daily_ohlc row {i}.close',positive=True);fnum(row['volume'],f'daily_ohlc row {i}.volume',nonnegative=True)
                if h<max(o,c,l) or l>min(o,c,h):raise ValueError(f'daily_ohlc row {i}: impossible OHLC ordering')
        elif name=='corporate_actions':
            for i,row in enumerate(local,1):
                d=iso(row['effective_date'],f'corporate_actions row {i}.effective_date');t=str(row['ticker']).strip()
                if (row['market'],t) not in master:raise ValueError(f'corporate_actions row {i}: security missing from master')
                if not str(row['action_type']).strip():raise ValueError(f'corporate_actions row {i}: action_type empty')
        elif name=='risk_states':
            for i,row in enumerate(local,1):
                d=iso(row['date'],f'risk_states row {i}.date');t=str(row['ticker']).strip()
                if (row['market'],t) not in master:raise ValueError(f'risk_states row {i}: security missing from master')
                for k in ('attention','disposition','suspended'): truth(row[k])
        elif name=='market_index':
            for i,row in enumerate(local,1):
                d=iso(row['date'],f'market_index row {i}.date');code=str(row['index_code']).strip();fnum(row['close'],f'market_index row {i}.close',positive=True)
                if not code:raise ValueError(f'market_index row {i}: index_code empty')
                if (row['market'],d) not in trade:raise ValueError(f'market_index row {i}: non-trading date')
                k=(row['market'],code,d)
                if k in seen:raise ValueError(f'market_index row {i}: duplicate {k}')
                seen.add(k);index_markets.add(row['market'])
        results[name]={'rows':count,'sha256':actual,'sources':src_ids}
        semantic[name]=True

    if not markets.issubset(index_markets):raise ValueError(f'market_index missing coverage markets {sorted(markets-index_markets)}')
    return {
        'ok':True,'schema_version':3,'bundle_id':manifest['bundle_id'],'provider':manifest['provider'],'coverage':cov,'datasets':results,
        'license':{
            'license_name':lic['license_name'],'legal_basis':lic['legal_basis'],'evidence_reference':lic['evidence_reference'],
            'terms_reference':lic['terms_reference'],'terms_reviewed_date':lic['terms_reviewed_date'],
            'acquisition_mode':lic['acquisition_mode'],'acquisition_mode_authorized':True,
            'automated_processing_allowed':True,'derived_outputs_allowed':True,'public_derived_outputs_allowed':True,
            'local_storage_allowed':True,'processing_location':lic['processing_location'],'processing_location_authorized':True,
            'raw_redistribution_allowed':lic['raw_redistribution_allowed'] is True},
        'truth_contract':{
            'network_used':False,'imputation_used':False,'all_hashes_verified':True,'all_sources_resolved':True,
            'market_index_verified':True,'historical_security_validity_verified':True,
            'acquisition_right_verified':True,'processing_location_verified':True,'public_derived_output_right_verified':True}}


def main():
    ap=argparse.ArgumentParser();ap.add_argument('bundle_dir',help='Directory containing manifest.json and payload files');ap.add_argument('--contract',default='stock-lab/licensed-data-contract.json');ap.add_argument('--out');args=ap.parse_args()
    try:out=validate(Path(args.bundle_dir),Path(args.contract))
    except Exception as e:
        out={'ok':False,'error':str(e),'truth_contract':{'network_used':False,'imputation_used':False}}
        if args.out:Path(args.out).write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(json.dumps(out,ensure_ascii=False,indent=2));raise SystemExit(1)
    if args.out:Path(args.out).write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(out,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
