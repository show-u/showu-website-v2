#!/usr/bin/env python3
"""StockLab v10 fail-closed model-validation gate.

This gate performs NO network history collection. It validates the repository's
model-status manifest and frozen validation contracts, then preserves their non-PASS
states. A PASS may only be written by a separate formal workflow that receives
legally reusable historical bundles and runs the exact production formula
chronologically out of sample.
"""
import argparse
import datetime as dt
import json
from pathlib import Path

NETWORK_HISTORY_COLLECTION_DISABLED = True
LEGACY_HORIZON_ENTRY_RESULTS_PRODUCTION_VALID = False
ARCHITECTURE = 'unified-entry-holding-v10'
MODEL_KEYS = {'entry_decision_9plus3','entry_scanner_9plus3','holding_exit'}
VALID_NONPASS = {'FAIL','INSUFFICIENT','BLOCKED_LEGAL_SOURCE','BLOCKED_DATA_LAYER'}


def load_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def validate_holding_protocol(x):
    assert x.get('schema_version') == 2, 'holding protocol schema mismatch'
    assert x.get('protocol_name') == 'StockLab TW-holding-exit-v4 OOS Protocol'
    assert x.get('frozen_before_historical_oos') is True
    rules=x.get('non_negotiable_rules') or {}
    for k in (
        'no_horizon_selector','holding_age_uses_exact_verified_trading_sessions',
        'calendar_day_approximation_for_holding_age_forbidden','cost_basis_is_position_specific',
        'shares_do_not_change_signal_without_portfolio_risk_budget','missing_inputs_are_not_imputed',
        'corporate_actions_must_be_adjusted_or_episode_excluded','active_taiwan_risk_state_must_be_known',
        'production_formula_must_equal_test_formula','chronological_oos_required',
        'oos_parameters_may_not_be_tuned_after_viewing_results'):
        assert rules.get(k) is True,k
    stat=x.get('split_and_statistics') or {}
    assert int(stat.get('minimum_oos_episodes_total',0)) >= 300
    assert int(stat.get('minimum_oos_securities',0)) >= 80
    assert set(stat.get('minimum_regime_coverage') or []) == {'bull','bear','sideways'}
    prohibited=set((x.get('pass_rule') or {}).get('prohibited') or [])
    assert any('win rate alone' in z for z in prohibited)
    assert any('retuning thresholds' in z for z in prohibited)
    return x


def validate_status_manifest(x,holding_protocol_path):
    assert x.get('schema_version') == 4, 'model-validation-status schema mismatch'
    assert x.get('architecture') == ARCHITECTURE, 'architecture mismatch'
    assert x.get('legacy_horizon_entry_results_are_production_valid') is False
    models=x.get('models') or {}
    assert set(models)==MODEL_KEYS,set(models)
    holding=models['holding_exit']
    assert holding.get('candidate_formula')=='TW-holding-exit-v4'
    assert holding.get('validation_protocol')==holding_protocol_path
    validate_holding_protocol(load_json(holding_protocol_path))
    for name,item in models.items():
        status=item.get('status')
        assert status in VALID_NONPASS | {'PASS'},(name,item)
        if status=='PASS':
            raise AssertionError(f'{name}: PASS requires formal licensed-history OOS workflow, not this no-network gate')
        assert item.get('reason'),(name,'missing reason')
        assert item.get('required_before_pass'),(name,'missing required_before_pass')
    return models


def blocked_payload(status_path,holding_protocol_path):
    manifest=load_json(status_path)
    models=validate_status_manifest(manifest,holding_protocol_path)
    return {
        'schema_version':10,
        'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),
        'architecture':ARCHITECTURE,
        'formal_validation_status':'BLOCKED_DATA_LAYER',
        'network_history_collection_performed':False,
        'network_history_collection_disabled':NETWORK_HISTORY_COLLECTION_DISABLED,
        'legacy_horizon_entry_results_are_production_valid':LEGACY_HORIZON_ENTRY_RESULTS_PRODUCTION_VALID,
        'holding_protocol_frozen_and_validated':True,
        'reason':'Production v10 requires legally reusable historical OHLC/universe data plus the exact 9+3 entry and actual-position holding formulas. No unlicensed website-history request was made, no missing input was imputed, and no blocked model was promoted to PASS.',
        'models':{k:v['status'] for k,v in models.items()},
        'requirements':{k:v['required_before_pass'] for k,v in models.items()},
        'truth_contract':{
            'missing_data_imputed':False,
            'unverified_source_used_as_fact':False,
            'stale_data_relabelled_current':False,
            'legacy_horizon_buy_model_used':False,
            'oos_required_for_recommendation':True
        }
    }


def main():
    ap=argparse.ArgumentParser(description='StockLab v10 fail-closed validation gate; performs no network requests')
    ap.add_argument('--status-manifest',default='stock-lab/model-validation-status.json')
    ap.add_argument('--holding-protocol',default='stock-lab/holding-exit-validation-protocol.json')
    ap.add_argument('--out',default='stock-lab/backtest-result.json')
    args=ap.parse_args()
    out=blocked_payload(args.status_manifest,args.holding_protocol)
    Path(args.out).write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'formal_validation_status':out['formal_validation_status'],'network_history_collection_performed':out['network_history_collection_performed'],'holding_protocol_frozen_and_validated':out['holding_protocol_frozen_and_validated'],'models':out['models']},ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
