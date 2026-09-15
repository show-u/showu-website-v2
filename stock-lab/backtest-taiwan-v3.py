#!/usr/bin/env python3
"""StockLab validation gate.

This file intentionally performs NO network collection.
The former diagnostic runner fetched website historical endpoints even while their
automated-use licence was unverified. That contradicted StockLab Taiwan Truth Rules.
It is now fail-closed.

A future formal backtest must receive local, dataset-specific legally reusable
historical bundles plus provenance manifests and run production-equivalent formulas.
Buy-session, holding-exit, momentum, growth, income and total-return models are
independent validation targets. No scanner strategy may inherit another strategy's
PASS.
"""
import argparse
import datetime as dt
import json
from pathlib import Path

NETWORK_HISTORY_COLLECTION_DISABLED = True
LEGACY_MODES_PRODUCTION_VALID = False
ARCHITECTURE = 'buy-holding-strategy-scanner-v7'
MODEL_KEYS = {
    'buy_session','holding_exit','scanner_momentum','scanner_growth','scanner_income','scanner_total_return'
}
VALID_NONPASS = {'FAIL','INSUFFICIENT','BLOCKED_LEGAL_SOURCE','BLOCKED_DATA_LAYER'}


def load_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def validate_status_manifest(x):
    assert x.get('schema_version') == 2, 'model-validation-status schema mismatch'
    assert x.get('architecture') == ARCHITECTURE, 'architecture mismatch'
    assert x.get('legacy_preopen_short_swing_long_result_is_production_valid') is False
    models = x.get('models') or {}
    assert set(models) == MODEL_KEYS, set(models)
    for name, item in models.items():
        status=item.get('status')
        assert status in VALID_NONPASS|{'PASS'}, (name, item)
        if status == 'PASS':
            raise AssertionError(f'{name}: PASS requires formal licensed-history workflow, not this no-network gate')
        assert item.get('reason'), (name, 'missing reason')
    return models


def blocked_payload(status_path):
    x = load_json(status_path)
    models = validate_status_manifest(x)
    return {
        'schema_version': 7,
        'generated_at': dt.datetime.now(dt.timezone.utc).isoformat(),
        'architecture': ARCHITECTURE,
        'formal_validation_status': 'BLOCKED_LEGAL_SOURCE',
        'network_history_collection_performed': False,
        'network_history_collection_disabled': NETWORK_HISTORY_COLLECTION_DISABLED,
        'legacy_preopen_short_swing_long_result_is_production_valid': LEGACY_MODES_PRODUCTION_VALID,
        'reason': 'No dataset-specific legally reusable historical OHLC bundle is connected. No website-history requests were made. Dividend-history production layer is also not yet connected.',
        'models': {k:v['status'] for k,v in models.items()},
        'requirements': {
            'buy_session': 'licensed history + security master + trading calendar + corporate actions + Taiwan risk states + chronological OOS + costs/slippage + production-formula match',
            'holding_exit': 'licensed history + historical-position protocol + cost-aware frozen formula + corporate actions + Taiwan risk states + chronological OOS + costs/slippage + production-formula match',
            'scanner_momentum': 'licensed survivorship-safe TWSE+TPEx history/universe + frozen technical/liquidity factors + strategy-specific chronological OOS + benchmark',
            'scanner_growth': 'licensed history/universe + historical monthly revenue + accounting-class-correct quarterly financials + strategy-specific chronological OOS + benchmark',
            'scanner_income': 'licensed history/universe + >=3-year verified cash/stock dividend history + financial support + valuation + ex-right/ex-dividend events + strategy-specific chronological OOS',
            'scanner_total_return': 'licensed history/universe + historical growth/fundamentals + verified dividend history even when zero + valuation + strategy-specific chronological OOS + benchmark'
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
        'models': out['models']
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
