
import json, math, time, requests, numpy as np, pandas as pd
from concurrent.futures import ThreadPoolExecutor, as_completed
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline

ASOF_END="2026-09-25"
PRICE_START="2020-01-01"
H=84
TRAIN_END="2023-12-31"
TEST_START="2024-01-01"
FEATURES=["mom6","mom12","high52","rev_yoy","rev_accel"]

def info():
    u="https://api.finmindtrade.com/api/v4/data"
    r=requests.get(u,params={"dataset":"TaiwanStockInfo"},timeout=30)
    r.raise_for_status()
    return r.json().get("data",[])

def yprice(code,typ):
    suf=".TW" if typ=="twse" else ".TWO"
    p1=int(pd.Timestamp(PRICE_START,tz="UTC").timestamp()); p2=int(pd.Timestamp("2026-09-27",tz="UTC").timestamp())
    u=f"https://query1.finance.yahoo.com/v8/finance/chart/{code}{suf}"
    for a in range(3):
        try:
            r=requests.get(u,params={"period1":p1,"period2":p2,"interval":"1d","events":"div,splits","includeAdjustedClose":"true"},
                           headers={"User-Agent":"Mozilla/5.0"},timeout=30)
            if r.ok:
                j=r.json()["chart"]["result"][0]; ts=j.get("timestamp",[])
                q=j["indicators"]["quote"][0]; adj=j["indicators"].get("adjclose",[{}])[0].get("adjclose") or q["close"]
                rows=[]
                for i,t in enumerate(ts):
                    c=adj[i] if i<len(adj) else None
                    if c is not None and c>0: rows.append((pd.to_datetime(t,unit="s",utc=True).date().isoformat(),float(c)))
                return rows
        except Exception: pass
        time.sleep(.25*(a+1))
    return []

def revenue(code):
    u="https://api.finmindtrade.com/api/v4/data"
    for a in range(3):
        try:
            r=requests.get(u,params={"dataset":"TaiwanStockMonthRevenue","data_id":code,"start_date":"2019-01-01","end_date":ASOF_END},timeout=30)
            if r.ok: return r.json().get("data",[])
        except Exception: pass
        time.sleep(.25*(a+1))
    return []

def revfeat(rows,date):
    a=[]
    for x in rows:
        ct=x.get("create_time") or x.get("date")
        if ct and ct<=date and float(x.get("revenue") or 0)>0:
            a.append((ct,int(x["revenue_year"]),int(x["revenue_month"]),float(x["revenue"])))
    if not a: return None
    a.sort(); ct,y,m,v=a[-1]
    mp={(yy,mm):vv for _,yy,mm,vv in a}
    ys=[]
    for k in range(4):
        mm=m-k; yy=y
        while mm<=0: mm+=12; yy-=1
        v=mp.get((yy,mm)); py=mp.get((yy-1,mm))
        if not v or not py: return None
        ys.append(v/py-1)
    return ys[0], ys[0]-np.mean(ys[1:])

raw=info()
latest={}
for x in raw:
    code=x.get("stock_id","")
    if x.get("type") not in ("twse","tpex") or not (code.isdigit() and len(code)==4): continue
    if x.get("industry_category")=="ETF" or "創" in x.get("stock_name",""): continue
    if code not in latest or x.get("date","")>latest[code].get("date",""): latest[code]=x
stocks=list(latest.values())
print("UNIVERSE_CURRENT",len(stocks))

prices={}
def getp(s): return s["stock_id"], yprice(s["stock_id"],s["type"])
with ThreadPoolExecutor(max_workers=20) as ex:
    fut=[ex.submit(getp,s) for s in stocks]
    for f in as_completed(fut):
        c,p=f.result()
        if len(p)>=400: prices[c]=p
print("PRICE_OK",len(prices))

# common calendar from 2330 if available else longest
anchor=max(prices.items(),key=lambda kv:len(kv[1]))[1]
cal=[d for d,_ in anchor]
dates=[]
for i in range(320,len(cal)-H,84):
    d=cal[i]
    if "2021-08-01"<=d<="2026-01-31": dates.append(d)
print("DATES",json.dumps(dates))

