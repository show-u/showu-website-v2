#!/usr/bin/env python3
"""Archive the latest legally reusable TWSE/TPEx daily OHLC snapshot.

Input is stock-lab/browser-data.json, which must already be a licence-registered
OGDL cache. This script performs NO network requests and NO field-name guessing.
It appends normalized valid OHLCV observations to monthly JSONL partitions and
writes an auditable manifest. Missing/invalid fields are rejected, never filled.

Readiness metrics are descriptive only. Reaching a bar-count threshold never
promotes an entry/exit model to PASS; formal OOS, execution and calibration gates
remain separate.
"""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path

SOURCE_CLASS='ogdl_daily_archive'
ARCHIVE_SCHEMA_VERSION=1
ENTRY_MIN_BARS=60
HOLDING_MIN_BARS=120


def load_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def strict_number(v, allow_zero=False):
    if v is None:return None
    s=str(v).strip().replace(',','')
    if not s or s in {'-','--','—','N/A','NA','null','undefined'}:return None
    try:x=float(s)
    except:return None
    if not (x>=0 if allow_zero else x>0):return None
    if x!=x or x in (float('inf'),float('-inf')):return None
    return x


def iso_date(v):
    s=''.join(ch for ch in str(v or '').strip() if ch.isdigit())
    if len(s)==7: # ROC YYYMMDD
        y=int(s[:3])+1911; m=int(s[3:5]); d=int(s[5:7])
    elif len(s)==8: # Gregorian YYYYMMDD
        y=int(s[:4]); m=int(s[4:6]); d=int(s[6:8])
    else:return None
    try:return dt.date(y,m,d).isoformat()
    except:return None


def validate_cache(cache):
    assert cache.get('schema_version')==2,'browser cache schema must be v2'
    assert cache.get('source')=='licensed-open-data-cache','browser cache source not licensed-open-data-cache'
    assert 'OGDL' in str(cache.get('licence','')),'browser cache licence is not OGDL'
    assert isinstance(cache.get('datasets'),dict) and isinstance(cache.get('meta'),dict)


def validate_source_meta(cache,dataset,schema):
    m=cache['meta'].get(dataset) or {}
    assert m.get('data_gov_dataset')==schema['data_gov_dataset'],f'{dataset}: data.gov dataset id mismatch'
    assert m.get('licence')=='OGDL-1.0' and m.get('licence_verified') is True,f'{dataset}: licence not verified'
    sha=str(m.get('sha256') or '')
    assert len(sha)==64 and all(c in '0123456789abcdefABCDEF' for c in sha),f'{dataset}: raw sha256 missing'
    assert m.get('attribution'),f'{dataset}: attribution missing'
    return m


def normalize_rows(cache,schema_name,schema):
    dataset=schema['dataset'];rows=cache['datasets'].get(dataset)
    if not isinstance(rows,list) or not rows:raise AssertionError(f'{dataset}: empty/non-list')
    meta=validate_source_meta(cache,dataset,schema)
    req=set(schema['required_fields']);mapping=schema['mapping'];out=[];rejected=[];dates=set()
    for idx,row in enumerate(rows):
        if not isinstance(row,dict):rejected.append({'index':idx,'reason':'row_not_object'});continue
        missing=sorted(req-set(row))
        if missing:
            # Exact schema only: do not try aliases.
            rejected.append({'index':idx,'reason':'missing_exact_fields','fields':missing});continue
        date=iso_date(row[mapping['date']]);ticker=str(row[mapping['ticker']]).strip();name=str(row[mapping['name']]).strip()
        o=strict_number(row[mapping['open']]);h=strict_number(row[mapping['high']]);l=strict_number(row[mapping['low']]);c=strict_number(row[mapping['close']]);v=strict_number(row[mapping['volume']],allow_zero=True);tv=strict_number(row[mapping['trade_value']],allow_zero=True)
        if not date or not ticker or not name:rejected.append({'index':idx,'ticker':ticker or None,'reason':'invalid_identity_or_date'});continue
        if None in (o,h,l,c,v,tv):rejected.append({'index':idx,'ticker':ticker,'reason':'missing_or_invalid_numeric_observation'});continue
        if not (l<=min(o,c)<=max(o,c)<=h):rejected.append({'index':idx,'ticker':ticker,'reason':'ohlc_invariant_failed'});continue
        dates.add(date)
        out.append({
          'archive_schema_version':ARCHIVE_SCHEMA_VERSION,'market':schema['market'],'ticker':ticker,'name':name,'date':date,
          'open':o,'high':h,'low':l,'close':c,'volume':v,'trade_value':tv,
          'source_id':f"data.gov.tw:{schema['data_gov_dataset']}",'source_class':SOURCE_CLASS,
          'source_schema':schema_name,'raw_sha256':meta['sha256'],'licence':'OGDL-1.0','attribution':meta['attribution'],
          'provenance':'observed'
        })
    if not out:raise AssertionError(f'{dataset}: zero valid OHLC rows after strict schema validation')
    if len(dates)!=1:raise AssertionError(f'{dataset}: expected one official data date, got {sorted(dates)}')
    return out,rejected,meta,next(iter(dates))


