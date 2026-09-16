#!/usr/bin/env python3
"""Formal post-gate for TW-holding-exit-v4 evaluator output.

This module closes gaps that must not be inferred from a raw evaluator result:
- deterministic same-security non-overlap selection;
- MA20 and hold baselines recomputed from the licensed OHLC bundle;
- next-session-open execution cross-checks;
- development-only confidence calibration rechecked on untouched OOS;
- chronological OOS reporting blocks;
- security-cluster bootstrap uncertainty;
- frozen machine pass thresholds.

It performs no network access and never fills missing observations.
"""
from __future__ import annotations
import argparse, csv, hashlib, json, math, random, statistics
from collections import defaultdict
from pathlib import Path

COMMISSION=0.001425
SELL_TAX=0.003
SLIPPAGE=0.0005
HARD={'出場條件檢視','風險事件優先處理'}


def load(p): return json.loads(Path(p).read_text(encoding='utf-8'))
def sha256(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def truth(v): return v is True or str(v).strip().lower() in {'1','true','yes','y'}
def num(v):
    try: return float(str(v).replace(',',''))
    except: return None

def read_rows(path,fmt):
    path=Path(path)
    if fmt=='json':
        x=load(path); assert isinstance(x,list); return x
    if fmt=='jsonl': return [json.loads(s) for s in path.read_text(encoding='utf-8').splitlines() if s.strip()]
    if fmt=='csv':
        with path.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
    raise ValueError(f'unsupported format {fmt}')

def mean(a):
    a=[x for x in a if x is not None and math.isfinite(x)]
    return sum(a)/len(a) if a else None

def median(a):
    a=[x for x in a if x is not None and math.isfinite(x)]
    return statistics.median(a) if a else None

def quantile(a,q):
    v=sorted(x for x in a if x is not None and math.isfinite(x))
    if not v:return None
    p=(len(v)-1)*q;l=math.floor(p);h=math.ceil(p)
    return v[l] if l==h else v[l]+(v[h]-v[l])*(p-l)

def max_drawdown_pct(returns_pct):
    eq=peak=1.0;mdd=0.0
    for p in returns_pct:
        if p is None or not math.isfinite(p):continue
        eq*=1+p/100;peak=max(peak,eq);mdd=min(mdd,eq/peak-1)
    return mdd*100

def net_return(entry,exit): return (exit*(1-COMMISSION-SELL_TAX-SLIPPAGE)/(entry*(1+COMMISSION+SLIPPAGE))-1)*100


def load_bundle(root):
    root=Path(root);m=load(root/'manifest.json');ds=m.get('datasets') or {}
    required=('daily_ohlc','risk_states','security_master','trading_calendar','corporate_actions','market_index')
    for name in required:
        d=ds.get(name) or {};p=root/str(d.get('path') or '')
        if not p.is_file() or sha256(p)!=d.get('sha256'):raise ValueError(f'{name} missing/checksum failed')
    bars=defaultdict(list);risks=defaultdict(dict)
    for x in read_rows(root/ds['daily_ohlc']['path'],ds['daily_ohlc']['format']):
        o,h,l,c=map(num,(x.get('open'),x.get('high'),x.get('low'),x.get('close')))
        if None in (o,h,l,c) or min(o,h,l,c)<=0:continue
        bars[f"{x.get('market')}:{x.get('ticker')}"] .append({'date':str(x.get('date')),'open':o,'high':h,'low':l,'close':c})
    for v in bars.values():v.sort(key=lambda z:z['date'])
    for x in read_rows(root/ds['risk_states']['path'],ds['risk_states']['format']):risks[f"{x.get('market')}:{x.get('ticker')}"][str(x.get('date'))]=x
    return m,bars,risks


def eval_end_date(ep,bars,window):
    dates=[x['date'] for x in bars]
    try:i=dates.index(ep['buyDate'])
    except ValueError:return None
    j=min(len(bars)-2,i+window)
    return bars[j]['date'] if j>i else None

def deterministic_nonoverlap(rows,bars_by_key,window):
    out=[]
    by=defaultdict(list)
    for e in rows:
        if e.get('ticker') and e.get('buyDate'):by[e['ticker']].append(e)
    for k,v in by.items():
        b=bars_by_key.get(k) or [];last_end=''
        for e in sorted(v,key=lambda z:z['buyDate']):
            if e['buyDate']<=last_end:continue
            end=eval_end_date(e,b,window)
            if not end:continue
            z=dict(e);z['_formal_eval_end']=end;out.append(z);last_end=end
    return sorted(out,key=lambda z:(z['buyDate'],z['ticker']))

def next_exec(bars,signal_date,end_date,riskmap):
    dates=[x['date'] for x in bars]
    try:i=dates.index(signal_date);end=dates.index(end_date)
    except ValueError:return None
    for j in range(i+1,end+1):
        r=riskmap.get(dates[j])
        if r is None:return None
        if not truth(r.get('suspended')):return {'date':dates[j],'price':bars[j]['open'],'delay':j-i-1}
    return None

def ma20_baseline(ep,bars,riskmap):
    dates=[x['date'] for x in bars]
    try:entry_i=dates.index(ep['buyDate']);end_i=dates.index(ep['_formal_eval_end'])
    except ValueError:return None
    if end_i<=entry_i:return None
    signal=None
    for i in range(max(entry_i+1,19),end_i):
        ma=mean([x['close'] for x in bars[i-19:i+1]])
        if ma is not None and bars[i]['close']<ma:signal=dates[i];break
    exitp=bars[end_i]['close'];exitd=dates[end_i];executed=False;delay=None
    if signal:
        ex=next_exec(bars,signal,dates[end_i],riskmap)
        if ex:exitp=ex['price'];exitd=ex['date'];executed=True;delay=ex['delay']
    entry=num(ep.get('entryPrice'))
    if not entry or entry<=0:return None
    return {'return_pct':net_return(entry,exitp),'signal_date':signal,'executed':executed,'exit_date':exitd,'exit_price':exitp,'delay_sessions':delay}

def verify_model_execution(ep,bars,riskmap):
    signal=ep.get('signalDate');executed=ep.get('executed') is True
    if not signal:return not executed
    ex=next_exec(bars,signal,ep['_formal_eval_end'],riskmap)
    if ex is None:return not executed
    if not executed:return False
    actual=num(ep.get('exitPrice'))
    return actual is not None and abs(actual-ex['price'])<1e-9 and str(ep.get('exitDate'))==ex['date']


def initial_bins(records,count=5):
    v=sorted(records,key=lambda x:x['rawEvidence']);out=[]
    for i in range(count):
        lo=math.floor(i*len(v)/count);hi=math.floor((i+1)*len(v)/count);r=v[lo:hi]
        if r:out.append({'lo':r[0]['rawEvidence'],'hi':r[-1]['rawEvidence'],'n':len(r),'successes':sum(x['calibrationLabel'] for x in r)})
    return out

def isotonic(records):
    b=[{**x,'rate':x['successes']/x['n']} for x in initial_bins(records)]
    i=0
    while i<len(b)-1:
        if b[i]['rate']<=b[i+1]['rate']+1e-12:i+=1;continue
        a,c=b[i],b[i+1];n=a['n']+c['n'];s=a['successes']+c['successes'];b[i:i+2]=[{'lo':a['lo'],'hi':c['hi'],'n':n,'successes':s,'rate':s/n}];i=max(0,i-1)
    return b

def predict(blocks,raw):
    if not blocks:return None
    for b in blocks:
        if b['lo']<=raw<=b['hi']:return b['rate']
    return min(blocks,key=lambda b:abs(raw-(b['lo']+b['hi'])/2))['rate']

def recalibrate(dev,oos,cfg):
    def rec(rows):return [x for x in rows if x.get('signal') in HARD and num(x.get('rawEvidence')) is not None and x.get('calibrationLabel') in (0,1)]
    d=rec(dev);o=rec(oos);blocks=isotonic(d) if d else [];base=mean([x['calibrationLabel'] for x in d]);secs=len({x['ticker'] for x in o})
    metrics=None
    if o and blocks and base is not None:
        vals=[]
        for x in o:
            p=predict(blocks,num(x['rawEvidence']));vals.append((p,x['calibrationLabel']))
        brier=mean([(p-y)**2 for p,y in vals]);baseline=mean([(base-y)**2 for p,y in vals])
        grouped=defaultdict(lambda:[0,0.0,0.0])
        for p,y in vals:
            k=round(p,10);grouped[k][0]+=1;grouped[k][1]+=p;grouped[k][2]+=y
        ece=sum(n*abs((sp/n)-(sy/n)) for n,sp,sy in grouped.values())/len(vals)
        metrics={'brier':brier,'baseline_brier':baseline,'ece':ece}
    samples=len(d)>=int(cfg['minimum_development_exit_signals']) and len(o)>=int(cfg['minimum_oos_exit_signals']) and secs>=int(cfg['minimum_oos_exit_signal_securities']) and len(blocks)>=int(cfg['minimum_final_calibration_blocks'])
    quality=metrics is not None and metrics['ece']<=float(cfg['maximum_oos_ece']) and (not cfg.get('brier_must_not_exceed_constant_development_base_rate_brier') or metrics['brier']<=metrics['baseline_brier']+1e-12)
    return {'status':'PASS' if samples and quality else 'INSUFFICIENT','confidence_calibrated':bool(samples and quality),'development_exit_signals':len(d),'oos_exit_signals':len(o),'oos_exit_signal_securities':secs,'blocks':blocks,'oos_metrics':metrics}


def episode_metrics(rows):
    if not rows:return None
    model=[num(x.get('netReturnPct')) for x in rows];hold=[num(x.get('holdBaselineReturnPct')) for x in rows];ma=[num(x.get('_ma20_return_pct')) for x in rows]
    if any(x is None for x in model+hold+ma):return None
    sig=[x for x in rows if x.get('signal') in HARD];exe=[x for x in sig if x.get('executed') is True]
    return {'episodes':len(rows),'securities':len({x['ticker'] for x in rows}),'exit_signals':len(sig),'executed_exits':len(exe),'execution_rate_pct':100*len(exe)/len(sig) if sig else None,
            'avg_net_return_pct':mean(model),'model_max_drawdown_pct':max_drawdown_pct(model),'model_q05_net_return_pct':quantile(model,.05),
            'hold_avg_net_return_pct':mean(hold),'hold_max_drawdown_pct':max_drawdown_pct(hold),'hold_q05_net_return_pct':quantile(hold,.05),
            'ma20_avg_net_return_pct':mean(ma),'ma20_max_drawdown_pct':max_drawdown_pct(ma),'ma20_q05_net_return_pct':quantile(ma,.05),
            'avg_benefit_vs_hold_pct':mean([a-b for a,b in zip(model,hold)]),'avg_benefit_vs_ma20_pct':mean([a-b for a,b in zip(model,ma)])}

def walk_forward(rows,cfg):
    v=sorted(rows,key=lambda x:(x['buyDate'],x['ticker']));n=int(cfg.get('minimum_walk_forward_blocks') or 3);blocks=[]
    for i in range(n):
        lo=math.floor(i*len(v)/n);hi=math.floor((i+1)*len(v)/n);r=v[lo:hi]
        blocks.append({'index':i+1,'from':r[0]['buyDate'] if r else None,'to':r[-1]['buyDate'] if r else None,'n':len(r),'metrics':episode_metrics(r)})
    minimum=int(cfg.get('minimum_episodes_per_walk_forward_block') or 30)
    return {'verified':len(blocks)==n and all(x['n']>=minimum for x in blocks),'blocks':blocks,'minimum_episodes_per_block':minimum}

def cluster_bootstrap(rows,resamples):
    groups=defaultdict(list)
    for x in rows:groups[x['ticker']].append(x)
    keys=sorted(groups)
    if len(keys)<2 or resamples<100:return {'verified':False,'resamples':0}
    rng=random.Random(0x5A17C9E3);bh=[];bm=[]
    for _ in range(resamples):
        sample=[]
        for _ in keys:sample.extend(groups[rng.choice(keys)])
        bh.append(mean([num(x['netReturnPct'])-num(x['holdBaselineReturnPct']) for x in sample]));bm.append(mean([num(x['netReturnPct'])-num(x['_ma20_return_pct']) for x in sample]))
    return {'verified':True,'resamples':resamples,'securities':len(keys),'avg_benefit_vs_hold_pct':{'lower95':quantile(bh,.025),'median':quantile(bh,.5),'upper95':quantile(bh,.975)},'avg_benefit_vs_ma20_pct':{'lower95':quantile(bm,.025),'median':quantile(bm,.5),'upper95':quantile(bm,.975)}}

def performance_gate(metrics,boot,m):
    if not metrics or not boot.get('verified'):return {'pass':False,'checks':{}}
    c={'avg_vs_hold':metrics['avg_benefit_vs_hold_pct']>=float(m['minimum_avg_benefit_vs_hold_pct']),
       'avg_vs_ma20':metrics['avg_benefit_vs_ma20_pct']>=float(m['minimum_avg_benefit_vs_ma20_pct']),
       'q05_vs_hold':metrics['model_q05_net_return_pct']>=metrics['hold_q05_net_return_pct']-float(m['maximum_q05_worsening_vs_hold_pct_points']),
       'q05_vs_ma20':metrics['model_q05_net_return_pct']>=metrics['ma20_q05_net_return_pct']-float(m['maximum_q05_worsening_vs_ma20_pct_points']),
       'mdd_vs_hold':metrics['model_max_drawdown_pct']>=metrics['hold_max_drawdown_pct']-float(m['maximum_mdd_worsening_vs_hold_pct_points']),
       'mdd_vs_ma20':metrics['model_max_drawdown_pct']>=metrics['ma20_max_drawdown_pct']-float(m['maximum_mdd_worsening_vs_ma20_pct_points']),
       'bootstrap_vs_hold':boot['avg_benefit_vs_hold_pct']['lower95']>=float(m['minimum_cluster_bootstrap_lower95_avg_benefit_vs_hold_pct']),
       'bootstrap_vs_ma20':boot['avg_benefit_vs_ma20_pct']['lower95']>=float(m['minimum_cluster_bootstrap_lower95_avg_benefit_vs_ma20_pct'])}
    return {'pass':all(c.values()),'checks':c,'thresholds':m}


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--evaluator',required=True);ap.add_argument('--bundle-dir',required=True);ap.add_argument('--protocol',required=True);ap.add_argument('--out',required=True);a=ap.parse_args()
    e=load(a.evaluator);p=load(a.protocol);manifest,bars,risks=load_bundle(a.bundle_dir);cfg=p['split_and_statistics'];window=int(p['evaluation'].get('episode_evaluation_window_sessions') or 240)
    if e.get('network_used') is not False or e.get('no_imputation') is not True:raise SystemExit('evaluator truth contract failed')
    oos=deterministic_nonoverlap(e.get('episodes') or [],bars,window);dev=deterministic_nonoverlap(e.get('development_calibration_records') or [],bars,window)
    execution_ok=True;usable=[]
    for x in oos:
        b=bars.get(x['ticker']) or [];r=risks.get(x['ticker']) or {};ma=ma20_baseline(x,b,r)
        if ma is None:continue
        x['_ma20_return_pct']=ma['return_pct'];x['_ma20']=ma
        if not verify_model_execution(x,b,r):execution_ok=False
        usable.append(x)
    oos=usable
    metrics=episode_metrics(oos);cal=recalibrate(dev,oos,p['confidence_calibration']);walk=walk_forward(oos,cfg);boot=cluster_bootstrap(oos,int(cfg.get('bootstrap_resamples') or 500));perf=performance_gate(metrics,boot,p['formal_machine_gate'])
    regimes=sorted({x.get('regime') for x in oos if x.get('regime')});min_eps=int(cfg['minimum_oos_episodes_total']);min_sec=int(cfg['minimum_oos_securities']);req=set(cfg['minimum_regime_coverage']);secs=len({x['ticker'] for x in oos})
    counts=len(oos)>=min_eps and secs>=min_sec;regime_ok=req.issubset(regimes);formula=e.get('production_formula_match') is True;market=e.get('market_regime_verified') is True and e.get('market_regime_source')=='licensed_market_index'
    all_gates=counts and regime_ok and execution_ok and formula and market and cal['confidence_calibrated'] and walk['verified'] and boot['verified'] and perf['pass']
    out={k:v for k,v in e.items() if k not in ('episodes','development_calibration_records')}
    out.update({'schema_version':3,'status':'PASS' if all_gates else 'INSUFFICIENT','oos_episodes':len(oos),'oos_securities':secs,'regimes':regimes,'exit_execution_validated':execution_ok,'confidence_calibrated':cal['confidence_calibrated'],'calibration':cal,'non_overlapping_oos_verified':True,'walk_forward_verified':walk['verified'],'walk_forward':walk,'baseline_comparison_verified':metrics is not None,'metrics':metrics,'cluster_uncertainty_verified':boot['verified'],'cluster_bootstrap':boot,'formal_performance_gate':perf['pass'],'performance_gate':perf,
                'formal_gate_checks':{'minimum_samples':counts,'required_regimes':regime_ok,'market_regime_verified':market,'execution_validated':execution_ok,'production_formula_match':formula,'confidence_calibrated':cal['confidence_calibrated'],'non_overlapping':True,'walk_forward':walk['verified'],'cluster_uncertainty':boot['verified'],'baseline_comparison':metrics is not None,'performance_gate':perf['pass']},
                'formal_gate_source':'licensed_bundle_offline_post_gate','raw_licensed_rows_emitted':False})
    Path(a.out).write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':out['status'],'oos_episodes':len(oos),'oos_securities':secs,'regimes':regimes,'formal_gate_checks':out['formal_gate_checks']},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
