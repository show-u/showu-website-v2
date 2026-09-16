#!/usr/bin/env python3
"""Build a fail-closed readiness snapshot for StockLab's formal holding/exit model.

This script never upgrades a model because the UI needs an answer. It only reports
what has actually passed from committed, auditable artifacts.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path


def load(path: str):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", default="stock-lab/history-ogdl/manifest.json")
    ap.add_argument("--protocol", default="stock-lab/holding-exit-validation-protocol.json")
    ap.add_argument("--sources", default="stock-lab/history-source-registry.json")
    ap.add_argument("--oos", default="stock-lab/holding-exit-oos-result.json")
    ap.add_argument("--out", default="stock-lab/holding-readiness.json")
    args = ap.parse_args()

    manifest = load(args.manifest)
    protocol = load(args.protocol)
    sources = load(args.sources)

    assert manifest.get("source_class") == "ogdl_daily_archive"
    assert manifest.get("licence") == "OGDL-1.0"
    assert manifest.get("no_imputation") is True
    assert protocol.get("frozen_before_historical_oos") is True

    overall = (manifest.get("coverage_metrics") or {}).get("overall") or {}
    history_min = int((manifest.get("coverage_metrics") or {}).get("holding_exit_minimum_valid_bars") or 120)
    min_oos_episodes = int((protocol.get("split_and_statistics") or {}).get("minimum_oos_episodes_total") or 300)
    min_oos_securities = int((protocol.get("split_and_statistics") or {}).get("minimum_oos_securities") or 80)

    max_bars = int(overall.get("max_valid_bars_per_security") or 0)
    securities_120 = int(overall.get("securities_at_least_120_bars") or 0)
    history_pass = max_bars >= history_min and securities_120 >= min_oos_securities

    active_sources = []
    inactive_candidates = []
    for key, src in (sources.get("sources") or {}).items():
        status = src.get("status")
        if status == "active":
            active_sources.append(key)
        else:
            inactive_candidates.append({"id": key, "status": status or "unknown"})

    oos_path = Path(args.oos)
    oos = None
    if oos_path.exists():
        oos = load(str(oos_path))

    # No OOS artifact means exactly that: no OOS pass. Never infer a pass from bar counts.
    if not oos:
        oos_status = "INSUFFICIENT"
        oos_episodes = 0
        oos_securities = 0
        execution_validated = False
        confidence_calibrated = False
        formula_match = False
        regimes = []
    else:
        oos_status = str(oos.get("status") or "INSUFFICIENT")
        oos_episodes = int(oos.get("oos_episodes") or 0)
        oos_securities = int(oos.get("oos_securities") or 0)
        execution_validated = oos.get("exit_execution_validated") is True
        confidence_calibrated = oos.get("confidence_calibrated") is True
        formula_match = oos.get("production_formula_match") is True
        regimes = list(oos.get("regimes") or [])

    required_regimes = set((protocol.get("split_and_statistics") or {}).get("minimum_regime_coverage") or [])
    regimes_pass = required_regimes.issubset(set(regimes))
    oos_count_pass = oos_episodes >= min_oos_episodes and oos_securities >= min_oos_securities
    oos_pass = oos_status == "PASS" and oos_count_pass and execution_validated and confidence_calibrated and formula_match and regimes_pass

    blockers = []
    if not history_pass:
        blockers.append(
            f"合法歷史日線不足：單檔最多 {max_bars}/{history_min} 根，達 {history_min} 根的標的 {securities_120} 檔；正式 OOS 至少需覆蓋 {min_oos_securities} 檔。"
        )
    if not oos:
        blockers.append("尚無正式持股出場 OOS 結果檔；不得把歷史資料量或研究公式視為模型 PASS。")
    elif not oos_count_pass:
        blockers.append(f"OOS 樣本不足：episodes {oos_episodes}/{min_oos_episodes}、securities {oos_securities}/{min_oos_securities}。")
    if oos and not execution_validated:
        blockers.append("出場條件／價格尚未通過下一合法交易時段的可執行性驗證。")
    if oos and not confidence_calibrated:
        blockers.append("信心指數尚未通過獨立樣本外校準。")
    if oos and not formula_match:
        blockers.append("production formula 與 OOS 測試公式尚未證明一致。")
    if oos and not regimes_pass:
        blockers.append("牛／熊／盤整市場 regime 覆蓋尚未完整。")

    payload = {
        "schema_version": 1,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "model": "TW-holding-exit-v4",
        "overall_status": "PASS" if history_pass and oos_pass else "INSUFFICIENT",
        "executable_exit_output": bool(history_pass and oos_pass),
        "principle": "No verified gate, no formal holding/exit recommendation. Missing data is never imputed.",
        "history": {
            "status": "PASS" if history_pass else "INSUFFICIENT",
            "first_date": manifest.get("first_date"),
            "last_date": manifest.get("last_date"),
            "max_valid_bars_per_security": max_bars,
            "minimum_valid_bars": history_min,
            "securities_at_least_minimum": securities_120,
            "minimum_securities_for_oos": min_oos_securities,
            "source_class": manifest.get("source_class"),
            "licence": manifest.get("licence"),
            "no_imputation": manifest.get("no_imputation") is True,
        },
        "oos": {
            "status": oos_status,
            "artifact_present": bool(oos),
            "episodes": oos_episodes,
            "minimum_episodes": min_oos_episodes,
            "securities": oos_securities,
            "minimum_securities": min_oos_securities,
            "required_regimes": sorted(required_regimes),
            "regimes_present": sorted(set(regimes)),
            "execution_validated": execution_validated,
            "confidence_calibrated": confidence_calibrated,
            "production_formula_match": formula_match,
        },
        "history_sources": {
            "active": active_sources,
            "inactive_candidates": inactive_candidates,
            "rule": "candidate_not_subscribed or otherwise inactive sources cannot be used for scoring, OOS, or public predictions."
        },
        "blockers": blockers,
    }

    Path(args.out).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"overall_status": payload["overall_status"], "history": payload["history"], "oos": payload["oos"], "blockers": blockers}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
