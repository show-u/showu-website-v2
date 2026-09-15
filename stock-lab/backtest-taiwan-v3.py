#!/usr/bin/env python3
import argparse, datetime as dt, importlib.util, json
from concurrent.futures import ThreadPoolExecutor, as_completed

spec=importlib.util.spec_from_file_location('legacy','stock-lab/backtest-model.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
SLIPPAGE_EACH_SIDE=0.0005

def structure_band(b,i,mode):
    c=[x.close for x in b];L=b[i];a=m.atr(b,i)
    if a is None:return None
    if mode=='preopen':
        if i<20:return None
        ma5=m.avg(c[i-4:i+1]);ma10=m.avg(c[i-9:i+1]);w=b[i-19:i+1]
        qlow=m.qtile([x.low for x in w],.25);recent=min(x.low for x in w[-10:]);support=max(qlow,min(ma5,L.close),min(ma10,L.close),recent-a*.6)
        lo=max(.01,qlow,support-a*.30);hi=min(L.close,support+a*.15)
        if lo>hi:lo=max(.01,min(support,L.close));hi=max(lo,min(L.close,support))
        stop=max(.01,support-a*.45)
        return m.rt(lo,'up'),m.rt(hi,'down'),m.rt(stop,'down')
    look,ma_p,mult=(20,20,.45) if mode=='short' else (60,60,.70) if mode=='swing' else (240,120,1.0)
    if i+1<look:return None
    w=b[i-look+1:i+1];ma=m.avg(c[i-ma_p+1:i+1]);qlow=m.qtile([x.low for x in w],.20);recent=min(x.low for x in w[-10:]);support=max(qlow,min(ma,L.close),recent-a*.6)
    lo=max(.01,qlow,support-a*mult);hi=min(L.close,support+a*({'short':.25,'swing':.35,'long':.5}[mode]))
    if lo>hi:lo=max(.01,min(support,L.close));hi=max(lo,min(L.close,support))
    stop=max(.01,support-a*({'short':.9,'swing':1.2,'long':1.6}[mode]))
    return m.rt(lo,'up'),m.rt(hi,'down'),m.rt(stop,'down')

def realistic_costs(mode):
    tax=m.TAX_DAYTRADE if mode=='preopen' else m.TAX_NORMAL
    return 2*m.COMMISSION+tax+2*SLIPPAGE_EACH_SIDE

m.band=structure_band;m.costs=realistic_costs

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--months',type=int,default=60);ap.add_argument('--twse',type=int,default=100);ap.add_argument('--tpex',type=int,default=60);ap.add_argument('--out',default='stock-lab/backtest-result.json');args=ap.parse_args()
    universe=m.load_universe(args.twse,args.tpex);results=[]
    with ThreadPoolExecutor(max_workers=5) as ex:
        fut={ex.submit(m.test_stock,x,args.months):x for x in universe}
        for f in as_completed(fut):
            x=fut[f]
            try:r=f.result()
            except Exception as e:r={'ticker':x['ticker'],'market':x['market'],'industry':x.get('industry'),'error':str(e)}
            results.append(r);print(x['ticker'],'OK' if 'error' not in r else r['error'])
    agg={}
    for mode in ('preopen','short','swing','long'):
        agg[mode]={s:m.aggregate(results,mode,s) for s in ('all','insample','oos')};agg[mode]['stress_status']=m.stress_status(agg[mode]['oos'])
    out={'schema_version':3,'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),'market':'TWSE+TPEx','method':'Taiwan structure/quantile/MA/ATR price model with no fixed price-percentage entry bands; 70/30 chronological OOS; non-overlapping trades; transaction tax, commission and slippage included.','cost_assumptions':{'commission_each_side_pct':m.COMMISSION*100,'normal_stock_sell_tax_pct':m.TAX_NORMAL*100,'daytrade_sell_tax_pct':m.TAX_DAYTRADE*100,'slippage_each_side_pct':SLIPPAGE_EACH_SIDE*100},'universe_requested':len(universe),'universe_ok':sum('error' not in x for x in results),'months':args.months,'aggregate':agg,'stocks':sorted(results,key=lambda x:(x.get('market',''),x['ticker']))}
    with open(args.out,'w',encoding='utf-8') as f:json.dump(out,f,ensure_ascii=False,indent=2)
    print(json.dumps({'universe_ok':out['universe_ok'],'aggregate':agg},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
