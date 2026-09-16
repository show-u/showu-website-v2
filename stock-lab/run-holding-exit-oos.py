#!/usr/bin/env python3
"""Run the formal StockLab holding/exit OOS gate.

Fail-closed rules:
- Prefer a locally supplied, explicitly licensed historical bundle when it passes the
  licence/checksum/data-shape gate.
- Otherwise use only the lawful OGDL forward archive.
- Never scrape/backfill, impute, proxy-fill, or manufacture OOS metrics.
- A successful process exit only means the pipeline ran; it does not mean PASS.
"""
from __future__ import annotations

import argparse, csv, datetime as dt, hashlib, json
from pathlib import Path


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_rows(path: Path, fmt: str):
    if fmt == "json":
        x = load_json(path)
        assert isinstance(x, list), f"{path}: JSON must be array"
        return x
    if fmt == "jsonl":
        out=[]
        for n,line in enumerate(path.read_text(encoding="utf-8").splitlines(),1):
            if not line.strip(): continue
            try: out.append(json.loads(line))
            except Exception as e: raise AssertionError(f"{path}:{n}: invalid json: {e}")
        return out
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def load_ogdl(manifest_path: Path, history_dir: Path):
    manifest=load_json(manifest_path)
    assert manifest.get("source_class")=="ogdl_daily_archive"
    assert manifest.get("licence")=="OGDL-1.0"
    assert manifest.get("no_imputation") is True
    rows=[]
    for p in sorted(history_dir.glob("????-??.jsonl")):
        rows.extend(read_rows(p,"jsonl"))
    bad=[]; dates={}
    for x in rows:
        ok=(x.get("source_class")=="ogdl_daily_archive" and x.get("licence")=="OGDL-1.0" and x.get("provenance")=="observed" and bool(x.get("raw_sha256")) and bool(x.get("date")) and bool(x.get("ticker")) and x.get("market") in ("TWSE","TPEx"))
        if not ok:
            bad.append({k:x.get(k) for k in ("market","ticker","date","source_class","licence","provenance")}); continue
        dates.setdefault((x["market"],str(x["ticker"])),set()).add(x["date"])
    return {
        "kind":"ogdl_daily_archive","manifest":manifest,"rows":rows,"security_dates":dates,
        "bad_provenance":bad,"licence":"OGDL-1.0","provider":"TWSE/TPEx open data forward archive",
        "first_date":manifest.get("first_date"),"last_date":manifest.get("last_date"),"context_complete":False,
    }


