
import io, json, requests, pandas as pd
urls=[
 "https://mopsov.twse.com.tw/nas/t21/sii/t21sc03_115_8_0.html",
 "https://mopsov.twse.com.tw/nas/t21/otc/t21sc03_115_8_0.html",
 "https://mopsov.twse.com.tw/nas/t21/sii/t21sc03_109_6_0.html",
]
for u in urls:
    r=requests.get(u,headers={"User-Agent":"Mozilla/5.0"},timeout=30)
    out={"url":u,"status":r.status_code,"len":len(r.content)}
    try:
        text=r.content.decode("big5","ignore")
        tabs=pd.read_html(io.StringIO(text))
        out["tables"]=len(tabs)
        found=[]
        for df in tabs:
            cols=[str(c) for c in df.columns]
            sample=[[str(v) for v in row] for row in df.head(2).to_numpy().tolist()]
            if df.shape[1]>=8:
                found.append({"shape":list(df.shape),"cols":cols[:12],"sample":sample[:1]})
        out["candidates"]=found[:3]
    except Exception as e:
        out["error"]=repr(e)
    print("TEST",json.dumps(out,ensure_ascii=False))
