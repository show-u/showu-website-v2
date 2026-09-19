import hashlib,json,math,time,urllib.request
from datetime import datetime,timezone
from urllib.parse import urlparse

OUT='stock-lab/research-facts.json'
registry=json.load(open('stock-lab/source-registry.json',encoding='utf-8'))['sources']
UA={'User-Agent':'StockLab-OGDL-ResearchFacts/1.0','Accept':'application/json'}
def fetch_json(url):
    err=None
    for attempt in range(1,4):
        try:
            req=urllib.request.Request(url,headers=UA)
            with urllib.request.urlopen(req,timeout=30) as r:
                body=r.read(); final=r.geturl()
            return json.loads(body.decode('utf-8-sig')),hashlib.sha256(body).hexdigest(),final
        except Exception as e:
            err=e
            if attempt<3:time.sleep(attempt*2)
    raise err
def num(v):
    s=str(v if v is not None else '').strip().replace(',','').replace('%','')
    if s in ('','-','--','—','N/A','NA','null'):return None
    try:
        x=float(s);return x if math.isfinite(x) else None
    except:return None
def norm_date(v):
    s=''.join(ch for ch in str(v or '') if ch.isdigit())
    if len(s)==7:return f'{int(s[:3])+1911:04d}-{s[3:5]}-{s[5:7]}'
    if len(s)==8:return f'{s[:4]}-{s[4:6]}-{s[6:8]}'
    return None
def norm_year(v):
    s=''.join(ch for ch in str(v or '') if ch.isdigit())
    if len(s)==3:return int(s)+1911
    if len(s)==4:return int(s)
    return None
def norm_ym(v):
    s=''.join(ch for ch in str(v or '') if ch.isdigit())
    if len(s)==5:return f'{int(s[:3])+1911:04d}{s[3:5]}'
    if len(s)==6:return s
    return None
def source(key):
    s=registry[key]
    if s.get('license')!='OGDL-1.0' or s.get('legal_status')!='approved_open_data':
        raise RuntimeError(f'{key}: legal status not approved')
    return s
status={};stocks={};market={}
def rec(market_name,code):
    return stocks.setdefault(f'{market_name}:{code}',{'market':market_name,'ticker':code})

def load(key,required):
    s=source(key)
    try:
        raw,sha,final=fetch_json(s['url'])
        if not isinstance(raw,list) or not raw:raise RuntimeError('empty/non-list')
        miss=[k for k in required if k not in raw[0]]
        if miss:raise RuntimeError('exact schema mismatch: '+','.join(miss))
        status[key]={'ok':True,'rows':len(raw),'raw_sha256':sha,'licence':'OGDL-1.0','source_url':s['url']}
        return raw,sha
    except Exception as e:
        status[key]={'ok':False,'reason':str(e),'licence':'OGDL-1.0','source_url':s['url']}
        return [],None

# Valuation: exact field names, no synonyms.
rows,sha=load('twse_valuation',['Date','Code','Name','PEratio','DividendYield','PBratio'])
for x in rows:
    c=str(x['Code']).strip()
    if not c:continue
    rec('TWSE',c)['valuation']={'verified':True,'date':norm_date(x['Date']),'pe':num(x['PEratio']),'pb':num(x['PBratio']),'dividend_yield':num(x['DividendYield']),'source_id':'twse_valuation','raw_sha256':sha,'provenance':'observed'}
rows,sha=load('tpex_valuation',['Date','SecuritiesCompanyCode','PriceEarningRatio','YieldRatio','PriceBookRatio'])
for x in rows:
    c=str(x['SecuritiesCompanyCode']).strip()
    if not c:continue
    rec('TPEx',c)['valuation']={'verified':True,'date':norm_date(x['Date']),'pe':num(x['PriceEarningRatio']),'pb':num(x['PriceBookRatio']),'dividend_yield':num(x['YieldRatio']),'source_id':'tpex_valuation','raw_sha256':sha,'provenance':'observed'}

# Monthly revenue.
rev_req=['出表日期','資料年月','公司代號','公司名稱','營業收入-當月營收','營業收入-上月比較增減(%)','營業收入-去年同月增減(%)','累計營業收入-當月累計營收','累計營業收入-前期比較增減(%)']
for market_name,key in [('TWSE','twse_monthly_revenue'),('TPEx','tpex_monthly_revenue')]:
    rows,sha=load(key,rev_req)
    for x in rows:
        c=str(x['公司代號']).strip();p=norm_ym(x['資料年月'])
        if not c or not p:continue
        z={'verified':True,'report_date':norm_date(x['出表日期']),'period':p,'current_revenue':num(x['營業收入-當月營收']),'mom':num(x['營業收入-上月比較增減(%)']),'yoy':num(x['營業收入-去年同月增減(%)']),'ytd_revenue':num(x['累計營業收入-當月累計營收']),'ytd':num(x['累計營業收入-前期比較增減(%)']),'source_id':key,'raw_sha256':sha,'provenance':'observed'}
        old=rec(market_name,c).get('revenue')
        if old is None or p>old['period']:rec(market_name,c)['revenue']=z

