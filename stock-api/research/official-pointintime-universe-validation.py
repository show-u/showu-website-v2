
import io, json, math, time, statistics, requests, pandas as pd
from datetime import datetime
from dateutil.relativedelta import relativedelta

DATES=["2021-08-04","2021-12-03","2022-04-15","2022-08-15","2022-12-13","2023-04-28","2023-08-30","2023-12-29","2024-05-13","2024-09-11","2025-01-15","2025-05-28","2025-09-25","2026-01-29"]
H=84
S=requests.Session(); S.headers.update({"User-Agent":"Mozilla/5.0"})
def num(x):
    if x is None:return None
    s=str(x).replace(",","").strip()
    if s in ("","--","---","nan","NaN","除權","除息"):return None
    try:return float(s)
    except:return None

def get_json(url,tries=5):
    for a in range(tries):
        try:
            r=S.get(url,timeout=40)
            r.raise_for_status()
            return r.json()
        except Exception:
            time.sleep(0.8*(a+1))
    return None

def twse_stock_day_month(year,month):
    d=f"{year}{month:02d}01"
    u=f"https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?date={d}&stockNo=2330&response=json"
    j=get_json(u)
    out=[]
    if isinstance(j,dict):
        for row in j.get("data",[]):
            if row and len(row)>0:
                s=str(row[0]).replace("/","-")
                try:
                    y,m,dd=[int(v) for v in s.split("-")]
                    out.append(f"{y+1911:04d}-{m:02d}-{dd:02d}")
                except: pass
    return out

def build_calendar():
    out=set()
    cur=datetime(2020,1,1)
    end=datetime(2026,9,1)
    while cur<=end:
        out.update(twse_stock_day_month(cur.year,cur.month))
        cur += relativedelta(months=1)
        time.sleep(0.03)
    return sorted(out)

def twse_all(date):
    d=date.replace("-","")
    u=f"https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date={d}&type=ALLBUT0999&response=json"
    j=get_json(u); out={}
    if not isinstance(j,dict): return out
    for t in j.get("tables",[]):
        fs=t.get("fields",[])
        if "證券代號" in fs and any("收盤" in str(f) for f in fs):
            ci=fs.index("證券代號"); pi=next(i for i,f in enumerate(fs) if "收盤" in str(f))
            for r in t.get("data",[]):
                if len(r)<=max(ci,pi):continue
                c=str(r[ci]).strip()
                if len(c)==4 and c.isdigit() and not c.startswith("00") and not c.startswith("91"):
                    p=num(r[pi])
                    if p and p>0: out[c]=p
            if out: break
    return out

def roc_date(date):
    dt=datetime.strptime(date,"%Y-%m-%d")
    return f"{dt.year-1911}/{dt.month:02d}/{dt.day:02d}"

def tpex_all(date):
    rd=roc_date(date)
    u=f"https://www.tpex.org.tw/web/stock/aftertrading/otc_quotes_no1430/stk_wn1430_result.php?l=zh-tw&d={rd}&se=EW&o=json"
    j=get_json(u); out={}
    if not isinstance(j,dict):return out
    tables=j.get("tables",[])
    for t in tables:
        fs=t.get("fields",[])
        if not fs:continue
        try:
            ci=next(i for i,f in enumerate(fs) if "代號" in str(f))
            pi=next(i for i,f in enumerate(fs) if "收盤" in str(f))
        except StopIteration: continue
        for r in t.get("data",[]):
            if len(r)<=max(ci,pi):continue
            c=str(r[ci]).strip()
            if len(c)==4 and c.isdigit() and not c.startswith("00") and not c.startswith("91"):
                p=num(r[pi])
                if p and p>0: out[c]=p
        if out:break
    return out

def all_prices(date):
    a=twse_all(date); b=tpex_all(date)
    z={**a,**b}
    return z,len(a),len(b)

def month_key(dt):
    return dt.year,dt.month