def load_licensed(bundle_dir: Path):
    mp=bundle_dir/"manifest.json"
    if not mp.exists(): return None
    m=load_json(mp); lic=m.get("license") or {}
    assert m.get("no_imputation") is True, "licensed bundle no_imputation must be true"
    assert m.get("network_collection_performed_by_importer") is False, "licensed importer must be offline"
    assert lic.get("automated_processing_allowed") is True, "licensed automated processing right missing"
    assert lic.get("derived_outputs_allowed") is True, "licensed derived-output right missing"
    assert lic.get("local_storage_allowed") is True, "licensed local-storage right missing"
    ds=m.get("datasets") or {}; required=("security_master","trading_calendar","daily_ohlc","corporate_actions","risk_states")
    for name in required:
        meta=ds.get(name) or {}; p=bundle_dir/str(meta.get("path") or "")
        assert p.exists(), f"licensed dataset missing: {name}"
        assert sha256_file(p)==meta.get("sha256"), f"licensed checksum mismatch: {name}"
    dm=ds["daily_ohlc"]; rows=read_rows(bundle_dir/dm["path"],str(dm.get("format") or "csv"))
    source_ids={str(s.get("source_id")) for s in (m.get("sources") or []) if s.get("source_id")}
    bad=[]; dates={}
    for x in rows:
        market=str(x.get("market") or "").strip(); ticker=str(x.get("ticker") or "").strip(); date=str(x.get("date") or "").strip(); sid=str(x.get("source_id") or "").strip()
        ok=(market in ("TWSE","TPEx") and bool(ticker) and bool(date) and sid in source_ids)
        if not ok:
            bad.append({"market":market,"ticker":ticker,"date":date,"source_id":sid}); continue
        dates.setdefault((market,ticker),set()).add(date)
    cov=m.get("coverage") or {}
    return {
        "kind":"licensed_history_bundle","manifest":m,"rows":rows,"security_dates":dates,
        "bad_provenance":bad,"licence":lic.get("license_name") or "licensed","provider":m.get("provider"),
        "first_date":cov.get("first_date"),"last_date":cov.get("last_date"),"context_complete":True,
        "bundle_id":m.get("bundle_id"),
    }


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--manifest",default="stock-lab/history-ogdl/manifest.json")
    ap.add_argument("--history-dir",default="stock-lab/history-ogdl")
    ap.add_argument("--licensed-bundle-dir",default="stock-lab/history-licensed")
    ap.add_argument("--protocol",default="stock-lab/holding-exit-validation-protocol.json")
    ap.add_argument("--production",default="stock-lab/holding-model.js")
    ap.add_argument("--context",default="stock-lab/holding-exit-history-context.json")
    ap.add_argument("--out",default="stock-lab/holding-exit-oos-result.json")
    args=ap.parse_args()

    protocol=load_json(Path(args.protocol)); production_path=Path(args.production); context_path=Path(args.context); out_path=Path(args.out)
    assert protocol.get("frozen_before_historical_oos") is True
    rules=protocol.get("non_negotiable_rules") or {}
    assert rules.get("chronological_oos_required") is True and rules.get("missing_inputs_are_not_imputed") is True
    assert production_path.exists(),"production holding model missing"

    licensed=None
    try: licensed=load_licensed(Path(args.licensed_bundle_dir))
    except Exception as e:
        # Existing but invalid licensed data is a hard blocker; do not silently promote it.
        licensed={"invalid":True,"error":str(e)}
    if licensed and not licensed.get("invalid"):
        source=licensed
    else:
        source=load_ogdl(Path(args.manifest),Path(args.history_dir))

    split_cfg=protocol.get("split_and_statistics") or {}
    min_bars=120
    min_episodes=int(split_cfg.get("minimum_oos_episodes_total") or 300)
    min_securities=int(split_cfg.get("minimum_oos_securities") or 80)
    required_regimes=list(split_cfg.get("minimum_regime_coverage") or [])
    eligible={k:sorted(v) for k,v in source["security_dates"].items() if len(v)>=min_bars}
    max_bars=max((len(v) for v in source["security_dates"].values()),default=0)

    blockers=[]
    if licensed and licensed.get("invalid"):
        blockers.append(f"授權歷史 bundle 驗證失敗：{licensed.get('error')}；已禁止使用該 bundle。")
    if source["bad_provenance"]:
        blockers.append(f"歷史資料 provenance 驗證失敗 {len(source['bad_provenance'])} 筆；這些資料不進 OOS。")
    if max_bars<min_bars: blockers.append(f"合法歷史日線不足：單檔最多 {max_bars}/{min_bars} 根。")
    if len(eligible)<min_securities: blockers.append(f"可進正式 OOS 的股票不足：{len(eligible)}/{min_securities} 檔。")

    context=None; context_ok=False
    if source["kind"]=="licensed_history_bundle":
        # The licensed importer requires and checksums trading calendar, corporate actions and risk states.
        context_ok=source.get("context_complete") is True
    elif context_path.exists():
        context=load_json(context_path)
        context_ok=(context.get("schema_version")==1 and context.get("no_imputation") is True and context.get("licence_verified") is True and context.get("corporate_actions_complete") is True and context.get("risk_states_complete") is True and context.get("trading_calendar_verified") is True)
    if not context_ok:
        blockers.append("歷史公司行動／注意處置／停復牌／交易日曆脈絡尚未完整合法驗證；禁止生成正式 OOS episode。")

    production_sha=sha256_file(production_path)
    can_generate=not blockers and len(eligible)>=min_securities
    episodes=0; oos_securities=0; regimes=[]
    execution_validated=False; confidence_calibrated=False; production_formula_match=False

    # Source plumbing is now complete for both licensed history and OGDL. The evaluator
    # must execute the production-equivalent formula; until that evaluator produces a
    # real untouched OOS artifact, no performance number is emitted.
    if can_generate:
        blockers.append("合法歷史與脈絡 Gate 已具備；下一步必須由 production-equivalent evaluator 產生真實 chronological OOS，不得用近似公式或人工數字代替。")

    status="PASS" if (episodes>=min_episodes and oos_securities>=min_securities and set(required_regimes).issubset(set(regimes)) and execution_validated and confidence_calibrated and production_formula_match and not blockers) else "INSUFFICIENT"
    payload={
      "schema_version":2,"generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),"model":"TW-holding-exit-v4","status":status,"pipeline_executed":True,
      "principle":"Missing or unlicensed inputs remain unknown. No imputation, no proxy backfill, no fabricated OOS metrics.",
      "source":{"class":source["kind"],"licence":source.get("licence"),"provider":source.get("provider"),"bundle_id":source.get("bundle_id"),"first_date":source.get("first_date"),"last_date":source.get("last_date"),"rows":len(source["rows"]),"max_valid_bars_per_security":max_bars,"securities_with_minimum_history":len(eligible),"minimum_valid_bars":min_bars,"provenance_rejections":len(source["bad_provenance"])},
      "oos_episodes":episodes,"oos_securities":oos_securities,"minimum_oos_episodes":min_episodes,"minimum_oos_securities":min_securities,"regimes":regimes,"required_regimes":required_regimes,
      "exit_execution_validated":execution_validated,"confidence_calibrated":confidence_calibrated,"production_formula_match":production_formula_match,"production_formula_sha256":production_sha,
      "history_context":{"validated":context_ok,"source":"licensed_bundle_required_datasets" if source["kind"]=="licensed_history_bundle" else "holding-exit-history-context.json"},
      "metrics":None,"blockers":blockers}
    out_path.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(payload,ensure_ascii=False,indent=2))


if __name__=="__main__": main()
