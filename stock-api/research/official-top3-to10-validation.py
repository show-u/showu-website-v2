
import json,time,math,random,requests
from datetime import datetime
S=requests.Session();S.headers.update({"User-Agent":"Mozilla/5.0"})
CASES=[
("2021-08-04","2021-01-22","2021-07-06","2021-12-03"),
("2021-12-03","2021-06-04","2021-11-04","2022-04-15"),
("2022-04-15","2021-10-05","2022-03-15","2022-08-15"),
("2022-08-15","2022-02-11","2022-07-15","2022-12-13"),
("2022-12-13","2022-06-16","2022-11-14","2023-04-28"),
("2023-04-28","2022-10-14","2023-03-27","2023-08-30"),
("2023-08-30","2023-02-22","2023-07-31","2024-03-11"),
("2023-12-29","2023-04-28","2023-09-28","2024-05-13"),
("2024-05-13","2023-08-30","2024-04-11","2024-09-11"),
("2024-09-11","2024-03-11","2024-08-13","2025-01-15"),
("2025-01-15","2024-07-11","2024-12-16","2025-05-28"),
("2025-05-28","2024-11-15","2025-04-28","2025-09-24"),
("2025-09-25","2025-03-27","2025-08-27","2026-01-29"),
("2026-01-29","2025-07-29","2025-12-30","2026-06-11")]
def num(x):
 s=str(x).replace(",","").strip()
 try:return float(s)
 except:return None
def getj(u):
 for a in range(5):
  try:
   r=S.get(u,timeout=35);r.raise_for_status();return r.json()
  except:time.sleep(.7*(a+1))
 return None
def twse(d):
 j=getj(f"https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date={d.replace('-','')}&type=ALLBUT0999&response=json");o={}
 if not isinstance(j,dict):return o
 for t in j.get("tables",[]):
  fs=t.get("fields",[])
  if "證券代號" in fs and any("收盤" in str(f) for f in fs):
   ci=fs.index("證券代號");pi=next(i for i,f in enumerate(fs) if "收盤" in str(f))
   for r in t.get("data",[]):
    c=str(r[ci]).strip();p=num(r[pi])
    if len(c)==4 and c.isdigit() and not c.startswith(("00","91")) and p and p>0:o[c]=p
   if o:break
 return o
def roc(d):
 x=datetime.strptime(d,"%Y-%m-%d");return f"{x.year-1911}/{x.month:02d}/{x.day:02d}"
def tpex(d):
 j=getj(f"https://www.tpex.org.tw/web/stock/aftertrading/otc_quotes_no1430/stk_wn1430_result.php?l=zh-tw&d={roc(d)}&se=EW&o=json");o={}
 if not isinstance(j,dict):return o
 for t in j.get("tables",[]):
  fs=t.get("fields",[])
  try:ci=next(i for i,f in enumerate(fs) if "代號" in str(f));pi=next(i for i,f in enumerate(fs) if "收盤" in str(f))
  except:continue
  for r in t.get("data",[]):
   c=str(r[ci]).strip();p=num(r[pi])
   if len(c)==4 and c.isdigit() and not c.startswith(("00","91")) and p and p>0:o[c]=p
  if o:break
 return o
def prices(d): return {**twse(d),**tpex(d)}
def mean(a):return sum(a)/len(a) if a else None
def perm(v,B=20000):
 random.seed(71319);obs=mean(v);e=0
 for _ in range(B):
  m=mean([x if random.random()<.5 else -x for x in v])
  if m>=obs:e+=1
 return (e+1)/(B+1)
def boot(v,B=10000):
 random.seed(31917);a=[]
 for _ in range(B):a.append(mean([random.choice(v) for __ in v]))
 a.sort();return [a[int(.025*(B-1))],a[int(.975*(B-1))]]
print("PROTOCOL",json.dumps({
 "source":"TWSE+TPEx official historical daily close endpoints",
 "sample":"full point-in-time market, 14 non-overlapping 84-trading-day horizons",
 "base":"MOM6 top3% across market",
 "locked_narrowing":["within top3%, recent 21-trading-day return top50%","top33%","top20%","top10%","pure MOM6 top0.75%","pure MOM6 top0.5%"],
 "outcome":"future84 return >=20%",
 "goal":"test whether ~10-stock pool keeps or improves top3% signal"
}))
need=sorted(set(x for c in CASES for x in c));P={}
for d in need:P[d]=prices(d)
rows=[]
for t,d126,d21,d84 in CASES:
 cs=set(P[d126])&set(P[d21])&set(P[t])&set(P[d84]);obs=[]
 for c in cs:
  mom=P[d21][c]/P[d126][c]-1; recent=P[t][c]/P[d21][c]-1; future=P[d84][c]/P[t][c]-1
  obs.append((c,mom,recent,future))
 obs.sort(key=lambda x:x[1],reverse=True);baseU=mean([x[3]>=.2 for x in obs])
 k3=max(1,math.ceil(len(obs)*.03));g3=obs[:k3];p3=mean([x[3]>=.2 for x in g3])
 rec={"date":t,"n":len(obs),"universe":baseU,"top3N":k3,"top3Precision":p3,"groups":{}}
 for frac in (.50,.33,.20,.10):
  g=sorted(g3,key=lambda x:x[2],reverse=True)[:max(1,math.ceil(k3*frac))]
  pr=mean([x[3]>=.2 for x in g]);rec["groups"][f"recent{frac}"]={"n":len(g),"precision":pr,"vsTop3":pr-p3,"vsUniverse":pr-baseU}
 for frac in (.0075,.005):
  k=max(1,math.ceil(len(obs)*frac));g=obs[:k];pr=mean([x[3]>=.2 for x in g]);rec["groups"][f"mom{frac}"]={"n":k,"precision":pr,"vsTop3":pr-p3,"vsUniverse":pr-baseU}
 rows.append(rec)
summary={}
for key in ["recent0.5","recent0.33","recent0.2","recent0.1","mom0.0075","mom0.005"]:
 v=[r["groups"][key]["vsTop3"] for r in rows];u=[r["groups"][key]["vsUniverse"] for r in rows]
 summary[key]={"avgN":mean([r["groups"][key]["n"] for r in rows]),"precision":mean([r["groups"][key]["precision"] for r in rows]),"liftVsTop3":mean(v),"vsTop3_positive":sum(x>0 for x in v)/len(v),"vsTop3_p":perm(v),"vsTop3_ci":boot(v),"liftVsUniverse":mean(u),"vsUniverse_p":perm(u),"vsUniverse_ci":boot(u)}
print("RESULT",json.dumps({"top3":{"avgN":mean([r["top3N"] for r in rows]),"precision":mean([r["top3Precision"] for r in rows])},"summary":summary,"byDate":rows},ensure_ascii=False))
