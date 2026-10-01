
import json, requests
tests=[
 ("twse","https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date=20260924&type=ALLBUT0999&response=json"),
 ("tpex","https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes?date=2026/09/24&id=&response=json"),
]
for name,u in tests:
    r=requests.get(u,headers={"User-Agent":"Mozilla/5.0"},timeout=30)
    try:j=r.json()
    except Exception:j={"raw":r.text[:500]}
    out={"name":name,"status":r.status_code,"keys":list(j.keys()) if isinstance(j,dict) else [],"sample":{}}
    if name=="twse" and isinstance(j,dict):
        out["sample"]={"stat":j.get("stat"),"tables":[{"title":t.get("title"),"fields":t.get("fields",[])[:10],"rows":len(t.get("data",[])),"first":t.get("data",[])[:1]} for t in j.get("tables",[]) if t.get("data")][:5]}
    if name=="tpex" and isinstance(j,dict):
        out["sample"]={"stat":j.get("stat"),"tables":[{"title":t.get("title"),"fields":t.get("fields",[])[:10],"rows":len(t.get("data",[])),"first":t.get("data",[])[:1]} for t in j.get("tables",[]) if t.get("data")][:5],"data_len":len(j.get("aaData",[]))}
    print("TEST",json.dumps(out,ensure_ascii=False))
