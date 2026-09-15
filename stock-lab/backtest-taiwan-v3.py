#!/usr/bin/env python3
"""StockLab validation gate.

This file intentionally performs NO network collection.
The former v3 diagnostic runner fetched TWSE/TPEx website historical endpoints even
while declaring their automated-use licence unverified. That contradicted the
StockLab Taiwan Truth Rules. It is now fail-closed.

A future formal backtest must receive a local, dataset-specific legally reusable
historical bundle plus a provenance manifest and must run the production-equivalent
buy, holding-exit and scanner formulas. Until then all three model families remain
BLOCKED_LEGAL_SOURCE.
"""
import argparse
import datetime as dt
import json
from pathlib import Path

NETWORK_HISTORY_COLLECTION_DISABLED = True
LEGACY_MODES_PRODUCTION_VALID = False
ARCHITECTURE = 'buy-holding-separate-v6'


def load_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def validate_status_manifest(x):
    assert x.get('schema_version') == 1, 'model-validation-status schema mismatch'
    assert x.get('architecture') == ARCHITECTURE, 'architecture mismatch'
    assert x.get('legacy_preopen_short_swing_long_result_is_production_valid') is False
    models = x.get('models') or {}
    assert set(models) == {'buy_session', 'holding_exit', 'scanner'}
    for name, item in models.items():
        assert item.get('status') in {'PASS', 'FAIL', 'INSUFFICIENT', 'BLOCKED_LEGAL_SOURCE'}, (name, item)
        if item.get('status') == 'PASS':
            # PASS cannot come from this no-network gate. It must be written by a
            # separate formal workflow with auditable licensed-history provenance.
            raise AssertionError(f'{name}: PASS requires formal licensed-history workflow, not this gate')
        assert item.get('reason'), (name, 'missing reason')
    return models


def blocked_payload(status_path):
    x = load_json(status_path)
    models = validate_status_manifest(x)
    return {
        'schema_version': 6,
        'generated_at': dt.datetime.now(dt.timezone.utc).isoformat(),
        'architecture': ARCHITECTURE,
        'formal_validation_status': 'BLOCKED_LEGAL_SOURCE',
        'network_history_collection_performed': False,
        'network_history_collection_disabled': NETWORK_HISTORY_COLLECTION_DISABLED,
        'legacy_preopen_short_swing_long_result_is_production_valid': LEGACY_MODES_PRODUCTION_VALID,
        'reason': 'No dataset-specific legally reusable historical OHLC bundle is connected. No website-history requests were made.',
        'models': models,
        'requirements': {
            'buy_session': 'licensed history + security master + trading calendar + corporate actions + Taiwan risk states + chronological OOS + costs/slippage + production-formula match',
            'holding_exit': 'licensed history + historical-position protocol + cost-aware frozen formula + corporate actions + Taiwan risk states + chronological OOS + costs/slippage + production-formula match',
            'scanner': 'licensed survivorship-safe TWSE+TPEx history/universe + sector/accounting coverage + chronological OOS + benchmark'
        }
    }


def main():
    ap = argparse.ArgumentParser(description='StockLab fail-closed validation gate; performs no network requests')
    ap.add_argument('--status-manifest', default='stock-lab/model-validation-status.json')
    ap.add_argument('--out', default='stock-lab/backtest-result.json')
    args = ap.parse_args()
    out = blocked_payload(args.status_manifest)
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({
        'formal_validation_status': out['formal_validation_status'],
        'network_history_collection_performed': out['network_history_collection_performed'],
        'models': {k:v['status'] for k,v in out['models'].items()}
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