# General-industry quarterly statements only. Financial/insurance/securities/holding/mixed companies remain unavailable here.
inc_req=['出表日期','年度','季別','公司代號','公司名稱','營業收入','營業毛利（毛損）','營業利益（損失）','本期淨利（淨損）','基本每股盈餘（元）']
bal_req=['出表日期','年度','季別','公司代號','公司名稱','流動資產','資產總計','流動負債','負債總計','權益總計']
income={}
balance={}
for market_name,key in [('TWSE','twse_income_statement'),('TPEx','tpex_income_statement')]:
    rows,sha=load(key,inc_req)
    for x in rows:
        c=str(x['公司代號']).strip();y=norm_year(x['年度']);q=int(num(x['季別']) or 0)
        if not c or not y or q not in (1,2,3,4):continue
        k=(market_name,c);z={'year':y,'quarter':q,'report_date':norm_date(x['出表日期']),'revenue':num(x['營業收入']),'gross_profit':num(x['營業毛利（毛損）']),'operating_income':num(x['營業利益（損失）']),'net_income':num(x['本期淨利（淨損）']),'eps':num(x['基本每股盈餘（元）']),'source_id':key,'raw_sha256':sha}
        if k not in income or (y,q)>(income[k]['year'],income[k]['quarter']):income[k]=z
for market_name,key in [('TWSE','twse_balance_sheet'),('TPEx','tpex_balance_sheet')]:
    rows,sha=load(key,bal_req)
    for x in rows:
        c=str(x['公司代號']).strip();y=norm_year(x['年度']);q=int(num(x['季別']) or 0)
        if not c or not y or q not in (1,2,3,4):continue
        k=(market_name,c);z={'year':y,'quarter':q,'report_date':norm_date(x['出表日期']),'current_assets':num(x['流動資產']),'total_assets':num(x['資產總計']),'current_liabilities':num(x['流動負債']),'total_liabilities':num(x['負債總計']),'total_equity':num(x['權益總計']),'source_id':key,'raw_sha256':sha}
        if k not in balance or (y,q)>(balance[k]['year'],balance[k]['quarter']):balance[k]=z
for k,i in income.items():
    market_name,c=k;b=balance.get(k);rev=i['revenue']
    q=dict(i);q['verified']=True;q['provenance']='observed+derived'
    q['gross_margin']=i['gross_profit']/rev*100 if rev not in (None,0) and i['gross_profit'] is not None else None
    q['operating_margin']=i['operating_income']/rev*100 if rev not in (None,0) and i['operating_income'] is not None else None
    q['net_margin']=i['net_income']/rev*100 if rev not in (None,0) and i['net_income'] is not None else None
    rec(market_name,c)['quarterly']=q
    if b and (b['year'],b['quarter])==(i['year'],i['quarter']):
        ta,tl,ca,cl=b['total_assets'],b['total_liabilities'],b['current_assets'],b['current_liabilities']
        rec(market_name,c)['financial_quality']={'verified':True,'year':b['year'],'quarter':b['quarter'],'report_date':b['report_date'],'total_assets':ta,'total_liabilities':tl,'total_equity':b['total_equity'],'current_assets':ca,'current_liabilities':cl,'debt_ratio':tl/ta*100 if ta not in (None,0) and tl is not None else None,'current_ratio':ca/cl if cl not in (None,0) and ca is not None else None,'source_id':b['source_id'],'raw_sha256':b['raw_sha256'],'provenance':'observed+derived'}

# TPEx institutional investors: exact registered English schema only.
inst_req=['Date','SecuritiesCompanyCode','ForeignAndMainlandInvestorsBuySell','InvestmentTrustBuySell','DealerBuySell','TotalBuySell']
rows,sha=load('tpex_institution',inst_req)
for x in rows:
    c=str(x['SecuritiesCompanyCode']).strip()
    if not c:continue
    rec('TPEx',c)['institution']={'verified':True,'date':norm_date(x['Date']),'foreign':num(x['ForeignAndMainlandInvestorsBuySell']),'trust':num(x['InvestmentTrustBuySell']),'dealer':num(x['DealerBuySell']),'total':num(x['TotalBuySell']),'source_id':'tpex_institution','raw_sha256':sha,'provenance':'observed'}

# TWSE market context and breadth are legal OGDL sources.
rows,sha=load('twse_market_daily',['Date','TradeVolume','TradeValue','Transaction','TAIEX','Change'])
if rows:
    x=max(rows,key=lambda z:norm_date(z['Date']) or '')
    market['taiex']={'verified':True,'date':norm_date(x['Date']),'close':num(x['TAIEX']),'change_points':num(x['Change']),'trade_value':num(x['TradeValue']),'source_id':'twse_market_daily','raw_sha256':sha,'provenance':'observed'}
rows,sha=load('twse_breadth',['出表日期','類型','上漲','漲停','下跌','跌停','持平','未成交','無比價'])
stock_rows=[x for x in rows if str(x['類型']).strip()=='股票']
if stock_rows:
    x=max(stock_rows,key=lambda z:norm_date(z['出表日期']) or '')
    bd={'verified':True,'date':norm_date(x['出表日期']),'up':int(num(x['上漲']) or 0),'limit_up':int(num(x['漲停']) or 0),'down':int(num(x['下跌']) or 0),'limit_down':int(num(x['跌停']) or 0),'flat':int(num(x['持平']) or 0),'source_id':'twse_breadth','raw_sha256':sha,'provenance':'observed'}
    if market.get('taiex',{}).get('date')==bd['date']:market['twse_breadth']=bd
    else:status['twse_breadth']['ok']=False;status['twse_breadth']['reason']='breadth date does not match latest TAIEX date'

out={'schema_version':1,'source':'ogdl-normalized-research-facts','licence':'OGDL-1.0','no_imputation':True,'status':'ok' if any(v.get('ok') for v in status.values()) else 'unavailable','generated_at':datetime.now(timezone.utc).isoformat(),'source_status':status,'market':market,'stocks':stocks}
with open(OUT,'w',encoding='utf-8') as f:json.dump(out,f,ensure_ascii=False,separators=(',',':'))
print(json.dumps({'stocks':len(stocks),'sources':status,'market':market},ensure_ascii=False)[:12000])
