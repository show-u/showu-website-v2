#!/usr/bin/env python3
"""Offline orchestration for StockLab TW-holding-exit-v4.

Agreed activation path:
validated licensed history -> production-equivalent evaluator -> licensed market-regime
gate -> strict formal OOS post-gate -> public derived artifact -> readiness rebuild.

Hard boundary:
- No network acquisition is performed here.
- Raw licensed rows stay inside --bundle-dir/private work and are never copied to the public repo.
- Missing/invalid gates stay INSUFFICIENT; nothing is imputed or invented.
- PASS is accepted only when every frozen formal gate is independently true.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
STOCK = ROOT / "stock-lab"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(cmd: list[str]):
    print("+", " ".join(map(str, cmd)), flush=True)
    subprocess.run(cmd, cwd=ROOT, check=True)


def protocol_thresholds(protocol: dict):
    split = protocol.get("split_and_statistics") or {}
    return {
        "minimum_oos_episodes": int(split.get("minimum_oos_episodes_total") or 300),
        "minimum_oos_securities": int(split.get("minimum_oos_securities") or 80),
        "required_regimes": sorted(split.get("minimum_regime_coverage") or ["bull", "bear", "sideways"]),
    }


def public_artifact(formal: dict, manifest: dict, protocol: dict, production: Path):
    th = protocol_thresholds(protocol)
    regimes = sorted(set(formal.get("regimes") or []))
    episodes = int(formal.get("oos_episodes") or 0)
    securities = int(formal.get("oos_securities") or 0)
    calibration = formal.get("calibration") or {}
    metrics = formal.get("metrics") if isinstance(formal.get("metrics"), dict) else None

    gates = {
        "formal_post_gate_pass": formal.get("status") == "PASS",
        "no_imputation": formal.get("no_imputation") is True,
        "network_unused_by_evaluator": formal.get("network_used") is False,
        "market_regime_verified": formal.get("market_regime_verified") is True,
        "minimum_oos_episodes": episodes >= th["minimum_oos_episodes"],
        "minimum_oos_securities": securities >= th["minimum_oos_securities"],
        "required_regimes": set(th["required_regimes"]).issubset(set(regimes)),
        "exit_execution_validated": formal.get("exit_execution_validated") is True,
        "production_formula_match": formal.get("production_formula_match") is True,
        "confidence_calibrated": formal.get("confidence_calibrated") is True and calibration.get("status") == "PASS",
        "formal_performance_gate": formal.get("formal_performance_gate") is True,
        "non_overlapping_oos_verified": formal.get("non_overlapping_oos_verified") is True,
        "walk_forward_verified": formal.get("walk_forward_verified") is True,
        "baseline_comparison_verified": formal.get("baseline_comparison_verified") is True,
        "cluster_uncertainty_verified": formal.get("cluster_uncertainty_verified") is True,
        "metrics_present": metrics is not None,
    }
    blockers = [k for k, ok in gates.items() if not ok]
    status = "PASS" if not blockers else "INSUFFICIENT"
    cov = manifest.get("coverage") or {}
    lic = manifest.get("license") or {}

    return {
        "schema_version": 2,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "model": "TW-holding-exit-v4",
        "status": status,
        "pipeline_executed": True,
        "principle": "Licensed observed inputs only. Missing inputs remain unknown; no imputation, proxy fill or fabricated OOS metrics.",
        "source": {
            "class": "licensed_history_bundle",
            "licence": lic.get("license_name") or "licensed",
            "provider": manifest.get("provider"),
            "bundle_id": manifest.get("bundle_id"),
            "first_date": cov.get("start_date") or cov.get("first_date"),
            "last_date": cov.get("end_date") or cov.get("last_date"),
            "securities_with_minimum_history": securities,
            "minimum_valid_bars": 120,
            "raw_rows_published": False,
        },
        "oos_episodes": episodes,
        "oos_securities": securities,
        "minimum_oos_episodes": th["minimum_oos_episodes"],
        "minimum_oos_securities": th["minimum_oos_securities"],
        "regimes": regimes,
        "required_regimes": th["required_regimes"],
        "exit_execution_validated": gates["exit_execution_validated"],
        "confidence_calibrated": gates["confidence_calibrated"],
        "production_formula_match": gates["production_formula_match"],
        "production_formula_sha256": sha256(production),
        "history_context": {"validated": True, "source": "licensed_bundle_required_datasets"},
        "formal_gates": gates,
        "metrics": metrics,
        "calibration": calibration if gates["confidence_calibrated"] else None,
        "walk_forward": formal.get("walk_forward") if gates["walk_forward_verified"] else None,
        "cluster_bootstrap": formal.get("cluster_bootstrap") if gates["cluster_uncertainty_verified"] else None,
        "performance_gate": formal.get("performance_gate"),
        "blockers": blockers,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundle-dir", required=True, help="Private validated-history candidate directory. Never commit this directory.")
    ap.add_argument("--work-dir", default="stock-lab/private-oos-work")
    ap.add_argument("--contract", default="stock-lab/licensed-data-contract.json")
    ap.add_argument("--protocol", default="stock-lab/holding-exit-validation-protocol.json")
    ap.add_argument("--production", default="stock-lab/holding-model.js")
    ap.add_argument("--public-oos", default="stock-lab/holding-exit-oos-result.json")
    ap.add_argument("--public-readiness", default="stock-lab/holding-readiness.json")
    args = ap.parse_args()

    bundle = Path(args.bundle_dir).resolve()
    work = (ROOT / args.work_dir).resolve() if not Path(args.work_dir).is_absolute() else Path(args.work_dir).resolve()
    contract = (ROOT / args.contract).resolve()
    protocol_path = (ROOT / args.protocol).resolve()
    production = (ROOT / args.production).resolve()
    public_oos = (ROOT / args.public_oos).resolve()
    public_readiness = (ROOT / args.public_readiness).resolve()

    if not bundle.is_dir():
        raise SystemExit(f"licensed bundle directory not found: {bundle}")
    if ROOT in bundle.parents or bundle == ROOT:
        rel = bundle.relative_to(ROOT)
        if not str(rel).startswith("stock-lab/history-licensed") and not str(rel).startswith("stock-lab/private-"):
            raise SystemExit("private licensed bundle must not be staged in a public tracked path")

    work.mkdir(parents=True, exist_ok=True)
    validation = work / "licensed-bundle-validation.json"
    evaluator = work / "holding-evaluator.json"
    regime_gated = work / "holding-evaluator-regime-gated.json"
    formal_gated = work / "holding-evaluator-formal-gated.json"

    # 1) Legal/provenance/schema/hash/semantic gate. Offline only.
    run([sys.executable, str(STOCK / "validate-licensed-bundle.py"), str(bundle), "--contract", str(contract), "--out", str(validation)])
    v = load(validation)
    if v.get("ok") is not True:
        raise SystemExit("licensed bundle validation failed; formal holding output remains locked")
    truth = v.get("truth_contract") or {}
    required_truth = (
        truth.get("network_used") is False,
        truth.get("imputation_used") is False,
        truth.get("all_hashes_verified") is True,
        truth.get("all_sources_resolved") is True,
        truth.get("market_index_verified") is True,
        truth.get("historical_security_validity_verified") is True,
        truth.get("acquisition_right_verified") is True,
        truth.get("processing_location_verified") is True,
        truth.get("public_derived_output_right_verified") is True,
    )
    if not all(required_truth):
        raise SystemExit("licensed bundle truth contract incomplete; formal holding output remains locked")

    # 2) Run the exact production holding formula. Raw episode records stay in the ignored private work directory.
    run(["node", str(STOCK / "holding-oos-evaluator.mjs"), "--bundle-dir", str(bundle), "--production", str(production), "--protocol", str(protocol_path), "--out", str(evaluator)])

    # 3) Prove bull/bear/sideways comes from licensed broad-market history, not from the tested stock itself.
    run([sys.executable, str(STOCK / "gate-holding-evaluator.py"), "--evaluator", str(evaluator), "--bundle-dir", str(bundle), "--out", str(regime_gated)])

    # 4) Formal post-gate: non-overlap, MA20/hold baselines, execution replay, recalibration,
    #    walk-forward blocks, clustered uncertainty and the pre-frozen machine pass thresholds.
    run([sys.executable, str(STOCK / "formalize-holding-oos.py"), "--evaluator", str(regime_gated), "--bundle-dir", str(bundle), "--protocol", str(protocol_path), "--out", str(formal_gated)])

    # 5) Publish only aggregate derived evidence. Never publish licensed raw rows or episode rows.
    formal = load(formal_gated)
    manifest = load(bundle / "manifest.json")
    protocol = load(protocol_path)
    public = public_artifact(formal, manifest, protocol, production)
    public_oos.write_text(json.dumps(public, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # 6) Rebuild readiness. Public exit recommendations unlock only when every real gate is PASS.
    run([sys.executable, str(STOCK / "build-holding-readiness.py"), "--licensed-bundle-dir", str(bundle), "--protocol", str(protocol_path), "--oos", str(public_oos), "--out", str(public_readiness)])

    print(json.dumps({
        "status": public["status"],
        "oos_episodes": public["oos_episodes"],
        "oos_securities": public["oos_securities"],
        "regimes": public["regimes"],
        "formal_gates": public["formal_gates"],
        "blockers": public["blockers"],
        "public_oos": str(public_oos),
        "public_readiness": str(public_readiness),
        "private_work_dir": str(work),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
