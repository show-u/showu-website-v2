// Public runtime switches only. Never place secrets here.
// Predictive entry remains fail-closed. Existing-position management is a separate verified rule path.
window.STOCKLAB_RUNTIME={
  apiBase:'',
  architecture:'free-official-first-backend-online',
  hardPolicyVersion:16,
  dataMode:'free-official-first',
  persistentMarketData:false,
  allowLocalFallback:false,
  productionPredictionReady:false,
  holdingRulePathEnabled:true,
  ruleBasedEntryReferenceEnabled:true,
  sectorResearchEnabled:true,
  freeOfficialHistoryPriority:true,
  verifiedOgdlArchiveHistoryEnabled:true,
  entryPriceDecisionLayersSeparated:true,
  gates:{
    licensedHistoricalOHLC:false,
    twseFreeOfficialHistoryTechnical:true,
    twseFreeOfficialHistoryProductionActive:false,
    tpexFreeLongHistoryConfirmed:false,
    securityMaster:false,
    tradingCalendar:false,
    corporateActions:false,
    financialSchemaCoverage:false,
    taiwanRiskState:false,
    entryNineFactors:false,
    usMarketContext:false,
    txFuturesContext:false,
    internationalEventFeed:false,
    entryDecisionOosValidation:false,
    entryRangeExecutionValidation:false,
    entryConfidenceCalibration:false,
    entryScannerOosValidation:false,
    scannerConfidenceCalibration:false
  },
  blockers:[
    'TWSE 免費官方歷史已完成 2454／2330 各 1,386 個交易日技術驗證，但歷史端點自動化使用條款與 PIT／公司行動語意尚未完成 production activation；TPEx 完整免費長歷史 OHLCV 仍待確認。預測型入場模型因此維持 INSUFFICIENT，不得補值。',
    '普通股／ETF／ETN／TDR／特殊商品分類 Gate 尚未完成時，未知商品不得硬套普通股模型。',
    '交易日曆未驗證時不得把「明天」直接等同「下一交易日」；但只要價格歷史 Gate 已通過，不得因此抹除已形成的價格結構，日期改標示為「下一交易時段／精確交易日尚未驗證」。',
    '除權息、減資、首五日無漲跌幅、暫停／恢復交易等參考價事件缺漏時不得推測。',
    '注意／處置／信用交易等台股風險狀態未知時不得視為正常。',
    '美股背景只接受通過來源、日期與內容驗證的資料；缺必要項目就標示未知，不補值。',
    '台指期 TX 必須通過合法來源與交叉驗證；未通過就不能形成完整預測型入場結論。',
    '國際時事資料未知不得寫成「沒有重大事件」。',
    '單股新部位研究分成兩層：價格結構只要求至少 60 根合法已驗證 OHLC 與台股價格規則；9+3 只決定現在買、等回檔、突破後買或暫不建立部位。9+3 缺項不得抹除已合法形成的價格層。規則式價格結構可直接顯示為 derived reference；只有勝率、機率或預測型可執行價宣稱才需要 OOS、可達性與校準 Gate。',
    '進場區間必須驗證觸價／成交可達性；深層支撐只能是條件式等待情境，不能冒充目前可買價格，也不能用來製造漂亮回測。',
    '沒有 calibration PASS 時不得用正向因子數、主觀權重或 heuristic 冒充勝率／信心指數。',
    '已持有股票不受 OOS 總開關限制；手動模式只接受成本均價、持有股數、首次買入時間，總成本固定由均價×股數計算。只要部位資料與合法已驗證收盤可用，就必須輸出成本損益、成本零界與下一交易時段執行定價基準。60 根合法歷史只限制 MA／ATR／價格結構風險線，不得把整個持股價格分析鎖住；缺少結構時該欄維持 unavailable，不得捏造。',
    '任何未來的預測型出場價、勝率、機率或校準信心，仍須另行通過正式 OOS 與執行驗證，不得與目前規則式持股管理混用。',
    '沒有合法即時／延遲行情授權時，09:00 後禁止聲稱知道當日目前可執行價格；只能顯示已驗證完成交易日事實或下一交易時段條件。',
    '收盤後時間不是資料完成證明；只有當次合法來源確認官方資料日期前進且必要輸入全部通過，才能建立下一交易時段計畫。',
    '任何資料取得失敗、授權不明、日期錯誤或交叉驗證失敗，一律維持 unavailable；禁止用舊檔、0、平均值、模型值或 AI 補值。'
  ]
};
window.STOCKLAB_HARD_READY=import('./hard-policy.js')
  .then(()=>window.StockLabHardPolicy.ready())
  .catch(e=>{console.error('StockLab hard policy unavailable',e);return null});
import('./data-status.js?v=20260918-freehist-v12').catch(e=>console.error('StockLab data status unavailable',e));
