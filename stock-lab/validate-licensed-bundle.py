#!/usr/bin/env python3
"""Offline validator for StockLab licensed Taiwan market data bundles.

No network requests are permitted here. A bundle is usable only when its manifest,
licence evidence flags, source registry, payload hashes and minimum schemas all pass.
"""
from __future__ import annotations
import argparse, csv, hashlib, json, re
from pathlib import Path

DATE_RE=re.compile(r'^\d{4}-\d{2}-\d{2}$')
SHA_RE=re.compile(r'^[a-f0-9]{64}$')
ALLOWED_MARKETS={'TWSE','TPEx'}


def load_json(path:Path):
    return json.loads(path.read_text(encoding='utf-8'))


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


def validate(bundle_dir:Path, contract_path:Path):
    contract=load_json(contract_path); manifest_path=bundle_dir/'manifest.json'
    if not manifest_path.is_file():raise ValueError('manifest.json missing; licensed history remains unavailable')
    manifest=load_json(manifest_path)
    require_fields(manifest,contract['required_manifest_fields'],'manifest')
    if manifest.get('schema_version')!=1:raise ValueError('manifest schema_version must be 1')

    lic=manifest['license']; require_fields(lic,contract['license_contract']['required_fields'],'license')
    for k in contract['license_contract']['required_true_for_model_use']:
        if lic.get(k) is not True:raise ValueError(f'license.{k} must be true')
    if not str(lic.get('evidence_reference','')).strip():raise ValueError('license.evidence_reference empty')

    sources=manifest['sources']
    if not isinstance(sources,list) or not sources:raise ValueError('sources registry missing/empty')
    source_by_id={}
    req_source=contract['source_registry_contract']['required_fields']
    for i,s in enumerate(sources):
        require_fields(s,req_source,f'sources[{i}]'); sid=str(s['source_id']).strip()
        if not sid or sid in source_by_id:raise ValueError(f'duplicate/empty source_id: {sid!r}')
        if s.get('provenance_class')!='observed':raise ValueError(f'{sid}: market source provenance must be observed')
        if not str(s.get('evidence_reference','')).strip():raise ValueError(f'{sid}: evidence_reference empty')
        source_by_id[sid]=s

    cov=manifest['coverage'];require_fields(cov,contract['coverage_contract']['required_fields'],'coverage')
    markets=set(cov.get('markets') or [])
    if not markets or not markets<=ALLOWED_MARKETS:raise ValueError(f'unsupported coverage markets: {sorted(markets)}')
    if not DATE_RE.match(str(cov['start_date'])) or not DATE_RE.match(str(cov['end_date'])):raise ValueError('coverage dates must be YYYY-MM-DD')
    if int(cov.get('securities_count') or 0)<=0:raise ValueError('coverage.securities_count must be positive')

    ds=manifest['datasets']; results={}
    for name,spec in contract['required_datasets'].items():
        if spec.get('required') and name not in ds:raise ValueError(f'required dataset missing: {name}')
        entry=ds[name];require_fields(entry,contract['dataset_manifest_entry']['required_fields'],f'datasets.{name}')
        fmt=entry['format'];
        if fmt not in contract['dataset_manifest_entry']['allowed_formats']:raise ValueError(f'{name}: unsupported format {fmt}')
        digest=str(entry['sha256']).lower()
        if not SHA_RE.match(digest):raise ValueError(f'{name}: invalid sha256')
        src_ids=entry.get('source_ids')
        if not isinstance(src_ids,list) or not src_ids:raise ValueError(f'{name}: source_ids missing')
        unknown=[x for x in src_ids if x not in source_by_id]
        if unknown:raise ValueError(f'{name}: unknown source_ids {unknown}')
        path=safe_payload(bundle_dir,str(entry['path']))
        actual=sha256(path)
        if actual!=digest:raise ValueError(f'{name}: sha256 mismatch')

        minimum=spec['minimum_fields']; count=0
        for count,row in enumerate(rows(path,fmt),1):
            if not isinstance(row,dict):raise ValueError(f'{name} row {count}: not an object')
            require_fields(row,minimum,f'{name} row {count}')
            sid=str(row.get('source_id','')).strip()
            if sid not in source_by_id:raise ValueError(f'{name} row {count}: unresolved source_id {sid!r}')
            market=row.get('market')
            if market not in ALLOWED_MARKETS:raise ValueError(f'{name} row {count}: invalid market {market!r}')
            if name=='daily_ohlc':
                for k in ('open','high','low','close'):
                    try:v=float(row[k])
                    except:raise ValueError(f'{name} row {count}: invalid {k}')
                    if v<=0:raise ValueError(f'{name} row {count}: non-positive {k}')
                try:o,h,l,c=map(float,(row['open'],row['high'],row['low'],row['close']))
                except:raise ValueError(f'{name} row {count}: OHLC parse error')
                if h<max(o,c,l) or l>min(o,c,h):raise ValueError(f'{name} row {count}: impossible OHLC ordering')
                if not DATE_RE.match(str(row['date'])):raise ValueError(f'{name} row {count}: invalid date')
        if count!=int(entry['row_count']):raise ValueError(f'{name}: row_count manifest={entry["row_count"]} actual={count}')
        if count<=0:raise ValueError(f'{name}: empty payload')
        results[name]={'rows':count,'sha256':actual,'sources':src_ids}

    return {
        'ok':True,'schema_version':1,'bundle_id':manifest['bundle_id'],
        'provider':manifest['provider'],'coverage':cov,'datasets':results,
        'license':{
            'license_name':lic['license_name'],'legal_basis':lic['legal_basis'],
            'evidence_reference':lic['evidence_reference'],
            'automated_processing_allowed':True,'derived_outputs_allowed':True,'local_storage_allowed':True,
            'raw_redistribution_allowed':lic['raw_redistribution_allowed'] is True
        },
        'truth_contract':{'network_used':False,'imputation_used':False,'all_hashes_verified':True,'all_sources_resolved':True}
    }


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('bundle_dir',help='Directory containing manifest.json and payload files')
    ap.add_argument('--contract',default='stock-lab/licensed-data-contract.json')
    ap.add_argument('--out')
    args=ap.parse_args()
    try:out=validate(Path(args.bundle_dir),Path(args.contract))
    except Exception as e:
        out={'ok':False,'error':str(e),'truth_contract':{'network_used':False,'imputation_used':False}}
        if args.out:Path(args.out).write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(json.dumps(out,ensure_ascii=False,indent=2));raise SystemExit(1)
    if args.out:Path(args.out).write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(out,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
