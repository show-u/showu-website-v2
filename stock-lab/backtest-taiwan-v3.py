#!/usr/bin/env python3
"""StockLab v9 fail-closed validation gate.

This gate performs NO network history collection. It only validates the repository's
model-status manifest and emits the same non-PASS states. A PASS may only be written
by a separate formal workflow that receives dataset-specific legally reusable
historical bundles and runs the production-equivalent formula chronologically OOS.
"""
import argparse
import datetime as dt
import json
from pathlib import Path

NETWORK_HISTORY_COLLECTION_DISABLED = True
LEGACY_HORIZON_ENTRY_RESULTS_PRODUCTION_VALID = False
ARCHITECTURE = 'unified-entry-holding-v9'
MODEL_KEYS = {'entry_decision_9plus3','entry_scanner_9plus3','holding_exit'}
VALID_NONPASS = {'FAIL','INSUFFICIENT','BLOCKED_LEGAL_SOURCE','BLOCKED_DATA_LAYER'}


def load_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def validate_status_manifest(x):
    assert x.get('schema_version') == 3, 'model-validation-status schema mismatch'
    assert x.get('architecture') == ARCHITECTURE, 'architecture mismatch'
    assert x.get('legacy_horizon_entry_results_are_production_valid') is False
    models = x.get('models') or {}
    assert set(models) == MODEL_KEYS, set(models)
    for name, item in models.items():
        status = item.get('status')
        assert status in VALID_NONPASS | {'PASS'}, (name, item)
        if status == 'PASS':
            raise AssertionError(f'{name}: PASS requires formal licensed-history OOS workflow, not this no-network gate')
        assert item.get('reason'), (name, 'missing reason')
        assert item.get('required_before_pass'), (name, 'missing required_before_pass')
    return models


def blocked_payload(status_path):
    manifest = load_json(status_path)
    models = validate_status_manifest(manifest)
    return {
        'schema_version': 9,
        'generated_at': dt.datetime.now(dt.timezone.utc).isoformat(),
        'architecture': ARCHITECTURE,
        'formal_validation_status': 'BLOCKED_DATA_LAYER',
        'network_history_collection_performed': False,
        'network_history_collection_disabled': NETWORK_HISTORY_COLLECTION_DISABLED,
        'legacy_horizon_entry_results_are_production_valid': LEGACY_HORIZON_ENTRY_RESULTS_PRODUCTION_VALID,
        'reason': 'Production v9 requires legally reusable historical OHLC/universe data plus the exact 9+3 entry and actual-position holding formulas. No unlicensed website-history request was made, and no blocked model was promoted to PASS.',
        'models': {k:v['status'] for k,v in models.items()},
        'requirements': {k:v['required_before_pass'] for k,v in models.items()},
        'truth_contract': {
            'missing_data_imputed': False,
            'unverified_source_used_as_fact': False,
            'stale_data_relabelled_current': False,
            'oos_required_for_recommendation': True
        }
    }


def main():
    ap = argparse.ArgumentParser(description='StockLab v9 fail-closed validation gate; performs no network requests')
    ap.add_argument('--status-manifest', default='stock-lab/model-validation-status.json')
    ap.add_argument('--out', default='stock-lab/backtest-result.json')
    args = ap.parse_args()
    out = blocked_payload(args.status_manifest)
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({
        'formal_validation_status': out['formal_validation_status'],
        'network_history_collection_performed': out['network_history_collection_performed'],
        'models': out['models']
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
