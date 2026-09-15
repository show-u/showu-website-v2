// Public runtime switches only. Never place secrets here.
// Production prediction is fail-closed: every gate below must be explicitly true before local numeric predictions may run.
window.STOCKLAB_RUNTIME={
  apiBase:'',
  architecture:'backend-first-migration',
  hardPolicyVersion:4,
  allowLocalFallback:false,
  productionPredictionReady:false,
  gates:{
    licensedHistoricalOHLC:false,
    securityMaster:false,
    corporateActions:false,
    financialSchemaCoverage:false,
    taiwanRiskState:true,
    oosValidation:false
  },
  blockers:[
    '歷史 OHLC 自動使用授權尚未完成資料集層級驗證',
    '普通股／ETF／ETN／TDR／特殊商品分類 Gate 尚未完成',
    '除權息／減資／新上市無漲跌幅等參考價事件 Gate 尚未完成',
    '金融／保險／證券期貨／金控／異業財報 schema 尚未完整覆蓋',
    '正式樣本外驗證尚未建立在已確認合法的歷史資料源上'
  ]
};
window.STOCKLAB_HARD_READY=import('./hard-policy.js')
  .then(()=>window.StockLabHardPolicy.ready())
  .catch(e=>{console.error('StockLab hard policy unavailable',e);return null});
