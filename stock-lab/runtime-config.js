// Public runtime switches only. Never place secrets here.
// Production prediction is fail-closed: every required gate must be explicitly true before numeric recommendations may run.
window.STOCKLAB_RUNTIME={
  apiBase:'',
  architecture:'backend-first-migration',
  hardPolicyVersion:9,
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
    entryConfidenceCalibration:false,
    holdingExitValidation:false,
    holdingConfidenceCalibration:false,
    entryScannerOosValidation:false,
    scannerConfidenceCalibration:false
  },
  blockers:[
    '合法歷史 OHLC 尚未形成足夠長期、可重現樣本；九項技術入場因子與正式 OOS 驗證因此維持 BLOCKED_LEGAL_SOURCE',
    '普通股／ETF／ETN／TDR／特殊商品分類 Gate 尚未完成，未知商品不得硬套普通股模型',
    '交易日曆尚未接入正式 Gate；沒有交易日曆時不得把「明天」直接等同「下一交易日」',
    '除權息可取得部分 OGDL 資料，但減資、首五日無漲跌幅、暫停／恢復交易等參考價事件尚未整合成完整 Gate',
    '注意／處置／信用交易等台股風險狀態需完成同交易日與有效期間驗證，未知不得視為正常',
    '美股背景只接受通過來源、日期、內容與雜湊驗證的 NASDAQ／SOX／VIX；缺任何必要項目就標示未知，不補值',
    '台指期 TX 必須通過 TAIFEX 來源與交叉驗證；未通過就不能形成完整入場結論',
    '國際時事自動資料流尚未完成合法來源、事件日、發布日與交叉驗證；未知不得寫成「沒有重大事件」',
    'TOP10 與單股入場都使用同一套九項因子＋美股＋台指期＋國際時事模型；這些因素只供內部判斷，不在簡潔頁面逐項展開',
    '信心指數必須由正式樣本外結果校準；沒有 calibration PASS 時不得用正向因子數、主觀權重或 heuristic 冒充信心指數',
    '每一檔 TOP10 必須保留可稽核的入榜理由與主要風險；公開頁面可簡化顯示，但後端 audit 不得刪除',
    '沒有合法即時／延遲行情授權時，09:00 後禁止重算「當日可執行價格」；只能保留原計畫作標示清楚的參考紀錄',
    '收盤後排程時間不是資料完成證明；只有官方資料日期前進且所有必要輸入都驗證通過，才能建立新計畫'
  ]
};
window.STOCKLAB_HARD_READY=import('./hard-policy.js')
  .then(()=>window.StockLabHardPolicy.ready())
  .catch(e=>{console.error('StockLab hard policy unavailable',e);return null});
import('./data-status.js').catch(e=>console.error('StockLab data status unavailable',e));
