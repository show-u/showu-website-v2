#!/usr/bin/env python3
import json, math, statistics, urllib.request, urllib.parse, datetime as dt, time, random
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor, as_completed

TWSE='https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY'
TPEX='https://www.tpex.org.tw/www/zh-tw/afterTrading/tradingStock'
UA={'User-Agent':'StockLab-Taiwan-Backtest/2.0','Accept':'application/json'}
COMMISSION=0.001425
TAX_DAYTRADE=0.0015
TAX_NORMAL=0.003

@dataclass
class Bar:
    date:str; open:float; high:float; low:float; close:float; volume:float

def n(v):
    try:return float(str(v).replace(',','').replace('%',''))
    except:return None

def roc_to_iso(s):
    p=str(s).split('/')
    if len(p)!=3:return None
    y,m,d=p
    return f'{int(y)+1911:04d}-{int(m):02d}-{int(d):02d}' if int(y)<1900 else f'{int(y):04d}-{int(m):02d}-{int(d):02d}'

def get_json(url,tries=3,timeout=30):
    err=None
    for i in range(tries):
        try:
            req=urllib.request.Request(url,headers=UA)
            with urllib.request.urlopen(req,timeout=timeout) as r:return json.loads(r.read().decode('utf-8'))
        except Exception as e:
            err=e; time.sleep(.5*(i+1))
    raise err

def month_keys(months):
    t=dt.date.today().replace(day=1); out=[]
    for i in range(months):
        y=t.year; m=t.month-i
        while m<=0:y-=1;m+=12
        out.append(f'{y:04d}{m:02d}01')
    return list(reversed(out))

def fetch_twse_month(code,key):
    q=urllib.parse.urlencode({'date':key,'stockNo':code,'response':'json'})
    j=get_json(TWSE+'?'+q)
    if j.get('stat')!='OK':return[]
    out=[]
    for x in j.get('data',[]):
        try:
            b=Bar(roc_to_iso(x[0]),n(x[3]),n(x[4]),n(x[5]),n(x[6]),n(x[1]))
            if b.date and all(v is not None for v in (b.open,b.high,b.low,b.close,b.volume)):out.append(b)
        except:pass
    return out

def _find_table(x):
    if isinstance(x,list):
        for v in x:
            z=_find_table(v)
            if z:return z
        return None
    if not isinstance(x,dict):return None
    f=x.get('fields') or x.get('Fields') or x.get('field') or x.get('headers'); d=x.get('data') or x.get('Data') or x.get('rows')
    if isinstance(f,list) and isinstance(d,list):
        s='|'.join(map(str,f))
        if '日期' in s and '收盤' in s and '開盤' in s:return f,d
    for v in x.values():
        z=_find_table(v)
        if z:return z
    return None

def fetch_tpex_month(code,key):
    date=f'{key[:4]}/{key[4:6]}/01'
    q=urllib.parse.urlencode({'code':code,'date':date,'id':'','response':'json'})
    j=get_json(TPEX+'?'+q); t=_find_table(j)
    if not t:return[]
    f,d=t
    def ix(*names):
        for i,z in enumerate(f):
            if any(k in str(z) for k in names):return i
        return -1
    di,vi,oi,hi,li,ci=ix('日期'),ix('成交股數','成交仟股','成交量'),ix('開盤'),ix('最高'),ix('最低'),ix('收盤')
    if min(di,oi,hi,li,ci)<0:return[]
    out=[]
    for x in d:
        try:
            b=Bar(roc_to_iso(x[di]),n(x[oi]),n(x[hi]),n(x[li]),n(x[ci]),n(x[vi]) if vi>=0 else 0)
            if b.date and all(v is not None for v in (b.open,b.high,b.low,b.close)):out.append(b)
        except:pass
    return out

