#!/usr/bin/env python3
"""StockLab fail-closed prediction validation gate.

This gate performs NO network history collection. Predictive entry/scanner models
remain blocked until a separate formal workflow proves legal data, chronological OOS,
execution/reachability and calibration. Existing-position management is explicitly a
separate deterministic rule path and is never OOS-locked by this gate.
"""
import argparse
import datetime as dt
import json
from pathlib import Path

NETWORK_HISTORY_COLLECTION_DISABLED = True
LEGACY_HORIZON_ENTRY_RESULTS_PRODUCTION_VALID = False
ARCHITECTURE = 'free-official-first-executable-entry-three-input-actionable-holding-v14'
PREDICTIVE_KEYS = {'entry_decision_9plus3','entry_scanner_9plus3'}
MODEL_KEYS = PREDICTIVE_KEYS | {'holding_rules'}
VALID_PREDICTIVE_NONPASS = {'FAIL','INSUFFICIENT','BLOCKED_LEGAL_SOURCE','BLOCKED_DATA_LAYER'}


def load_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def validate_status_manifest(x):
    assert x.get('schema_version') == 9, 'model-validation-status schema mismatch'
    assert x.get('architecture') == ARCHITECTURE, 'architecture mismatch'
    assert x.get('legacy_horizon_entry_results_are_production_valid') is False
    models=x.get('models') or {}
    assert set(models)==MODEL_KEYS,set(models)
    for name in PREDICTIVE_KEYS:
        item=models[name];status=item.get('status')
        assert status in VALID_PREDICTIVE_NONPASS | {'PASS'},(name,item)
        if status=='PASS':
            raise AssertionError(f'{name}: PASS requires a separate formal licensed-history OOS workflow, not this no-network gate')
        assert item.get('reason'),(name,'missing reason')
        assert item.get('required_before_pass'),(name,'missing required_before_pass')
    holding=models['holding_rules']
    assert holding.get('status')=='AVAILABLE_RULE_BASED'
    assert holding.get('formula')=='TW-holding-rule-v3'
    assert holding.get('oos_required_for_rule_output') is False
    assert holding.get('oos_required_for_statistical_claims') is True
    assert holding.get('confidence_calibrated') is False
    assert holding.get('imputation_allowed') is False
    return models


def blocked_payload(status_path):
    manifest=load_json(status_path)
    models=validate_status_manifest(manifest)
    return {
        'schema_version':10,
        'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),
        'architecture':ARCHITECTURE,
        'formal_prediction_validation_status':'BLOCKED_DATA_LAYER',
        'network_history_collection_performed':False,
        'network_history_collection_disabled':NETWORK_HISTORY_COLLECTION_DISABLED,
        'legacy_horizon_entry_results_are_production_valid':LEGACY_HORIZON_ENTRY_RESULTS_PRODUCTION_VALID,
        'models':{k:v['status'] for k,v in models.items()},
        'requirements':{k:v.get('required_before_pass',v.get('minimum_required',[])) for k,v in models.items()},
        'truth_contract':{
            'missing_data_imputed':False,
            'unverified_source_used_as_fact':False,
            'stale_data_relabelled_current':False,
            'legacy_horizon_buy_model_used':False,
            'predictive_oos_required':True,
            'deterministic_holding_rules_oos_required':False,
            'holding_statistical_claims_oos_required':True
        },
        'reason':'Entry and scanner predictions remain fail-closed. Existing-position holding rules are available only from user position facts and legally verified completed-session market facts; missing enhancements stay unavailable and no statistical confidence is fabricated.'
    }


def main():
    ap=argparse.ArgumentParser(description='StockLab fail-closed prediction validation gate; performs no network requests')
    ap.add_argument('--status-manifest',default='stock-lab/model-validation-status.json')
    ap.add_argument('--out',default='stock-lab/backtest-result.json')
    args=ap.parse_args()
    out=blocked_payload(args.status_manifest)
    Path(args.out).write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'formal_prediction_validation_status':out['formal_prediction_validation_status'],'network_history_collection_performed':out['network_history_collection_performed'],'models':out['models']},ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
