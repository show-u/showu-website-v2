// Public runtime switches only. Never place secrets here.
// Production prediction is fail-closed: every gate below must be explicitly true before local numeric predictions may run.
window.STOCKLAB_RUNTIME={
  apiBase:'',
  architecture:'backend-first-migration',
  hardPolicyVersion:5,
  allowLocalFallback:false,
  productionPredictionReady:false,
  gates:{
    licensedHistoricalOHLC:false,
    securityMaster:false,
    corporateActions:false,
    financialSchemaCoverage:false,
    taiwanRiskState:false,
    oosValidation:false
  },
  blockers:[
    '60 個月歷史 OHLC 尚未取得可明確重用／回測的授權資料源，因此正式 OOS 驗證維持 BLOCKED_LEGAL_SOURCE',
    '普通股／ETF／ETN／TDR／特殊商品分類 Gate 尚未完成，未知商品不得硬套普通股模型',
    '除權息可取得 OGDL 資料，但減資、首五日無漲跌幅、暫停／恢復交易等參考價事件尚未整合成完整 Gate',
    '金融／保險／證券期貨／金控／異業財報 schema 尚未完整覆蓋；不能以一般業財報替代',
    '注意／處置／信用交易等台股風險狀態需完成同交易日與有效期間驗證，未知不得視為正常',
    '正式樣本外驗證尚未建立在合法且完整的歷史資料源上，任何研究分數都不是勝率或已驗證推薦'
  ]
};
window.STOCKLAB_HARD_READY=import('./hard-policy.js')
  .then(()=>window.StockLabHardPolicy.ready())
  .catch(e=>{console.error('StockLab hard policy unavailable',e);return null});
