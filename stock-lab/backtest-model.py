#!/usr/bin/env python3
import json, math, statistics, urllib.request, urllib.parse, datetime as dt
from dataclasses import dataclass

TWSE='https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY'

@dataclass
class Bar:
    date:str; open:float; high:float; low:float; close:float; volume:float

def n(v):
    try:return float(str(v).replace(',',''))
    except:return None

def roc_to_iso(s):
    y,m,d=s.split('/')
    return f'{int(y)+1911:04d}-{int(m):02d}-{int(d):02d}'

def fetch_month(code, yyyymm01):
    q=urllib.parse.urlencode({'date':yyyymm01,'stockNo':code,'response':'json'})
    req=urllib.request.Request(TWSE+'?'+q,headers={'User-Agent':'StockLab-Backtest/1.0'})
    with urllib.request.urlopen(req,timeout=20) as r:
        j=json.load(r)
    if j.get('stat')!='OK': return []
    out=[]
    for x in j.get('data',[]):
        try:
            out.append(Bar(roc_to_iso(x[0]),n(x[3]),n(x[4]),n(x[5]),n(x[6]),n(x[1])))
        except: pass
    return [b for b in out if all(v is not None for v in (b.open,b.high,b.low,b.close,b.volume))]

def month_keys(months=72):
    t=dt.date.today().replace(day=1)
    out=[]
    for i in range(months):
        y=t.year; m=t.month-i
        while m<=0: y-=1; m+=12
        out.append(f'{y:04d}{m:02d}01')
    return list(reversed(out))

def load(code, months=72):
    bars=[]
    for k in month_keys(months):
        try: bars += fetch_month(code,k)
        except Exception: pass
    d={b.date:b for b in bars}
    return [d[k] for k in sorted(d)]

def sma(v,p,i):
    if i+1<p:return None
    return sum(v[i-p+1:i+1])/p

def atr(bars,p,i):
    if i<p:return None
    tr=[]
    for j in range(i-p+1,i+1):
        prev=bars[j-1].close
        tr.append(max(bars[j].high-bars[j].low,abs(bars[j].high-prev),abs(bars[j].low-prev)))
    return sum(tr)/p

def support(bars,lookback,i):
    if i+1<lookback:return None
    return min(x.low for x in bars[i-lookback+1:i+1])

def resistance(bars,lookback,i):
    if i+1<lookback:return None
    return max(x.high for x in bars[i-lookback+1:i+1])

def legacy_entry(close,h):
    if h=='short': return close*.96,close*.985
    if h=='swing': return close*.92,close*.97
    return close*.88,close*.95

def adaptive_entry(bars,i,h):
    closes=[x.close for x in bars]
    if h=='short': look,ma_p,atr_mult,hold=20,20,.8,20
    elif h=='swing': look,ma_p,atr_mult,hold=60,60,1.0,60
    else: look,ma_p,atr_mult,hold=240,120,1.2,240
    s=support(bars,look,i); m=sma(closes,ma_p,i); a=atr(bars,14,i)
    if None in (s,m,a): return None
    core=max(s,min(m,bars[i].close))
    lo=max(s-a*atr_mult,core-a*.35)
    hi=min(bars[i].close,core+a*.35)
    if lo>hi: lo,hi=hi,lo
    return lo,hi,hold

def eval_trade(bars,i,lo,hi,hold):
    end=min(len(bars)-1,i+hold)
    entry=None; ei=None
    for j in range(i+1,end+1):
        if bars[j].low<=hi and bars[j].high>=lo:
            entry=min(hi,max(lo,bars[j].open if lo<=bars[j].open<=hi else (lo+hi)/2))
            ei=j;break
    if entry is None:return None
    path=bars[ei:end+1]
    exitp=path[-1].close
    ret=(exitp/entry-1)*100
    mfe=(max(x.high for x in path)/entry-1)*100
    mae=(min(x.low for x in path)/entry-1)*100
    return {'entry':entry,'exit':exitp,'return_pct':ret,'mfe_pct':mfe,'mae_pct':mae}

def summarize(trades):
    if not trades:return {'n':0}
    r=[x['return_pct'] for x in trades]; wins=[x for x in r if x>0]; losses=[x for x in r if x<=0]
    gross_win=sum(wins); gross_loss=abs(sum(losses))
    return {
      'n':len(r),'win_rate_pct':round(len(wins)/len(r)*100,2),'avg_return_pct':round(statistics.mean(r),2),
      'median_return_pct':round(statistics.median(r),2),'profit_factor':round(gross_win/gross_loss,2) if gross_loss else None,
      'avg_mae_pct':round(statistics.mean(x['mae_pct'] for x in trades),2),'avg_mfe_pct':round(statistics.mean(x['mfe_pct'] for x in trades),2)
    }

def run_stock(code,months=72):
    bars=load(code,months)
    out={'ticker':code,'bars':len(bars),'models':{}}
    for h in ('short','swing','long'):
        legacy=[]; adaptive=[]
        hold={'short':20,'swing':60,'long':240}[h]
        start={'short':60,'swing':120,'long':260}[h]
        for i in range(start,len(bars)-hold-1):
            llo,lhi=legacy_entry(bars[i].close,h)
            t=eval_trade(bars,i,llo,lhi,hold)
            if t: legacy.append(t)
            ae=adaptive_entry(bars,i,h)
            if ae:
                alo,ahi,ahold=ae
                t2=eval_trade(bars,i,alo,ahi,ahold)
                if t2: adaptive.append(t2)
        out['models'][h]={'legacy_fixed_pct':summarize(legacy),'adaptive_support_atr':summarize(adaptive)}
    return out

if __name__=='__main__':
    import argparse
    ap=argparse.ArgumentParser()
    ap.add_argument('tickers',nargs='*',default=['2409','2454','3017','3044','8210'])
    ap.add_argument('--months',type=int,default=72)
    ap.add_argument('--out',default='stock-lab/backtest-result.json')
    args=ap.parse_args()
    result={'schema_version':1,'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),'market':'TWSE','purpose':'Compare legacy fixed-percentage entry ranges with Taiwan-stock adaptive support/ATR ranges.','tickers':[]}
    for c in args.tickers:
        try: result['tickers'].append(run_stock(c,args.months))
        except Exception as e: result['tickers'].append({'ticker':c,'error':str(e)})
    with open(args.out,'w',encoding='utf-8') as f: json.dump(result,f,ensure_ascii=False,indent=2)
    print(json.dumps(result,ensure_ascii=False,indent=2))