# first pass price features; collect codes that ever have a valid observation
obs_price=[]
need=set()
for d in dates:
    rows=[]
    for code,p in prices.items():
        idx={x[0]:i for i,x in enumerate(p)}.get(d)
        if idx is None or idx<252 or idx+H>=len(p): continue
        cs=[x[1] for x in p]
        mom6=cs[idx-21]/cs[idx-126]-1
        mom12=cs[idx-21]/cs[idx-252]-1
        high52=cs[idx]/max(cs[idx-251:idx+1])
        future=cs[idx+H]/cs[idx]-1
        rows.append((code,d,mom6,mom12,high52,future))
        need.add(code)
    obs_price.extend(rows)
print("PRICE_OBS",len(obs_price),"NEED_REVENUE",len(need))

rev={}
def getr(c): return c,revenue(c)
with ThreadPoolExecutor(max_workers=14) as ex:
    fut=[ex.submit(getr,c) for c in need]
    for f in as_completed(fut):
        c,r=f.result()
        if r: rev[c]=r
print("REVENUE_OK",len(rev))

records=[]
for code,d,m6,m12,h52,fut in obs_price:
    rf=revfeat(rev.get(code,[]),d)
    if rf is None: continue
    records.append({"code":code,"date":d,"mom6":m6,"mom12":m12,"high52":h52,
                    "rev_yoy":rf[0],"rev_accel":rf[1],"future":fut,"winner":1 if fut>=.20 else 0})
df=pd.DataFrame(records)
print("FINAL_OBS",len(df),"DATES_VALID",df.date.nunique())

# Cross-sectional percentile transform per date, no future info
for f in FEATURES:
    df[f]=df.groupby("date")[f].rank(pct=True,method="average")

train=df[df.date<=TRAIN_END].copy()
test=df[df.date>=TEST_START].copy()
print("SPLIT",json.dumps({"train_rows":len(train),"train_dates":train.date.nunique(),"test_rows":len(test),"test_dates":test.date.nunique()}))

X=train[FEATURES].values; y=train.winner.values
model=make_pipeline(StandardScaler(),LogisticRegression(C=1.0,penalty="l2",solver="liblinear",random_state=1))
model.fit(X,y)
test["score"]=model.predict_proba(test[FEATURES].values)[:,1]

by=[]
for d,g in test.groupby("date"):
    if len(g)<100: continue
    base=g.winner.mean()
    top10=g.nlargest(10,"score")
    mom10=g.nlargest(10,"mom6")
    by.append({"date":d,"n":len(g),"base":base,
               "model_p10":top10.winner.mean(),"mom6_p10":mom10.winner.mean(),
               "model_mean_ret":top10.future.mean(),"mom6_mean_ret":mom10.future.mean()})
print("TEST_BY_DATE",json.dumps(by))

def summarize(key):
    a=np.array([x[key] for x in by],float)
    return {"mean":float(a.mean()),"median":float(np.median(a)),"n_dates":len(a)}
summary={
 "base":summarize("base"),
 "model_p10":summarize("model_p10"),
 "mom6_p10":summarize("mom6_p10"),
 "model_mean_ret":summarize("model_mean_ret"),
 "mom6_mean_ret":summarize("mom6_mean_ret")
}
# paired sign-flip permutation model vs MOM6 P@10
diff=np.array([x["model_p10"]-x["mom6_p10"] for x in by],float)
rng=np.random.default_rng(1); B=20000
perm=np.array([(diff*rng.choice([-1,1],len(diff))).mean() for _ in range(B)])
p=float((np.sum(perm>=diff.mean())+1)/(B+1))
boots=np.array([rng.choice(diff,len(diff),replace=True).mean() for _ in range(10000)])
summary["model_minus_mom6_p10"]={"mean":float(diff.mean()),"p_one_sided":p,"ci95":[float(np.quantile(boots,.025)),float(np.quantile(boots,.975))]}
print("RESULT",json.dumps(summary))

# current ranking as of last common date, no claim of predictive validity beyond test above
last=max(df.date.unique())
cur=df[df.date==last].copy()
if len(cur)>=100:
    cur["score"]=model.predict_proba(cur[FEATURES].values)[:,1]
    top=cur.nlargest(10,"score")[["code","score"]+FEATURES].to_dict("records")
    print("CURRENT_TOP10_FORMATION_DATE",last)
    print("CURRENT_TOP10",json.dumps(top))