def mops_revenue(year,month):
    ry=year-1911
    out={}
    for market in ("sii","otc"):
      for typ in (0,1):
        u=f"https://mopsov.twse.com.tw/nas/t21/{market}/t21sc03_{ry}_{month}_{typ}.html"
        try:
            r=S.get(u,timeout=40); r.raise_for_status()
            text=r.content.decode("big5","ignore")
            tabs=pd.read_html(io.StringIO(text))
            for df in tabs:
                if df.shape[1] != 11: continue
                # second header level contains semantic names
                if isinstance(df.columns,pd.MultiIndex):
                    cols=[str(c[1]).replace(" ","") for c in df.columns]
                else:
                    cols=[str(c).replace(" ","") for c in df.columns]
                try:
                    ci=next(i for i,c in enumerate(cols) if "公司代號" in c)
                    yi=next(i for i,c in enumerate(cols) if "去年同月" in c and "增減" in c)
                except StopIteration:
                    continue
                for row in df.itertuples(index=False,name=None):
                    code=str(row[ci]).strip()
                    if len(code)==4 and code.isdigit() and not code.startswith("00") and not code.startswith("91"):
                        y=num(row[yi])
                        if y is not None: out[code]=y/100.0
        except Exception:
            pass
        time.sleep(0.03)
    return out

def conservative_anchor(date):
    dt=datetime.strptime(date,"%Y-%m-%d").replace(day=1)-relativedelta(months=2)
    return dt

def pct_map(vals):
    s=sorted(vals.items(),key=lambda kv:kv[1]); n=len(s)
    return {c:(i/(n-1 if n>1 else 1)) for i,(c,_) in enumerate(s)}

def mean(xs): return sum(xs)/len(xs) if xs else None
def quantile(xs,p):
    a=sorted(xs); n=len(a)
    if not a:return None
    z=(n-1)*p; lo=int(math.floor(z)); hi=int(math.ceil(z))
    return a[lo] if lo==hi else a[lo]+(a[hi]-a[lo])*(z-lo)

def perm(vals,B=20000):
    import random
    if not vals:return None
    random.seed(82173); obs=mean(vals); e=0
    for _ in range(B):
        m=mean([x if random.random()<.5 else -x for x in vals])
        if m>=obs:e+=1
    return (e+1)/(B+1)

def boot(vals,B=10000):
    import random
    if not vals:return [None,None]
    random.seed(27813); a=[]
    for _ in range(B): a.append(mean([random.choice(vals) for _ in vals]))
    a.sort()
    return [a[int(.025*(B-1))],a[int(.975*(B-1))]]

print("PROTOCOL",json.dumps({
 "price_sources":["TWSE official MI_INDEX historical","TPEx official legacy dailyQuotes historical"],
 "revenue_source":"MOPS official historical monthly revenue archive (mopsov.twse.com.tw)",
 "universe":"point-in-time 4-digit TWSE+TPEx securities present on each historical date; excludes 00xx ETFs and 91xx TDR",
 "rebalance_dates":DATES,
 "non_overlap":"84 TWSE trading-day spacing used for horizon offsets",
 "mom6":"t-126 close to t-21 close",
 "revenue_rule":"latest revenue month fixed at two calendar months before rebalance date; acceleration = latest YoY minus mean prior 3 monthly YoY",
 "stage1":"MOM6 top20%",
 "stage2":"revenue acceleration top33% within stage1",
 "outcome":"future 84 trading-day close return >=20%",
 "posthoc_tuning":False
},ensure_ascii=False))

cal=build_calendar()
print("CALENDAR",json.dumps({"n":len(cal),"first":cal[0],"last":cal[-1]}))
index={d:i for i,d in enumerate(cal)}
needed=set()
for d in DATES:
    if d not in index: continue
    i=index[d]
    for off in (-126,-21,0,84):
        if 0<=i+off<len(cal): needed.add(cal[i+off])

