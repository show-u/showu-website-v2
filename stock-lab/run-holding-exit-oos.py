#!/usr/bin/env python3
"""Run the formal StockLab holding/exit OOS gate.

This runner is deliberately fail-closed. It never fabricates historical inputs,
never backfills from unlicensed sources, and never emits performance metrics when
prerequisites are missing. A successful process exit means the OOS pipeline ran;
it does NOT mean the model passed.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_jsonl(path: Path):
    out = []
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            x = json.loads(line)
        except Exception as e:
            raise AssertionError(f"{path}:{n}: invalid json: {e}")
        out.append(x)
    return out


def sha256_file(path: Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", default="stock-lab/history-ogdl/manifest.json")
    ap.add_argument("--history-dir", default="stock-lab/history-ogdl")
    ap.add_argument("--protocol", default="stock-lab/holding-exit-validation-protocol.json")
    ap.add_argument("--production", default="stock-lab/holding-model.js")
    ap.add_argument("--context", default="stock-lab/holding-exit-history-context.json")
    ap.add_argument("--out", default="stock-lab/holding-exit-oos-result.json")
    args = ap.parse_args()

    manifest_path = Path(args.manifest)
    history_dir = Path(args.history_dir)
    protocol_path = Path(args.protocol)
    production_path = Path(args.production)
    context_path = Path(args.context)
    out_path = Path(args.out)

    manifest = load_json(manifest_path)
    protocol = load_json(protocol_path)

    assert manifest.get("source_class") == "ogdl_daily_archive"
    assert manifest.get("licence") == "OGDL-1.0"
    assert manifest.get("no_imputation") is True
    assert protocol.get("frozen_before_historical_oos") is True
    assert (protocol.get("non_negotiable_rules") or {}).get("chronological_oos_required") is True
    assert (protocol.get("non_negotiable_rules") or {}).get("missing_inputs_are_not_imputed") is True
    assert production_path.exists(), "production holding model missing"

    rows = []
    for p in sorted(history_dir.glob("????-??.jsonl")):
        rows.extend(load_jsonl(p))

    # Strict provenance checks on every archived observation used by this runner.
    bad_provenance = []
    security_dates = {}
    for x in rows:
        ok = (
            x.get("source_class") == "ogdl_daily_archive"
            and x.get("licence") == "OGDL-1.0"
            and x.get("provenance") == "observed"
            and bool(x.get("raw_sha256"))
            and bool(x.get("date"))
            and bool(x.get("ticker"))
            and x.get("market") in ("TWSE", "TPEx")
        )
        if not ok:
            bad_provenance.append({k: x.get(k) for k in ("market", "ticker", "date", "source_class", "licence", "provenance")})
            continue
        security_dates.setdefault((x["market"], str(x["ticker"])), set()).add(x["date"])

    min_bars = int((manifest.get("coverage_metrics") or {}).get("holding_exit_minimum_valid_bars") or 120)
    split_cfg = protocol.get("split_and_statistics") or {}
    min_episodes = int(split_cfg.get("minimum_oos_episodes_total") or 300)
    min_securities = int(split_cfg.get("minimum_oos_securities") or 80)
    required_regimes = list(split_cfg.get("minimum_regime_coverage") or [])

    eligible = {k: sorted(v) for k, v in security_dates.items() if len(v) >= min_bars}
    max_bars = max((len(v) for v in security_dates.values()), default=0)

    blockers = []
    if bad_provenance:
        blockers.append(f"歷史資料 provenance 驗證失敗 {len(bad_provenance)} 筆；這些資料不進 OOS。")
    if max_bars < min_bars:
        blockers.append(f"合法歷史日線不足：單檔最多 {max_bars}/{min_bars} 根。")
    if len(eligible) < min_securities:
        blockers.append(f"可進正式 OOS 的股票不足：{len(eligible)}/{min_securities} 檔。")

    # Historical corporate-action / risk-state context is mandatory by the frozen protocol.
    context = None
    context_ok = False
    if context_path.exists():
        context = load_json(context_path)
        context_ok = (
            context.get("schema_version") == 1
            and context.get("no_imputation") is True
            and context.get("licence_verified") is True
            and context.get("corporate_actions_complete") is True
            and context.get("risk_states_complete") is True
            and context.get("trading_calendar_verified") is True
        )
    if not context_ok:
        blockers.append("歷史公司行動／注意處置／停復牌／交易日曆脈絡尚未完整合法驗證；禁止生成正式 OOS episode。")

    # Production formula identity is recorded, but formula_match remains false until
    # the historical evaluator can actually execute the same formula on valid episodes.
    production_sha = sha256_file(production_path)

    # No valid episode may be manufactured from incomplete history/context.
    can_generate = not blockers and len(eligible) >= min_securities
    episodes = 0
    oos_securities = 0
    regimes = []
    execution_validated = False
    confidence_calibrated = False
    production_formula_match = False

    # This runner intentionally does not silently fall back to an OHLC-only proxy.
    # Once all frozen prerequisites exist, a dedicated evaluator must be implemented
    # against this exact production SHA before status can become PASS.
    if can_generate:
        blockers.append("所有資料 Gate 已具備，但 production-equivalent historical evaluator 尚未宣告 PASS；不得以近似公式代替正式 holding-exit OOS。")

    status = "PASS" if (
        episodes >= min_episodes
        and oos_securities >= min_securities
        and set(required_regimes).issubset(set(regimes))
        and execution_validated
        and confidence_calibrated
        and production_formula_match
        and not blockers
    ) else "INSUFFICIENT"

    payload = {
        "schema_version": 1,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "model": "TW-holding-exit-v4",
        "status": status,
        "pipeline_executed": True,
        "principle": "Missing or unlicensed inputs remain unknown. No imputation, no proxy backfill, no fabricated OOS metrics.",
        "source": {
            "class": manifest.get("source_class"),
            "licence": manifest.get("licence"),
            "first_date": manifest.get("first_date"),
            "last_date": manifest.get("last_date"),
            "rows": len(rows),
            "max_valid_bars_per_security": max_bars,
            "securities_with_minimum_history": len(eligible),
            "minimum_valid_bars": min_bars,
            "provenance_rejections": len(bad_provenance),
        },
        "oos_episodes": episodes,
        "oos_securities": oos_securities,
        "minimum_oos_episodes": min_episodes,
        "minimum_oos_securities": min_securities,
        "regimes": regimes,
        "required_regimes": required_regimes,
        "exit_execution_validated": execution_validated,
        "confidence_calibrated": confidence_calibrated,
        "production_formula_match": production_formula_match,
        "production_formula_sha256": production_sha,
        "history_context": {
            "artifact_present": context_path.exists(),
            "validated": context_ok,
            "corporate_actions_complete": bool(context and context.get("corporate_actions_complete") is True),
            "risk_states_complete": bool(context and context.get("risk_states_complete") is True),
            "trading_calendar_verified": bool(context and context.get("trading_calendar_verified") is True),
        },
        "metrics": None,
        "blockers": blockers,
    }

    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
