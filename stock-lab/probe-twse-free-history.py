#!/usr/bin/env python3
"""Probe and collect free official TWSE monthly daily-trade history.

This tool is intentionally fail-closed:
- official TWSE endpoint only
- no third-party fallback
- no imputation
- raw responses stay outside the public production data path unless separately approved
- every observation retains retrieval/source metadata

Example:
  python stock-lab/probe-twse-free-history.py --stock 2454 --from-month 2025-01 --to-month 2025-03 --out /tmp/twse-2454.jsonl
"""

from __future__ import annotations
import argparse, hashlib, json, sys, time, urllib.parse, urllib.request
from datetime import datetime
from pathlib import Path

ENDPOINT = "https://www.twse.com.tw/exchangeReport/STOCK_DAY"

def parse_args():
    p=argparse.ArgumentParser()
    p.add_argument("--stock", required=True, help="TWSE stock code, e.g. 2454")
    p.add_argument("--from-month", required=True, help="YYYY-MM")
    p.add_argument("--to-month", required=True, help="YYYY-MM")
    p.add_argument("--out", required=True)
    p.add_argument("--sleep", type=float, default=1.0, help="seconds between official requests")
    return p.parse_args()

def months(a,b):
    y,m=map(int,a.split("-")); ey,em=map(int,b.split("-"))
    while (y,m) <= (ey,em):
        yield y,m
        m+=1
        if m==13: y,m=y+1,1

def n(v):
    s=str(v).strip().replace(",","")
    if s in {"","--","---"}: return None
    try: return float(s)
    except ValueError: return None

def roc_to_iso(s):
    s=str(s).strip()
    parts=s.split("/")
    if len(parts)!=3: raise ValueError(f"bad ROC date: {s}")
    return f"{int(parts[0])+1911:04d}-{int(parts[1]):02d}-{int(parts[2]):02d}"

def fetch_month(stock,y,m):
    q=urllib.parse.urlencode({"date":f"{y:04d}{m:02d}01","response":"json","stockNo":stock})
    url=f"{ENDPOINT}?{q}"
    req=urllib.request.Request(url,headers={"User-Agent":"StockLab-FreeOfficialHistory-Probe/1.0"})
    with urllib.request.urlopen(req,timeout=20) as r:
        raw=r.read()
    digest=hashlib.sha256(raw).hexdigest()
    x=json.loads(raw.decode("utf-8"))
    return url,digest,x

def normalize(stock,url,digest,x):
    rows=x.get("data") or []
    out=[]
    for row in rows:
        if len(row)<9: raise ValueError("TWSE STOCK_DAY row has fewer than 9 fields")
        date=roc_to_iso(row[0]); volume=n(row[1]); value=n(row[2]); op=n(row[3]); hi=n(row[4]); lo=n(row[5]); cl=n(row[6]); trades=n(row[8])
        if None in (volume,value,op,hi,lo,cl,trades):
            raise ValueError(f"missing required OHLCV field on {date}")
        if min(op,hi,lo,cl)<=0 or hi<max(op,lo,cl) or lo>min(op,hi,cl):
            raise ValueError(f"impossible OHLC on {date}")
        out.append({
            "ticker":stock,"market":"TWSE","date":date,
            "open":op,"high":hi,"low":lo,"close":cl,
            "volume":volume,"trade_value":value,"trade_count":trades,
            "provenance":"observed","source":"TWSE_STOCK_DAY",
            "source_url":url,"raw_sha256":digest
        })
    return out

def main():
    a=parse_args()
    if not a.stock.isdigit() or not 4 <= len(a.stock) <= 6:
        raise SystemExit("invalid stock code")
    dest=Path(a.out); dest.parent.mkdir(parents=True,exist_ok=True)
    all_rows=[]
    audit=[]
    for y,m in months(a.from_month,a.to_month):
        url,digest,x=fetch_month(a.stock,y,m)
        stat=str(x.get("stat",""))
        rows=normalize(a.stock,url,digest,x) if x.get("data") else []
        audit.append({"month":f"{y:04d}-{m:02d}","stat":stat,"rows":len(rows),"source_url":url,"raw_sha256":digest})
        all_rows.extend(rows)
        time.sleep(max(0,a.sleep))
    seen=set()
    for r in all_rows:
        k=(r["ticker"],r["date"])
        if k in seen: raise SystemExit(f"duplicate observation: {k}")
        seen.add(k)
    all_rows.sort(key=lambda z:z["date"])
    with dest.open("w",encoding="utf-8") as f:
        for r in all_rows: f.write(json.dumps(r,ensure_ascii=False,separators=(",",":"))+"\n")
    report={
        "schema_version":1,
        "purpose":"free official TWSE historical OHLCV probe",
        "ticker":a.stock,
        "requested_from_month":a.from_month,
        "requested_to_month":a.to_month,
        "retrieved_at_utc":datetime.utcnow().isoformat(timespec="seconds")+"Z",
        "rows":len(all_rows),
        "first_date":all_rows[0]["date"] if all_rows else None,
        "last_date":all_rows[-1]["date"] if all_rows else None,
        "no_imputation":True,
        "official_only":True,
        "audit":audit
    }
    Path(str(dest)+".report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=="__main__":
    main()
