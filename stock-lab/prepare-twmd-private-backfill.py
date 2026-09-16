#!/usr/bin/env python3
"""Prepare PRIVATE TWMD historical OHLC staging for StockLab.

This is deliberately NOT a licensed-bundle builder and never writes manifest.json.
It may only be run in an operator-controlled private environment after the exact plan,
terms and processing rights have been reviewed and retained as evidence.

The script downloads observed TWSE/TPEx daily OHLCV from TWMD, validates every row,
writes a normalized daily_ohlc.csv plus a staging report, and refuses any imputation.
A later StockLab licensed bundle still needs PIT-safe security lifecycle, trading calendar,
corporate actions, risk-state knowledge time and broad-market index context before OOS.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import os
import pathlib
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

API='https://api.twmarketdata.com'
ENDPOINT={'TWSE':'/v2/datasets/twse-daily-price','TPEx':'/v2/datasets/tpex-daily-price'}
REQUIRED_RIGHTS=(
    'commercial_use_allowed',
    'api_acquisition_allowed',
    'automated_processing_allowed',
    'derived_analysis_allowed',
    'public_derived_output_allowed',
    'private_storage_allowed',
    'processing_location_allowed',
)


def fail(msg):
    raise SystemExit(f'TWMD_STAGING_REJECTED: {msg}')


def sha256(path:pathlib.Path)->str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()


def iso(s,label):
    try:return dt.datetime.strptime(str(s),'%Y-%m-%d').date()
    except:fail(f'{label} must be YYYY-MM-DD')


def load_evidence(path:pathlib.Path):
    if not path.is_file():fail('rights evidence JSON is missing')
    x=json.loads(path.read_text(encoding='utf-8'))
    for k in ('provider','plan','terms_reference','terms_reviewed_date','evidence_reference','processing_location'):
        if not str(x.get(k,'')).strip():fail(f'rights evidence missing {k}')
    iso(x['terms_reviewed_date'],'terms_reviewed_date')
    missing=[k for k in REQUIRED_RIGHTS if x.get(k) is not True]
    if missing:fail('explicit entitlement not confirmed: '+', '.join(missing))
    if str(x.get('provider')).strip().lower() not in {'tw market data','twmd'}:fail('rights evidence provider is not TWMD')
    return x


def ensure_private_out(out:pathlib.Path):
    out=out.resolve();cwd=pathlib.Path.cwd().resolve()
    # This repository is public. Raw/staged provider data must not land inside it.
    try:out.relative_to(cwd);fail('output directory is inside the current repository; choose private storage outside the repo')
    except ValueError:pass
    out.mkdir(parents=True,exist_ok=True)
    return out


def load_symbols(path:pathlib.Path):
    if not path.is_file():fail('symbols CSV missing')
    rows=[];seen=set()
    with path.open(encoding='utf-8-sig',newline='') as f:
        for i,x in enumerate(csv.DictReader(f),2):
            ticker=str(x.get('ticker','')).strip();market=str(x.get('market','')).strip()
            if not ticker.isdigit() or len(ticker) not in (4,5,6):fail(f'symbols line {i}: invalid ticker')
            if market not in ENDPOINT:fail(f'symbols line {i}: market must be TWSE or TPEx')
            k=(market,ticker)
            if k in seen:fail(f'symbols line {i}: duplicate {market}/{ticker}')
            seen.add(k);rows.append({'ticker':ticker,'market':market})
    if len(rows)<80:fail(f'formal OOS requires at least 80 securities; symbols file has {len(rows)}')
    return rows


def month_chunks(start:dt.date,end:dt.date):
    cur=start.replace(day=1)
    while cur<=end:
        nxt=(cur.replace(day=28)+dt.timedelta(days=4)).replace(day=1)
        last=min(end,nxt-dt.timedelta(days=1));first=max(start,cur)
        yield first,last;cur=nxt


def get_json(path,params,key,tries=4,timeout=35):
    url=API+path+'?'+urllib.parse.urlencode(params)
    err=None
    for n in range(tries):
        try:
            req=urllib.request.Request(url,headers={'X-API-Key':key,'Accept':'application/json','User-Agent':'StockLab-private-backfill/1.0'})
            with urllib.request.urlopen(req,timeout=timeout) as r:
                if r.status!=200:raise RuntimeError(f'HTTP {r.status}')
                return json.loads(r.read().decode('utf-8'))
        except Exception as e:
            err=e;time.sleep(min(3,0.5*(2**n)))
    raise RuntimeError(f'{url}: {err}')


def numeric(v,label,nonnegative=False):
    try:x=float(str(v).replace(',',''))
    except:raise ValueError(f'{label} invalid numeric')
    if not (x==x):raise ValueError(f'{label} NaN')
    if nonnegative and x<0:raise ValueError(f'{label} negative')
    return x


def validate_price_row(x,market,ticker):
    symbol=str(x.get('symbol','')).strip();date=str(x.get('date','')).strip()
    if symbol!=ticker:raise ValueError(f'ticker mismatch {symbol} != {ticker}')
    iso(date,'price date')
    o=numeric(x.get('open'),'open');h=numeric(x.get('high'),'high');l=numeric(x.get('low'),'low');c=numeric(x.get('close'),'close');v=numeric(x.get('volume_shares'),'volume',True)
    if min(o,h,l,c)<=0:raise ValueError('non-positive OHLC')
    if h<max(o,l,c) or l>min(o,h,c):raise ValueError('impossible OHLC ordering')
    method=str(x.get('price_method') or '').lower()
    if method and method!='official':raise ValueError(f'price_method is not official: {method}')
    return {'date':date,'ticker':ticker,'market':market,'open':o,'high':h,'low':l,'close':c,'volume':v,'source_id':f'twmd_{market.lower()}_daily_price'}


def fetch_symbol(meta,start,end,key):
    market,ticker=meta['market'],meta['ticker'];path=ENDPOINT[market];out={}
    for a,b in month_chunks(start,end):
        j=get_json(path,{'symbol':ticker,'start_date':a.isoformat(),'end_date':b.isoformat(),'limit':500},key)
        rows=j.get('rows')
        if not isinstance(rows,list):raise ValueError(f'{market}/{ticker}: response rows missing')
        role=str(j.get('source_role') or '')
        expected='official_twse' if market=='TWSE' else 'official_tpex'
        if role and role!=expected:raise ValueError(f'{market}/{ticker}: source_role {role} != {expected}')
        for raw in rows:
            z=validate_price_row(raw,market,ticker);d=z['date']
            if d<a.isoformat() or d>b.isoformat():raise ValueError(f'{market}/{ticker}: row outside requested window {d}')
            old=out.get(d)
            if old and old!=z:raise ValueError(f'{market}/{ticker}: conflicting duplicate {d}')
            out[d]=z
    return [out[k] for k in sorted(out)]


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--symbols',required=True,help='CSV with ticker,market; at least 80 unique ordinary-stock candidates')
    ap.add_argument('--start',required=True);ap.add_argument('--end',required=True)
    ap.add_argument('--rights-evidence',required=True,help='private JSON retaining exact plan/terms/permission evidence')
    ap.add_argument('--out-dir',required=True,help='PRIVATE directory outside this public repository')
    ap.add_argument('--workers',type=int,default=4)
    args=ap.parse_args()

    key=os.environ.get('TWMD_API_KEY','').strip()
    if not key:fail('TWMD_API_KEY is not set; key must never be committed to the repository')
    evidence=load_evidence(pathlib.Path(args.rights_evidence));start=iso(args.start,'start');end=iso(args.end,'end')
    if end<start:fail('end before start')
    if (end-start).days<365:fail('requested history is too short for formal holding OOS staging')
    symbols=load_symbols(pathlib.Path(args.symbols));outdir=ensure_private_out(pathlib.Path(args.out_dir))

    all_rows=[];errors=[];per={}
    with ThreadPoolExecutor(max_workers=max(1,min(args.workers,8))) as ex:
        fut={ex.submit(fetch_symbol,s,start,end,key):s for s in symbols}
        for f in as_completed(fut):
            s=fut[f];label=f"{s['market']}/{s['ticker']}"
            try:
                rows=f.result();per[label]=len(rows);all_rows.extend(rows);print(label,len(rows),flush=True)
            except Exception as e:
                errors.append({'security':label,'error':str(e)});print(label,'ERROR',e,file=sys.stderr,flush=True)

    all_rows.sort(key=lambda x:(x['market'],x['ticker'],x['date']))
    path=outdir/'daily_ohlc.csv'
    with path.open('w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=['date','ticker','market','open','high','low','close','volume','source_id']);w.writeheader();w.writerows(all_rows)

    good120=sum(v>=120 for v in per.values());markets=sorted({x['market'] for x in all_rows})
    report={
      'schema_version':1,'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),'stage':'PRIVATE_STAGING_ONLY','formal_bundle_ready':False,
      'provider':'TW Market Data','plan':evidence['plan'],'terms_reference':evidence['terms_reference'],'terms_reviewed_date':evidence['terms_reviewed_date'],'evidence_reference':evidence['evidence_reference'],'processing_location':evidence['processing_location'],
      'rights_gate_passed':True,'no_imputation':True,'network_source':'api.twmarketdata.com','raw_publication_allowed':False,
      'requested':{'start':start.isoformat(),'end':end.isoformat(),'securities':len(symbols)},
      'result':{'rows':len(all_rows),'markets':markets,'securities_returned':len(per),'securities_at_least_120_bars':good120,'errors':errors,'daily_ohlc_sha256':sha256(path)},
      'formal_activation_blockers':[
        'TWMD security-master is an active snapshot and is explicitly not survivorship-safe; a PIT-safe historical security lifecycle is still required.',
        'A verified trading-calendar dataset satisfying StockLab provenance rules is still required; absence of a price row must never be guessed to mean market closure.',
        'PIT-safe corporate-action knowledge dates are still required for historical replay.',
        'Attention/disposition event knowledge time must be PIT-safe; event_date alone must not be treated as the date the information became known.',
        'A broad-market index history is required for every tested market/regime; TWMD market-index currently documents TWSE rows while TPEx needs a separate lawful index source.',
        'Run import-licensed-history.py and validate-licensed-bundle.py only after all required contextual datasets and exact source provenance are supplied.'
      ]
    }
    (outdir/'staging-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'ok':not errors,'stage':'PRIVATE_STAGING_ONLY','rows':len(all_rows),'securities_at_least_120_bars':good120,'errors':len(errors),'out_dir':str(outdir),'formal_bundle_ready':False},ensure_ascii=False,indent=2))
    if errors or good120<80:raise SystemExit(2)

if __name__=='__main__':main()