price={}
coverage={}
for k,d in enumerate(sorted(needed)):
    z,a,b=all_prices(d); price[d]=z; coverage[d]={"twse":a,"tpex":b,"total":len(z)}
    print("PRICE_DATE",json.dumps({"date":d,"twse":a,"tpex":b,"total":len(z)}))
    time.sleep(0.08)

rev_needed=set()
anchors={}
for d in DATES:
    a=conservative_anchor(d); anchors[d]=a
    for j in range(4):
        m=a-relativedelta(months=j); rev_needed.add((m.year,m.month))
rev={}
for y,m in sorted(rev_needed):
    x=mops_revenue(y,m); rev[(y,m)]=x
    print("REV_MONTH",json.dumps({"month":f"{y}-{m:02d}","stocks":len(x)}))

rows=[]
mom_lifts=[]; rev_lifts=[]
for d in DATES:
    if d not in index: continue
    i=index[d]
    ds=[cal[i-126],cal[i-21],cal[i],cal[i+84]]
    p126,p21,p0,p84=[price.get(x,{}) for x in ds]
    codes=set(p126)&set(p21)&set(p0)&set(p84)
    obs=[]
    a=anchors[d]
    rms=[]
    for j in range(4):
        m=a-relativedelta(months=j); rms.append(rev.get((m.year,m.month),{}))
    for c in codes:
        if not all(c in r for r in rms): continue
        mom=p21[c]/p126[c]-1; fut=p84[c]/p0[c]-1
        yoys=[r[c] for r in rms]; accel=yoys[0]-mean(yoys[1:])
        obs.append((c,mom,fut,accel))
    if len(obs)<300: 
        rows.append({"date":d,"eligible":len(obs),"status":"insufficient"})
        continue
    rank=pct_map({c:m for c,m,_,_ in obs})
    base=mean([1 if fut>=.2 else 0 for _,_,fut,_ in obs])
    s1=[x for x in obs if rank[x[0]]>=.8]
    p1=mean([1 if x[2]>=.2 else 0 for x in s1])
    cut=quantile([x[3] for x in s1],.67)
    s2=[x for x in s1 if x[3]>=cut]
    p2=mean([1 if x[2]>=.2 else 0 for x in s2])
    mom_lifts.append(p1-base); rev_lifts.append(p2-p1)
    rows.append({"date":d,"eligible":len(obs),"baseline":base,"mom20N":len(s1),"mom20Precision":p1,"momLift":p1-base,"revAccelN":len(s2),"revAccelPrecision":p2,"revLiftVsMom":p2-p1,"priceDates":ds,"revenueAnchor":f"{a.year}-{a.month:02d}"})

def summ(v):
    return {"n":len(v),"mean":mean(v),"positive":sum(x>0 for x in v)/len(v) if v else None,"p":perm(v),"ci":boot(v)}
early=[r for r in rows if r.get("baseline") is not None and r["date"]<"2024-01-01"]
late=[r for r in rows if r.get("baseline") is not None and r["date"]>="2024-01-01"]
result={
 "usableDates":sum("baseline" in r for r in rows),
 "avgEligible":mean([r["eligible"] for r in rows if "baseline" in r]),
 "avgMom20N":mean([r["mom20N"] for r in rows if "baseline" in r]),
 "avgRevAccelN":mean([r["revAccelN"] for r in rows if "baseline" in r]),
 "all":{"momLift":summ([r["momLift"] for r in rows if "baseline" in r]),"revLift":summ([r["revLiftVsMom"] for r in rows if "baseline" in r])},
 "early":{"n":len(early),"momLift":summ([r["momLift"] for r in early]),"revLift":summ([r["revLiftVsMom"] for r in early])},
 "late":{"n":len(late),"momLift":summ([r["momLift"] for r in late]),"revLift":summ([r["revLiftVsMom"] for r in late])},
 "byDate":rows
}
print("RESULT",json.dumps(result,ensure_ascii=False))