def load_stock(code,market,months):
    keys=month_keys(months); bars=[]
    fn=fetch_twse_month if market=='TWSE' else fetch_tpex_month
    with ThreadPoolExecutor(max_workers=6) as ex:
        fut=[ex.submit(fn,code,k) for k in keys]
        for f in as_completed(fut):
            try:bars.extend(f.result())
            except:pass
    d={b.date:b for b in bars}
    return [d[k] for k in sorted(d)]

def avg(a):
    a=[x for x in a if x is not None and math.isfinite(x)]
    return sum(a)/len(a) if a else None

def qtile(a,q):
    v=sorted(x for x in a if x is not None and math.isfinite(x))
    if not v:return None
    p=(len(v)-1)*q;l=int(math.floor(p));h=int(math.ceil(p))
    return v[l] if l==h else v[l]+(v[h]-v[l])*(p-l)

def atr(b,i,p=14):
    if i<p:return None
    z=[]
    for j in range(i-p+1,i+1):
        pc=b[j-1].close;x=b[j];z.append(max(x.high-x.low,abs(x.high-pc),abs(x.low-pc)))
    return avg(z)

def tick(p):
    if p<10:return .01
    if p<50:return .05
    if p<100:return .1
    if p<500:return .5
    if p<1000:return 1
    return 5

def rt(p,mode='nearest'):
    t=tick(max(.01,p));q=p/t
    z=math.ceil(q) if mode=='up' else math.floor(q) if mode=='down' else round(q)
    return round(z*t,2 if t<.1 else 1 if t<1 else 0)

def band(b,i,mode):
    c=[x.close for x in b];L=b[i];a=atr(b,i)
    if a is None:return None
    if mode=='preopen':
        if i<20:return None
        ma5=avg(c[i-4:i+1]);ma10=avg(c[i-9:i+1]);w=b[i-9:i+1]
        support=max(min(ma5,L.close),max(min(x.low for x in w),ma10-a*.7))
        lo=max(min(x.low for x in w),support-a*.30);hi=min(L.close,support+a*.15)
        stop=max(L.close*.9,min(x.low for x in w)-a*.45)
        return rt(lo,'up'),rt(max(lo,hi),'down'),rt(stop,'down')
    look,ma_p,mult=(20,20,.45) if mode=='short' else (60,60,.70) if mode=='swing' else (240,120,1.0)
    if i+1<look:return None
    w=b[i-look+1:i+1];m=avg(c[i-ma_p+1:i+1]);ql=qtile([x.low for x in w],.20);recent=min(x.low for x in w[-10:])
    support=max(min(m,L.close),max(ql,recent-a*.6));lo=max(ql,support-a*mult);hi=min(L.close,support+a*({'short':.25,'swing':.35,'long':.5}[mode]))
    if lo>hi:lo=min(support,L.close);hi=max(lo,min(L.close,support+a*.2))
    stop=max(.01,support-a*({'short':.9,'swing':1.2,'long':1.6}[mode]))
    return rt(lo,'up'),rt(hi,'down'),rt(stop,'down')

def costs(mode):return 2*COMMISSION+(TAX_DAYTRADE if mode=='preopen' else TAX_NORMAL)

def evaluate(b,signal_i,mode):
    cfg={'preopen':(1,1),'short':(5,20),'swing':(10,60),'long':(20,240)};entry_win,hold=cfg[mode]
    bb=band(b,signal_i,mode)
    if not bb:return None,None
    lo,hi,stop=bb;last_entry=min(len(b)-1,signal_i+entry_win);ei=None;entry=None
    for j in range(signal_i+1,last_entry+1):
        x=b[j]
        if x.low<=hi and x.high>=lo:
            entry=x.open if lo<=x.open<=hi else (lo+hi)/2;entry=max(lo,min(hi,entry));ei=j;break
    if ei is None:return {'filled':False,'signal_date':b[signal_i].date},signal_i+1
    end=min(len(b)-1,ei+hold-1);path=b[ei:end+1];exitp=path[-1].close;exit_i=end
    # Conservative daily-bar stop: if the stop is touched, assume stop execution before any favorable path.
    for j,x in enumerate(path):
        if x.low<=stop:
            exitp=stop;exit_i=ei+j;break
    gross=exitp/entry-1;net=gross-costs(mode);mfe=max(x.high for x in path)/entry-1;mae=min(x.low for x in path)/entry-1
    return {'filled':True,'signal_date':b[signal_i].date,'entry_date':b[ei].date,'exit_date':b[exit_i].date,'entry':entry,'exit':exitp,'net_return_pct':net*100,'gross_return_pct':gross*100,'mfe_pct':mfe*100,'mae_pct':mae*100,'cost_pct':costs(mode)*100},max(signal_i+1,exit_i+1)