def load_partition(path):
    if not path.exists():return []
    out=[]
    for n,line in enumerate(path.read_text(encoding='utf-8').splitlines(),1):
        if not line.strip():continue
        try:x=json.loads(line)
        except Exception as e:raise AssertionError(f'{path}:{n}: invalid json: {e}')
        out.append(x)
    return out


def save_partition(path,rows):
    # Deterministic order and idempotency: same market/ticker/date can exist only once.
    unique={}
    for x in rows:
        k=(x['market'],x['ticker'],x['date'])
        old=unique.get(k)
        if old and old!=x:raise AssertionError(f'conflicting observation for {k}')
        unique[k]=x
    ordered=sorted(unique.values(),key=lambda x:(x['date'],x['market'],x['ticker']))
    path.parent.mkdir(parents=True,exist_ok=True)
    text=''.join(json.dumps(x,ensure_ascii=False,separators=(',',':'),sort_keys=True)+'\n' for x in ordered)
    path.write_text(text,encoding='utf-8')
    return ordered,hashlib.sha256(text.encode('utf-8')).hexdigest()


def readiness_metrics(security_dates,market_dates):
    def stats(items,dates):
        counts=[len(v) for v in items.values()]
        return {
          'distinct_trading_dates':len(dates),
          'securities':len(counts),
          'max_valid_bars_per_security':max(counts) if counts else 0,
          'securities_at_least_60_bars':sum(x>=ENTRY_MIN_BARS for x in counts),
          'securities_at_least_120_bars':sum(x>=HOLDING_MIN_BARS for x in counts)
        }
    by_market={}
    for market in sorted(market_dates):
        sub={ticker:dates for (m,ticker),dates in security_dates.items() if m==market}
        by_market[market]=stats(sub,market_dates[market])
    all_dates=set().union(*market_dates.values()) if market_dates else set()
    overall=stats({f'{m}:{t}':d for (m,t),d in security_dates.items()},all_dates)
    return {
      'entry_minimum_valid_bars':ENTRY_MIN_BARS,
      'holding_exit_minimum_valid_bars':HOLDING_MIN_BARS,
      'overall':overall,
      'by_market':by_market,
      'thresholds_are_history_only':True,
      'does_not_imply_model_oos_pass':True
    }


def rebuild_manifest(root,summaries,rejections):
    files=[];dates=[];markets=set();total=0;security_dates={};market_dates={}
    for p in sorted(root.glob('????-??.jsonl')):
        rows=load_partition(p);sha=hashlib.sha256(p.read_bytes()).hexdigest();d=sorted({x['date'] for x in rows})
        files.append({'file':p.name,'rows':len(rows),'first_date':d[0] if d else None,'last_date':d[-1] if d else None,'sha256':sha})
        total+=len(rows);dates.extend(d)
        for x in rows:
            market=x['market'];ticker=x['ticker'];date=x['date'];markets.add(market)
            market_dates.setdefault(market,set()).add(date)
            security_dates.setdefault((market,ticker),set()).add(date)
    metrics=readiness_metrics(security_dates,market_dates)
    m={
      'schema_version':1,'source_class':SOURCE_CLASS,'licence':'OGDL-1.0','generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),
      'markets':sorted(markets),'first_date':min(dates) if dates else None,'last_date':max(dates) if dates else None,
      'rows':total,'files':files,'latest_ingest':summaries,'latest_rejections':rejections,
      'coverage_metrics':metrics,
      'no_imputation':True,'network_collection_performed_by_archiver':False,
      'note':'History begins when StockLab starts legally archiving licensed daily snapshots; missing earlier dates remain missing until an authorised historical source is ingested. Bar-count thresholds describe history availability only and never mean a model has passed OOS, execution validation or confidence calibration.'
    }
    (root/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return m


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--cache',default='stock-lab/browser-data.json');ap.add_argument('--registry',default='stock-lab/official-schema-registry.json');ap.add_argument('--out-dir',default='stock-lab/history-ogdl');args=ap.parse_args()
    cache=load_json(args.cache);registry=load_json(args.registry);validate_cache(cache)
    assert registry.get('schema_version')==1
    root=Path(args.out_dir);all_new=[];summaries={};rejections={}
    for schema_name in ('twse_stock_day_all_v1','tpex_mainboard_daily_close_quotes_v1'):
        schema=registry['schemas'][schema_name];rows,bad,meta,date=normalize_rows(cache,schema_name,schema);all_new.extend(rows)
        summaries[schema['market']]={'date':date,'accepted':len(rows),'rejected':len(bad),'data_gov_dataset':schema['data_gov_dataset'],'raw_sha256':meta['sha256'],'source_schema':schema_name}
        rejections[schema['market']]={'count':len(bad),'sample':bad[:20]}
    by_month={}
    for x in all_new:by_month.setdefault(x['date'][:7],[]).append(x)
    for month,newrows in by_month.items():
        p=root/f'{month}.jsonl';existing=load_partition(p);save_partition(p,existing+newrows)
    m=rebuild_manifest(root,summaries,rejections)
    cm=m['coverage_metrics'];print(json.dumps({'latest_ingest':summaries,'archive_rows':m['rows'],'first_date':m['first_date'],'last_date':m['last_date'],'files':len(m['files']),'history_readiness':cm},ensure_ascii=False,indent=2))


if __name__=='__main__':main()
