// Public runtime switches only. Never place secrets here.
// Production prediction is fail-closed: every required gate must be explicitly true before numeric recommendations may run.
window.STOCKLAB_RUNTIME={
  apiBase:'',
  architecture:'backend-first-migration',
  hardPolicyVersion:6,
  allowLocalFallback:false,
  productionPredictionReady:false,
  gates:{
    licensedHistoricalOHLC:false,
    securityMaster:false,
    tradingCalendar:false,
    corporateActions:false,
    financialSchemaCoverage:false,
    taiwanRiskState:false,
    buyModelOosValidation:false,
    holdingExitValidation:false,
    scannerOosValidation:false
  },
  blockers:[
    '60 個月歷史 OHLC 尚未取得可明確重用／回測的授權資料源，因此買入、持股出場與正式 OOS 驗證維持 BLOCKED_LEGAL_SOURCE',
    '普通股／ETF／ETN／TDR／特殊商品分類 Gate 尚未完成，未知商品不得硬套普通股模型',
    '交易日曆尚未接入正式 Gate；沒有交易日曆時不得把「明天」直接等同「下一交易日」',
    '除權息可取得 OGDL 資料，但減資、首五日無漲跌幅、暫停／恢復交易等參考價事件尚未整合成完整 Gate',
    '金融／保險／證券期貨／金控／異業財報 schema 尚未完整覆蓋；不能以一般業財報替代',
    '注意／處置／信用交易等台股風險狀態需完成同交易日與有效期間驗證，未知不得視為正常',
    '買入模型、持股出場模型與 TOP10 選股模型都必須各自完成正式樣本外驗證，不能共用一個 PASS 冒充全部模型已驗證'
  ]
};
window.STOCKLAB_HARD_READY=import('./hard-policy.js')
  .then(()=>window.StockLabHardPolicy.ready())
  .catch(e=>{console.error('StockLab hard policy unavailable',e);return null});
