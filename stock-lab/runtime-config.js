// Public runtime switches only. Never place secrets here.
// Production prediction is fail-closed: every required gate must be explicitly true before numeric recommendations may run.
window.STOCKLAB_RUNTIME={
  apiBase:'',
  architecture:'backend-first-migration',
  hardPolicyVersion:8,
  allowLocalFallback:false,
  productionPredictionReady:false,
  gates:{
    licensedHistoricalOHLC:false,
    securityMaster:false,
    tradingCalendar:false,
    corporateActions:false,
    financialSchemaCoverage:false,
    taiwanRiskState:false,
    dividendData:false,
    buyModelOosValidation:false,
    holdingExitValidation:false,
    scannerMomentumOosValidation:false,
    scannerGrowthOosValidation:false,
    scannerIncomeOosValidation:false,
    scannerTotalReturnOosValidation:false
  },
  blockers:[
    'OGDL 每日 OHLC 已開始前瞻式累積，但尚未形成足夠長期、可重現的合法歷史樣本；買入、持股出場與正式 OOS 驗證維持 BLOCKED_LEGAL_SOURCE',
    '普通股／ETF／ETN／TDR／特殊商品分類 Gate 尚未完成，未知商品不得硬套普通股模型',
    '交易日曆尚未接入正式 Gate；沒有交易日曆時不得把「明天」直接等同「下一交易日」',
    '除權息可取得 OGDL 資料，但減資、首五日無漲跌幅、暫停／恢復交易等參考價事件尚未整合成完整 Gate',
    '金融／保險／證券期貨／金控／異業財報 schema 尚未完整覆蓋；不能以一般業財報替代',
    '注意／處置／信用交易等台股風險狀態需完成同交易日與有效期間驗證，未知不得視為正常',
    '股利分派與除權息 OGDL 資料集已納入政策白名單，但實際股利歷史資料層尚未完整接入，因此股息收益／長期總報酬 TOP10 目前不得假裝已完成',
    '短線價差、成長波段、股息收益、長期總報酬四個 TOP10 策略必須各自完成正式 OOS；不能共用同一排行或同一個 PASS 冒充四套模型',
    '每一檔 TOP10 必須輸出可追溯的入榜理由與主要風險；只有排名與分數不算完成',
    '沒有合法即時／延遲行情授權時，09:00 後禁止重算「當日可執行價格」；只能保留原計畫作標示清楚的參考紀錄',
    '收盤後排程時間不是資料完成證明；只有官方資料日期前進且所有目標交易時段必要輸入都驗證通過，才能建立新計畫'
  ]
};
window.STOCKLAB_HARD_READY=import('./hard-policy.js')
  .then(()=>window.StockLabHardPolicy.ready())
  .catch(e=>{console.error('StockLab hard policy unavailable',e);return null});
// Facts-only status layer: shows the verified legal data cutoff and never infers readiness from the clock.
import('./data-status.js').catch(e=>console.error('StockLab data status unavailable',e));
