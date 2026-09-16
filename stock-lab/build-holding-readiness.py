#!/usr/bin/env python3
"""Build a fail-closed readiness snapshot for StockLab's formal holding/exit model.

Licensed historical bundles, when present and independently validated, take precedence
for formal OOS. The OGDL daily archive is a lawful forward archive/fallback only.
Missing history is never imputed and an inactive/candidate source is never promoted.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path


def load(path: str | Path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def sha256(path: Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_licensed_bundle(bundle_dir: Path):
    manifest_path = bundle_dir / "manifest.json"
    if not manifest_path.exists():
        return None
    x = load(manifest_path)
    lic = x.get("license") or {}
    required_rights = (
        lic.get("automated_processing_allowed") is True,
        lic.get("derived_outputs_allowed") is True,
        lic.get("local_storage_allowed") is True,
        x.get("no_imputation") is True,
        x.get("network_collection_performed_by_importer") is False,
    )
    if not all(required_rights):
        return {"valid": False, "reason": "licensed bundle rights/integrity gate failed", "manifest": x}
    datasets = x.get("datasets") or {}
    required = {"security_master", "trading_calendar", "daily_ohlc", "corporate_actions", "risk_states", "market_index"}
    if not required.issubset(datasets):
        return {"valid": False, "reason": "licensed bundle missing required datasets", "manifest": x}
    for name in required:
        meta = datasets[name] or {}
        p = bundle_dir / str(meta.get("path") or "")
        if not p.exists() or sha256(p) != meta.get("sha256"):
            return {"valid": False, "reason": f"licensed bundle checksum failed: {name}", "manifest": x}
    cov = x.get("coverage") or {}
    return {
        "valid": True,
        "kind": "licensed_history_bundle",
        "manifest": x,
        "first_date": cov.get("first_date"),
        "last_date": cov.get("last_date"),
        "max_bars": int(cov.get("max_bars_per_security") or 0),
        "securities": int(cov.get("securities") or 0),
        "licence": lic.get("license_name") or "licensed",
        "provider": x.get("provider"),
        "bundle_id": x.get("bundle_id"),
        "context_complete": True,
    }


def validate_ogdl(manifest_path: Path):
    x = load(manifest_path)
    assert x.get("source_class") == "ogdl_daily_archive"
    assert x.get("licence") == "OGDL-1.0"
    assert x.get("no_imputation") is True
    overall = (x.get("coverage_metrics") or {}).get("overall") or {}
    return {
        "valid": True,
        "kind": "ogdl_daily_archive",
        "manifest": x,
        "first_date": x.get("first_date"),
        "last_date": x.get("last_date"),
        "max_bars": int(overall.get("max_valid_bars_per_security") or 0),
        "securities_at_120": int(overall.get("securities_at_least_120_bars") or 0),
        "licence": "OGDL-1.0",
        "provider": "TWSE/TPEx open data forward archive",
        "bundle_id": None,
        "context_complete": False,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", default="stock-lab/history-ogdl/manifest.json")
    ap.add_argument("--licensed-bundle-dir", default="stock-lab/history-licensed")
    ap.add_argument("--protocol", default="stock-lab/holding-exit-validation-protocol.json")
    ap.add_argument("--sources", default="stock-lab/history-source-registry.json")
    ap.add_argument("--oos", default="stock-lab/holding-exit-oos-result.json")
    ap.add_argument("--out", default="stock-lab/holding-readiness.json")
    args = ap.parse_args()

    protocol = load(args.protocol)
    sources = load(args.sources)
    assert protocol.get("frozen_before_historical_oos") is True

    ogdl = validate_ogdl(Path(args.manifest))
    licensed = validate_licensed_bundle(Path(args.licensed_bundle_dir))
    selected = licensed if licensed and licensed.get("valid") is True else ogdl

    history_min = int(((ogdl["manifest"].get("coverage_metrics") or {}).get("holding_exit_minimum_valid_bars") or 120))
    split_cfg = protocol.get("split_and_statistics") or {}
    min_oos_episodes = int(split_cfg.get("minimum_oos_episodes_total") or 300)
    min_oos_securities = int(split_cfg.get("minimum_oos_securities") or 80)

    max_bars = int(selected.get("max_bars") or 0)
    if selected["kind"] == "licensed_history_bundle":
        securities_min = int((load(args.oos).get("source") or {}).get("securities_with_minimum_history") or 0) if Path(args.oos).exists() else 0
    else:
        securities_min = int(selected.get("securities_at_120") or 0)
    history_pass = max_bars >= history_min and securities_min >= min_oos_securities

    active_sources = []
    active_forward_only = []
    inactive_candidates = []
    licensed_candidates = []
    for key, src in (sources.get("sources") or {}).items():
        status = src.get("status")
        role = src.get("role")
        if status == "active":
            active_sources.append(key)
        elif status == "active_forward_archive_only":
            active_forward_only.append({"id": key, "role": role or "forward_archive_only", "history_backfill": src.get("history_backfill") is True})
        else:
            inactive_candidates.append({"id": key, "status": status or "unknown"})
        if role == "licensed_backfill_candidate" or key in {"twse_eshop_daily_close", "tpex_eshop_basic_group"}:
            licensed_candidates.append({
                "id": key,
                "status": status or "unknown",
                "provider": src.get("provider") or src.get("source") or key,
                "private_staging_importer": src.get("private_staging_importer"),
                "formal_bundle_ready_from_price_alone": src.get("formal_bundle_ready_from_twmd_price_alone"),
            })

    oos = load(args.oos) if Path(args.oos).exists() else None
    if not oos:
        oos_status = "INSUFFICIENT"; oos_episodes = 0; oos_securities = 0
        execution_validated = False; confidence_calibrated = False; formula_match = False; regimes = []
    else:
        oos_status = str(oos.get("status") or "INSUFFICIENT")
        oos_episodes = int(oos.get("oos_episodes") or 0)
        oos_securities = int(oos.get("oos_securities") or 0)
        execution_validated = oos.get("exit_execution_validated") is True
        confidence_calibrated = oos.get("confidence_calibrated") is True
        formula_match = oos.get("production_formula_match") is True
        regimes = list(oos.get("regimes") or [])

    required_regimes = set(split_cfg.get("minimum_regime_coverage") or [])
    regimes_pass = required_regimes.issubset(set(regimes))
    oos_count_pass = oos_episodes >= min_oos_episodes and oos_securities >= min_oos_securities
    oos_pass = oos_status == "PASS" and oos_count_pass and execution_validated and confidence_calibrated and formula_match and regimes_pass

    blockers = []
    if licensed and licensed.get("valid") is False:
        blockers.append(f"授權歷史 bundle 存在但未通過驗證：{licensed.get('reason')}。禁止回退後假稱正式歷史已具備。")
    if not history_pass:
        blockers.append(f"正式歷史資料不足：目前選用 {selected['kind']}，單檔最多 {max_bars}/{history_min} 根，達門檻標的 {securities_min}/{min_oos_securities} 檔。")
    if selected["kind"] == "ogdl_daily_archive":
        blockers.append("主要解法不是等待 OGDL 累積。應取得有明確商業使用、自動處理、衍生分析與公開衍生輸出權利的歷史資料，於私有環境回填後，補齊 PIT-safe 證券生命週期、交易日曆、公司行動、風險狀態與 TWSE/TPEx 市場指數，再經 importer/validator 建立正式 licensed bundle；OGDL 只作每日向前封存備援。")
    if not oos:
        blockers.append("尚無正式持股出場 OOS 結果檔；不得把歷史資料量或研究公式視為模型 PASS。")
    elif not oos_count_pass:
        blockers.append(f"OOS 樣本不足：episodes {oos_episodes}/{min_oos_episodes}、securities {oos_securities}/{min_oos_securities}。")
    if oos and not execution_validated: blockers.append("出場條件／價格尚未通過下一合法交易時段的可執行性驗證。")
    if oos and not confidence_calibrated: blockers.append("信心指數尚未通過獨立樣本外校準。")
    if oos and not formula_match: blockers.append("production formula 與 OOS 測試公式尚未證明一致。")
    if oos and not regimes_pass: blockers.append("牛／熊／盤整市場 regime 覆蓋尚未完整。")

    licensed_valid = bool(licensed and licensed.get("valid") is True)
    payload = {
        "schema_version": 4,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "model": "TW-holding-exit-v4",
        "overall_status": "PASS" if history_pass and oos_pass else "INSUFFICIENT",
        "executable_exit_output": bool(history_pass and oos_pass),
        "principle": "No verified gate, no formal holding/exit recommendation. Missing data is never imputed.",
        "activation_path": {
            "primary": "licensed_historical_backfill",
            "status": "ready_for_oos" if licensed_valid else "pending_licensed_subscription_or_import",
            "requires_waiting_120_trading_days": False,
            "licensed_source_candidates": licensed_candidates,
            "importer": "stock-lab/import-licensed-history.py",
            "private_price_staging_importer": "stock-lab/prepare-twmd-private-backfill.py",
            "post_import_action": "validate licensed bundle, rebuild readiness, then rerun formal holding-exit OOS automatically",
            "raw_licensed_data_publication": "prohibited_unless_explicit_redistribution_right_exists",
            "fallback": "OGDL daily forward archive only; never impute missing past history",
        },
        "selected_history_source": {
            "kind": selected["kind"], "licence": selected.get("licence"), "provider": selected.get("provider"),
            "bundle_id": selected.get("bundle_id"), "first_date": selected.get("first_date"), "last_date": selected.get("last_date"),
            "licensed_bundle_detected": bool(licensed), "licensed_bundle_valid": licensed_valid,
        },
        "history": {
            "status": "PASS" if history_pass else "INSUFFICIENT",
            "max_valid_bars_per_security": max_bars, "minimum_valid_bars": history_min,
            "securities_at_least_minimum": securities_min, "minimum_securities_for_oos": min_oos_securities,
            "no_imputation": True,
        },
        "oos": {
            "status": oos_status, "artifact_present": bool(oos), "episodes": oos_episodes,
            "minimum_episodes": min_oos_episodes, "securities": oos_securities, "minimum_securities": min_oos_securities,
            "required_regimes": sorted(required_regimes), "regimes_present": sorted(set(regimes)),
            "execution_validated": execution_validated, "confidence_calibrated": confidence_calibrated,
            "production_formula_match": formula_match,
        },
        "history_sources": {
            "active": active_sources,
            "active_forward_only": active_forward_only,
            "inactive_candidates": inactive_candidates,
            "rule": "Forward-only OGDL remains active for lawful daily archiving but is never promoted to historical backfill. Candidate-not-subscribed or otherwise inactive sources cannot be used for scoring, OOS, or public predictions."
        },
        "blockers": blockers,
    }
    Path(args.out).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"overall_status":payload["overall_status"],"activation_path":payload["activation_path"],"selected_history_source":payload["selected_history_source"],"history":payload["history"],"oos":payload["oos"],"history_sources":payload["history_sources"],"blockers":blockers},ensure_ascii=False,indent=2))


if __name__ == "__main__":
    main()
