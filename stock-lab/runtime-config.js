// Public runtime switches only. Never place secrets here.
// Production prediction is fail-closed: every required gate must be explicitly true before numeric recommendations may run.
window.STOCKLAB_RUNTIME={
  apiBase:'',
  architecture:'backend-first-online-only',
  hardPolicyVersion:10,
  dataMode:'online-only',
  persistentMarketData:false,
  allowLocalFallback:false,
  productionPredictionReady:false,
  gates:{
    licensedHistoricalOHLC:false,
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
    holdingExitValidation:false,
    holdingExitExecutionValidation:false,
    holdingConfidenceCalibration:false,
    entryScannerOosValidation:false,
    scannerConfidenceCalibration:false
  },
  blockers:[
    '歷史 OHLC 必須在每次分析／回測時由合法網路來源取得；不得等待或依賴自建 archive、browser-data、history-ogdl 等持久備份。若合法網路來源無法提供足夠歷史深度，維持 INSUFFICIENT。',
    '普通股／ETF／ETN／TDR／特殊商品分類 Gate 尚未完成，未知商品不得硬套普通股模型',
    '交易日曆必須由合法網路來源當次取得或由合法後端即時查詢；沒有交易日曆時不得把「明天」直接等同「下一交易日」',
    '除權息、減資、首五日無漲跌幅、暫停／恢復交易等參考價事件必須由合法網路來源取得並驗證；缺漏不得推測',
    '注意／處置／信用交易等台股風險狀態需完成同交易日與有效期間驗證，未知不得視為正常',
    '美股背景只接受通過來源、日期與內容驗證的 NASDAQ／SOX／VIX；缺任何必要項目就標示未知，不補值',
    '台指期 TX 必須通過 TAIFEX 來源與交叉驗證；未通過就不能形成完整入場結論',
    '國際時事自動資料流尚未完成合法來源、事件日、發布日與交叉驗證；未知不得寫成「沒有重大事件」',
    'TOP10 與單股入場使用同一套完整模型；所有必要資料均須當次網路取得並通過 Gate',
    '進場區間必須在正式 OOS 中驗證觸價／成交可達性；常給買不到的深層支撐價，即使事後報酬漂亮也不得 PASS',
    '信心指數必須由正式樣本外結果校準；沒有 calibration PASS 時不得用正向因子數、主觀權重或 heuristic 冒充信心指數',
    '持股出場價格也必須驗證實際執行邏輯；不得用事後才知道的高低點假裝可成交出場價',
    '每一檔 TOP10 必須保留可稽核的入榜理由與主要風險；公開頁面可簡化顯示，但後端 audit 不得刪除',
    '沒有合法即時／延遲行情授權時，09:00 後禁止聲稱知道當日目前可執行價格；只能顯示已驗證事實或下一交易時段條件',
    '收盤後時間不是資料完成證明；只有當次網路查詢確認官方資料日期前進且必要輸入全部通過，才能建立下一交易時段計畫',
    '任何網路資料取得失敗、授權不明、日期錯誤或交叉驗證失敗，一律維持 unavailable；禁止用舊檔、備份、0、平均值、模型值或 AI 補值。'
  ]
};
window.STOCKLAB_HARD_READY=import('./hard-policy.js')
  .then(()=>window.StockLabHardPolicy.ready())
  .catch(e=>{console.error('StockLab hard policy unavailable',e);return null});
import('./data-status.js').catch(e=>console.error('StockLab data status unavailable',e));
