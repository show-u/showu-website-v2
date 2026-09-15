#!/usr/bin/env python3
import argparse, datetime as dt, glob, importlib.util, json, os
from concurrent.futures import ThreadPoolExecutor, as_completed

spec=importlib.util.spec_from_file_location('legacy','stock-lab/backtest-model.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
SLIPPAGE_EACH_SIDE=0.0005
MODES=('preopen','short','swing','long')


def structure_band(b,i,mode):
    # Short/swing/long remain structure + volatility pullback models.
    # Pre-open is handled separately as an opening-auction model below.
    if mode=='preopen':return None
    c=[x.close for x in b];L=b[i];a=m.atr(b,i)
    if a is None:return None
    look,ma_p,mult=(20,20,.45) if mode=='short' else (60,60,.70) if mode=='swing' else (240,120,1.0)
    if i+1<look:return None
    w=b[i-look+1:i+1];ma=m.avg(c[i-ma_p+1:i+1]);qlow=m.qtile([x.low for x in w],.20);recent=min(x.low for x in w[-10:])
    support=max(qlow,min(ma,L.close),recent-a*.6)
    lo=max(.01,qlow,support-a*mult);hi=min(L.close,support+a*({'short':.25,'swing':.35,'long':.5}[mode]))
    if lo>hi:lo=max(.01,min(support,L.close));hi=max(lo,min(L.close,support))
    stop=max(.01,support-a*({'short':.9,'swing':1.2,'long':1.6}[mode]))
    return m.rt(lo,'up'),m.rt(hi,'down'),m.rt(stop,'down')


def realistic_costs(mode):
    tax=m.TAX_DAYTRADE if mode=='preopen' else m.TAX_NORMAL
    return 2*m.COMMISSION+tax+2*SLIPPAGE_EACH_SIDE


def empirical_gap_stats(b,i,look=60):
    z=[]
    start=max(1,i-look+1)
    for j in range(start,i+1):
        pc=b[j-1].close;o=b[j].open
        if pc and pc>0 and o and o>0:z.append(o/pc-1)
    if len(z)<20:return None
    return {'n':len(z),'q25':m.qtile(z,.25),'q50':m.qtile(z,.50),'q75':m.qtile(z,.75)}


def empirical_intraday_stats(b,i,look=60):
    lows=[];highs=[]
    for x in b[max(0,i-look+1):i+1]:
        if x.open and x.open>0:
            lows.append(x.low/x.open-1);highs.append(x.high/x.open-1)
    if len(lows)<20:return None
    return {
      'n':len(lows),
      'low10':m.qtile(lows,.10),'low25':m.qtile(lows,.25),'low50':m.qtile(lows,.50),
      'high50':m.qtile(highs,.50),'high75':m.qtile(highs,.75)
    }


_legacy_evaluate=m.evaluate

def evaluate_taiwan(b,signal_i,mode):
    if mode!='preopen':return _legacy_evaluate(b,signal_i,mode)
    if signal_i+1>=len(b):return None,signal_i+1
    gap=empirical_gap_stats(b,signal_i);exc=empirical_intraday_stats(b,signal_i)
    if not gap or not exc:return None,signal_i+1

    prior_close=b[signal_i].close
    order=m.rt(prior_close*(1+gap['q50']),'nearest')
    nxt=b[signal_i+1]

    # A pre-open ROD buy limit participates in the 09:00 opening auction.
    # It fills only when the auction opening price is at or below the limit.
    # We do NOT treat an intraday touch of a deep support price as a pre-open fill.
    if nxt.open>order:
        return {
          'filled':False,'signal_date':b[signal_i].date,'order_price':order,
          'prior_close':prior_close,'actual_open':nxt.open,'gap_sample_n':gap['n']
        },signal_i+1

    entry=nxt.open
    expected_open=prior_close*(1+gap['q50'])
    stop=m.rt(max(.01,expected_open*(1+exc['low10'])),'down')
    exitp=nxt.close;exit_i=signal_i+1
    if nxt.low<=stop:exitp=stop
    gross=exitp/entry-1;net=gross-realistic_costs(mode)
    mfe=nxt.high/entry-1;mae=nxt.low/entry-1
    return {
      'filled':True,'signal_date':b[signal_i].date,'entry_date':nxt.date,'exit_date':nxt.date,
      'entry':entry,'exit':exitp,'order_price':order,'prior_close':prior_close,
      'expected_open':m.rt(expected_open),'actual_open':nxt.open,'gap_sample_n':gap['n'],
      'net_return_pct':net*100,'gross_return_pct':gross*100,
      'mfe_pct':mfe*100,'mae_pct':mae*100,'cost_pct':realistic_costs(mode)*100
    },signal_i+2


m.band=structure_band
m.costs=realistic_costs
m.evaluate=evaluate_taiwan


def run_stocks(universe,months,workers=4):
    results=[]
    with ThreadPoolExecutor(max_workers=workers) as ex:
        fut={ex.submit(m.test_stock,x,months):x for x in universe}
        for f in as_completed(fut):
            x=fut[f]
            try:r=f.result()
            except Exception as e:r={'ticker':x['ticker'],'market':x['market'],'industry':x.get('industry'),'error':str(e)}
            results.append(r);print(x['ticker'],'OK' if 'error' not in r else r['error'],flush=True)
    return results


def aggregate_result(results):
    agg={}
    for mode in MODES:
        agg[mode]={s:m.aggregate(results,mode,s) for s in ('all','insample','oos')}
        agg[mode]['stress_status']=m.stress_status(agg[mode]['oos'])
    return agg


def final_payload(results,requested,months):
    unique={}
    for x in results:unique[(x.get('market',''),x.get('ticker',''))]=x
    results=list(unique.values());agg=aggregate_result(results)
    return {
      'schema_version':3,
      'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),
      'market':'TWSE+TPEx',
      'method':'Taiwan model: preopen uses verified prior close plus rolling empirical overnight-gap median and opening-auction fill logic; short/swing/long use structure/quantile/MA/ATR pullback bands; no fixed price-percentage entry bands; 70/30 chronological OOS; non-overlapping trades; transaction tax, commission and slippage included.',
      'preopen_semantics':'Buy limit ROD is filled only when next-session opening auction price <= order price; intraday support touches do not count as pre-open fills.',
      'cost_assumptions':{
        'commission_each_side_pct':m.COMMISSION*100,
        'normal_stock_sell_tax_pct':m.TAX_NORMAL*100,
        'daytrade_sell_tax_pct':m.TAX_DAYTRADE*100,
        'slippage_each_side_pct':SLIPPAGE_EACH_SIDE*100},
      'universe_requested':requested,
      'universe_ok':sum('error' not in x for x in results),
      'months':months,
      'aggregate':agg,
      'stocks':sorted(results,key=lambda x:(x.get('market',''),x.get('ticker','')))}


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--months',type=int,default=60);ap.add_argument('--twse',type=int,default=100);ap.add_argument('--tpex',type=int,default=60)
    ap.add_argument('--out',default='stock-lab/backtest-result.json');ap.add_argument('--workers',type=int,default=4)
    ap.add_argument('--shard-index',type=int);ap.add_argument('--shard-count',type=int,default=1)
    ap.add_argument('--merge-glob')
    args=ap.parse_args()

    if args.merge_glob:
        files=sorted(glob.glob(args.merge_glob));assert files,'no shard results found'
        results=[];requested=0;months=args.months
        for path in files:
            x=json.load(open(path,encoding='utf-8'))
            assert x.get('schema_version')==3 and x.get('partial') is True,path
            results.extend(x.get('stocks',[]));requested=max(requested,int(x.get('universe_requested_total',0)));months=int(x.get('months',months))
        out=final_payload(results,requested,months)
        with open(args.out,'w',encoding='utf-8') as f:json.dump(out,f,ensure_ascii=False,indent=2)
        print(json.dumps({'universe_ok':out['universe_ok'],'universe_requested':out['universe_requested'],'aggregate':out['aggregate']},ensure_ascii=False,indent=2))
        return

    universe=m.load_universe(args.twse,args.tpex);total=len(universe)
    if args.shard_index is not None:
        assert 0<=args.shard_index<args.shard_count
        selected=universe[args.shard_index::args.shard_count]
        results=run_stocks(selected,args.months,args.workers)
        out={'schema_version':3,'partial':True,'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),'shard_index':args.shard_index,'shard_count':args.shard_count,'universe_requested_total':total,'shard_requested':len(selected),'months':args.months,'stocks':results}
    else:
        results=run_stocks(universe,args.months,args.workers);out=final_payload(results,total,args.months)
    with open(args.out,'w',encoding='utf-8') as f:json.dump(out,f,ensure_ascii=False,indent=2)
    print(json.dumps({'requested':len(selected) if args.shard_index is not None else total,'ok':sum('error' not in x for x in results)},ensure_ascii=False),flush=True)

if __name__=='__main__':main()
