#!/usr/bin/env python3
"""Post-gate for holding OOS evaluator output.

A stock's own trend is never allowed to masquerade as the Taiwan *market* regime.
Formal bull/bear/sideways coverage requires a licensed, checksummed market_index
historical dataset in the same bundle. Missing market-index history remains unknown.
This script never invents regimes or performance data.
"""
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path


def load(p): return json.loads(Path(p).read_text(encoding='utf-8'))
def sha256(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--evaluator',required=True)
    ap.add_argument('--bundle-dir',required=True)
    ap.add_argument('--out',required=True)
    a=ap.parse_args()
    e=load(a.evaluator); root=Path(a.bundle_dir); mp=root/'manifest.json'
    blockers=[]
    if e.get('network_used') is not False or e.get('no_imputation') is not True:
        blockers.append('Evaluator network/no-imputation contract failed.')
    if not mp.exists():
        blockers.append('授權歷史 bundle 不存在。')
    else:
        m=load(mp); d=(m.get('datasets') or {}).get('market_index')
        if not d:
            blockers.append('缺少授權且驗證通過的台股市場指數歷史；禁止以個股自身趨勢冒充 bull/bear/sideways 市場 regime。')
        else:
            p=root/str(d.get('path') or '')
            if not p.exists() or sha256(p)!=d.get('sha256'):
                blockers.append('market_index 資料檔缺漏或 SHA-256 不一致。')
            if not d.get('source_ids'):
                blockers.append('market_index 缺少來源 provenance。')
    if blockers:
        e['regimes']=[]
        e['market_regime_verified']=False
        e['status']='INSUFFICIENT'
        e['market_regime_blockers']=blockers
    else:
        # Presence/checksum/provenance is necessary but not sufficient: the evaluator
        # must explicitly declare that its regime labels were derived from this index.
        if e.get('market_regime_source')!='licensed_market_index':
            e['regimes']=[]
            e['market_regime_verified']=False
            e['status']='INSUFFICIENT'
            e['market_regime_blockers']=['Evaluator 尚未證明 regime 由授權 market_index 逐日推導；禁止宣告市場 regime coverage。']
        else:
            e['market_regime_verified']=True
            e['market_regime_blockers']=[]
    Path(a.out).write_text(json.dumps(e,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':e.get('status'),'market_regime_verified':e.get('market_regime_verified'),'regimes':e.get('regimes'),'blockers':e.get('market_regime_blockers')},ensure_ascii=False,indent=2))

if __name__=='__main__': main()