def run_mode(b,mode,split_i):
    start=30 if mode=='preopen' else 60 if mode=='short' else 130 if mode=='swing' else 260
    trades=[];signals=0;i=start
    while i<len(b)-2:
        r,nxt=evaluate(b,i,mode);signals+=1
        if r and r.get('filled'):
            r['sample']='oos' if i>=split_i else 'insample';trades.append(r)
        i=max(i+1,nxt or i+1)
    return trades,signals

def summary(trades,signals=None):
    if not trades:return {'n':0,'signals':signals or 0,'fill_rate_pct':0 if signals else None}
    r=[x['net_return_pct'] for x in trades];w=[x for x in r if x>0];l=[x for x in r if x<=0];gw=sum(w);gl=abs(sum(l));eq=1;peak=1;mdd=0
    for x in sorted(trades,key=lambda z:z['exit_date']):
        eq*=1+x['net_return_pct']/100;peak=max(peak,eq);mdd=min(mdd,(eq/peak-1)*100)
    return {'n':len(r),'signals':signals if signals is not None else None,'fill_rate_pct':round(len(r)/(signals or len(r))*100,2),'win_rate_pct':round(len(w)/len(r)*100,2),'avg_net_return_pct':round(statistics.mean(r),3),'median_net_return_pct':round(statistics.median(r),3),'profit_factor':round(gw/gl,3) if gl else None,'max_drawdown_pct':round(mdd,2),'avg_mae_pct':round(statistics.mean(x['mae_pct'] for x in trades),2),'avg_mfe_pct':round(statistics.mean(x['mfe_pct'] for x in trades),2),'total_return_pct':round((eq-1)*100,2)}

def family(ind):
    s=str(ind or '')
    if any(x in s for x in ('金融','銀行','保險','證券','金控')):return'financial'
    if '半導體' in s:return'semiconductor'
    if any(x in s for x in ('電子','電腦','通信','光電','資訊')):return'electronics'
    if '航運' in s:return'shipping'
    if any(x in s for x in ('生技','醫療')):return'biotech'
    return'general'

def load_universe(limit_twse=50,limit_tpex=30):
    cache=json.load(open('stock-lab/browser-data.json',encoding='utf-8'));fac={}
    try:fac=json.load(open('stock-lab/taiwan-factors.json',encoding='utf-8')).get('stocks',{})
    except:pass
    ds=cache['datasets'];u=[]
    for x in ds['twse_snapshot']:
        c=str(x.get('Code','')).strip();tv=n(x.get('TradeValue'));p=n(x.get('ClosingPrice'))
        if len(c)==4 and c.isdigit() and tv and p:u.append({'ticker':c,'market':'TWSE','trade_value':tv,'industry':fac.get(c,{}).get('industry')})
    for x in ds['tpex_snapshot']:
        c=str(x.get('SecuritiesCompanyCode') or x.get('Code') or '').strip();tv=n(x.get('TransactionAmount') or x.get('TradeValue') or x.get('TradingAmount'));p=n(x.get('Close') or x.get('ClosingPrice'))
        if len(c)==4 and c.isdigit() and tv and p:u.append({'ticker':c,'market':'TPEx','trade_value':tv,'industry':fac.get(c,{}).get('industry')})
    def select(rows,k):
        rows=sorted(rows,key=lambda z:z['trade_value'],reverse=True);rows=[x for x in rows if x['trade_value']>=20_000_000]
        if len(rows)<=k:return rows
        # Spread picks across liquidity ranks, while keeping deterministic coverage.
        idx=sorted(set(round(i*(len(rows)-1)/(k-1)) for i in range(k)))
        return [rows[i] for i in idx]
    return select([x for x in u if x['market']=='TWSE'],limit_twse)+select([x for x in u if x['market']=='TPEx'],limit_tpex)

