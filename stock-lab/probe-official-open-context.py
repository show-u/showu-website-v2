#!/usr/bin/env python3
"""Probe official OGDL context resources without persisting bulk raw payloads.

The output is coverage/provenance metadata only. A successful probe does NOT activate a
source for OOS; it merely proves what the official resource actually returned at probe
time. Missing rows/dates are never inferred or imputed.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import re
import urllib.request
from pathlib import Path

UA={'User-Agent':'StockLab-OGDL-context-probe/1.0','Accept':'application/json,text/csv,text/plain;q=0.9,*/*;q=0.1'}


def fetch(url,timeout=40):
    req=urllib.request.Request(url,headers=UA)
    with urllib.request.urlopen(req,timeout=timeout) as r:
        raw=r.read();ctype=(r.headers.get('content-type') or '').lower();final=r.geturl()
    return raw,ctype,final


def norm_key(x):
    return re.sub(r'[\s\ufeff]+','',str(x or '')).strip()


def to_iso(v):
    s=str(v or '').strip().replace('.','/').replace('-','/')
    m=re.search(r'(?<!\d)(\d{2,4})/(\d{1,2})/(\d{1,2})(?!\d)',s)
    if not m:return None
    y,mo,day=map(int,m.groups())
    if y<1911:y+=1911
    try:return dt.date(y,mo,day).isoformat()
    except:return None


def csv_rows(raw):
    text=None
    for enc in ('utf-8-sig','utf-8','big5','cp950'):
        try:text=raw.decode(enc);break
        except UnicodeDecodeError:pass
    if text is None:raise ValueError('unsupported text encoding')
    if '<html' in text[:500].lower():raise ValueError('HTML returned instead of open-data payload')
    rd=csv.DictReader(io.StringIO(text))
    rows=list(rd)
    return rows,[norm_key(x) for x in (rd.fieldnames or [])],'csv'


def tables(obj):
    out=[]
    def walk(x):
        if isinstance(x,dict):
            fields=x.get('fields') or x.get('Fields') or x.get('headers') or x.get('columns')
            data=x.get('data') or x.get('Data') or x.get('rows') or x.get('aaData')
            if isinstance(fields,list) and isinstance(data,list):
                rr=[]
                for row in data:
                    if isinstance(row,dict):rr.append(row)
                    elif isinstance(row,list) and len(row)>=len(fields):rr.append({str(fields[i]):row[i] for i in range(len(fields))})
                if rr:out.append(rr)
            for k in ('data','Data','rows','items','aaData','tables','result','results'):
                v=x.get(k)
                if isinstance(v,list) and v and all(isinstance(z,dict) for z in v):out.append(v)
            for v in x.values():
                if isinstance(v,(dict,list)):walk(v)
        elif isinstance(x,list):
            if x and all(isinstance(z,dict) for z in x):out.append(x)
            for v in x:
                if isinstance(v,(dict,list)):walk(v)
    walk(obj)
    return out


def json_rows(raw,expected):
    obj=json.loads(raw.decode('utf-8-sig'))
    cand=tables(obj)
    if not cand:return [],[],'json'
    exp={norm_key(x) for x in expected}
    def score(rr):
        keys={norm_key(k) for row in rr[:20] for k in row.keys()}
        return (len(keys&exp),len(rr))
    rr=max(cand,key=score)
    cols=sorted({norm_key(k) for row in rr[:100] for k in row.keys()})
    return rr,cols,'json'


def parse_payload(raw,ctype,expected):
    # Respect the actual payload shape; do not substitute or synthesize rows.
    looks_json=raw.lstrip()[:1] in (b'{',b'[') or 'json' in ctype
    if looks_json:
        try:return json_rows(raw,expected)
        except Exception:
            if 'json' in ctype:raise
    return csv_rows(raw)


def locate_date_field(spec,columns):
    wanted=spec.get('knowledge_date_field') or spec.get('effective_date_field')
    if not wanted:
        for x in spec.get('declared_fields') or []:
            if '日期' in str(x):wanted=x;break
    if not wanted and spec.get('role')=='security_lifecycle_partial':wanted='股票上市買賣日期'
    if not wanted:return None
    nk=norm_key(wanted)
    return next((c for c in columns if norm_key(c)==nk),None)


def value_for(row,key):
    if key is None:return None
    nk=norm_key(key)
    for k,v in row.items():
        if norm_key(k)==nk:return v
    return None


def probe_one(cid,spec):
    base={
      'id':cid,'provider':spec.get('provider'),'market':spec.get('market'),'role':spec.get('role'),
      'license':'OGDL-1.0','data_gov_dataset':spec.get('data_gov_dataset'),'official_resource':spec.get('official_resource'),
      'activated':False,'imputation_used':False,
    }
    try:
        raw,ctype,final=fetch(spec['official_resource'])
        rows,cols,parser=parse_payload(raw,ctype,spec.get('declared_fields') or [])
        date_field=locate_date_field(spec,cols)
        dates=[]
        if date_field:
            for row in rows:
                d=to_iso(value_for(row,date_field))
                if d:dates.append(d)
        first=min(dates) if dates else None;last=max(dates) if dates else None
        span=(dt.date.fromisoformat(last)-dt.date.fromisoformat(first)).days if first and last else 0
        declared={norm_key(x) for x in spec.get('declared_fields') or []};actual={norm_key(x) for x in cols}
        field_hits=sorted(declared&actual)
        sufficient_history=bool(len(set(dates))>=120 and span>=365)
        return {**base,
          'fetch_ok':True,'fetched_at':dt.datetime.now(dt.timezone.utc).isoformat(),'final_url':final,
          'content_type':ctype,'payload_bytes':len(raw),'payload_sha256':hashlib.sha256(raw).hexdigest(),
          'parser':parser,'row_count':len(rows),'columns':cols,'declared_field_matches':field_hits,
          'date_field':date_field,'date_rows_parsed':len(dates),'unique_dates':len(set(dates)),
          'first_date':first,'last_date':last,'span_days':span,
          'historical_coverage_candidate':sufficient_history,
          'coverage_status':'HISTORICAL_CANDIDATE' if sufficient_history else 'INSUFFICIENT_OR_UNPROVEN',
          'activation_status':'PROBE_ONLY_NOT_ACTIVATED',
        }
    except Exception as e:
        return {**base,'fetch_ok':False,'fetched_at':dt.datetime.now(dt.timezone.utc).isoformat(),
          'error':str(e),'historical_coverage_candidate':False,'coverage_status':'FETCH_OR_PARSE_FAILED',
          'activation_status':'PROBE_ONLY_NOT_ACTIVATED'}


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--registry',default='stock-lab/official-open-context-registry.json');ap.add_argument('--out',default='stock-lab/official-open-context-coverage.json');args=ap.parse_args()
    reg=json.load(open(args.registry,encoding='utf-8'))
    if reg.get('rules',{}).get('license')!='政府資料開放授權條款-第1版 (OGDL-1.0)':raise SystemExit('registry OGDL licence declaration missing')
    results=[probe_one(cid,spec) for cid,spec in (reg.get('candidates') or {}).items()]
    payload={
      'schema_version':1,'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),
      'purpose':'Derived coverage metadata from official OGDL resources; no bulk raw market payload retained.',
      'license':'OGDL-1.0','attribution':'Government Open Data Platform / providing exchange as identified per candidate.',
      'raw_payload_persisted':False,'imputation_used':False,'any_source_activated':False,
      'results':results,
    }
    Path(args.out).write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'sources':len(results),'fetch_ok':sum(x['fetch_ok'] for x in results),'historical_candidates':sum(x['historical_coverage_candidate'] for x in results),'failed':[x['id'] for x in results if not x['fetch_ok']]},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