def test_stock(meta,months):
    b=load_stock(meta['ticker'],meta['market'],months)
    if len(b)<520:return {'ticker':meta['ticker'],'market':meta['market'],'industry':meta.get('industry'),'error':f'only {len(b)} bars'}
    split=int(len(b)*.70);out={'ticker':meta['ticker'],'market':meta['market'],'industry':meta.get('industry'),'family':family(meta.get('industry')),'bars':len(b),'split_date':b[split].date,'modes':{}}
    for mode in ('preopen','short','swing','long'):
        tr,sig=run_mode(b,mode,split);ins=[x for x in tr if x['sample']=='insample'];oos=[x for x in tr if x['sample']=='oos']
        out['modes'][mode]={'all':summary(tr,sig),'insample':summary(ins),'oos':summary(oos),'trades':tr}
    return out

def aggregate(stocks,mode,sample):
    tr=[];signals=0
    for s in stocks:
        if 'error' in s:continue
        m=s['modes'][mode];tr.extend([x for x in m['trades'] if sample=='all' or x['sample']==sample]);
        if sample=='all':signals+=m['all']['signals'] or 0
    return summary(tr,signals if sample=='all' else None)

def stress_status(m):
    if m.get('n',0)<20:return'INSUFFICIENT'
    pf=m.get('profit_factor')
    return 'PASS' if m.get('avg_net_return_pct',-999)>0 and pf is not None and pf>=1 and m.get('max_drawdown_pct',-100)>-35 else 'FAIL'

if __name__=='__main__':
    import argparse
    ap=argparse.ArgumentParser();ap.add_argument('--months',type=int,default=60);ap.add_argument('--twse',type=int,default=50);ap.add_argument('--tpex',type=int,default=30);ap.add_argument('--out',default='stock-lab/backtest-result.json');args=ap.parse_args()
    universe=load_universe(args.twse,args.tpex);results=[]
    # Stock-level parallelism; monthly requests are additionally bounded inside each stock.
    with ThreadPoolExecutor(max_workers=5) as ex:
        fut={ex.submit(test_stock,x,args.months):x for x in universe}
        for f in as_completed(fut):
            x=fut[f]
            try:r=f.result()
            except Exception as e:r={'ticker':x['ticker'],'market':x['market'],'industry':x.get('industry'),'error':str(e)}
            results.append(r);print(x['ticker'], 'OK' if 'error' not in r else r['error'])
    agg={}
    for mode in ('preopen','short','swing','long'):
        agg[mode]={s:aggregate(results,mode,s) for s in ('all','insample','oos')};agg[mode]['stress_status']=stress_status(agg[mode]['oos'])
    out={'schema_version':2,'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),'market':'TWSE+TPEx','method':'Taiwan adaptive support/MA/ATR price model; deterministic parameters; non-overlapping trades; 70/30 chronological out-of-sample split; standard Taiwan transaction costs.','cost_assumptions':{'commission_each_side_pct':COMMISSION*100,'normal_stock_sell_tax_pct':TAX_NORMAL*100,'daytrade_sell_tax_pct':TAX_DAYTRADE*100},'universe_requested':len(universe),'universe_ok':sum('error' not in x for x in results),'months':args.months,'aggregate':agg,'stocks':sorted(results,key=lambda x:(x.get('market',''),x['ticker']))}
    with open(args.out,'w',encoding='utf-8') as f:json.dump(out,f,ensure_ascii=False,indent=2)
    print(json.dumps({'universe_ok':out['universe_ok'],'aggregate':agg},ensure_ascii=False,indent=2))
