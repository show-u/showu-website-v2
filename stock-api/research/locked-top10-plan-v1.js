
/**
 * Locked Top-10 Research Plan v1
 * Purpose: test whether a transparent, point-in-time Taiwan-stock ranking can
 * (1) shrink universe to 20-50 candidates and
 * (2) rank a top-10 subset that beats the candidate pool out of sample.
 *
 * IMPORTANT: This file only declares the protocol and checks data availability.
 * It does NOT claim validation success.
 */
const API='https://api.finmindtrade.com/api/v4/data';
const START='2019-01-01',END='2026-09-25';
const FEATURES=[
  'MOM6_1',                 // 6-to-1 month price momentum
  'REV_SURPRISE_Z',         // standardized unexpected monthly revenue
  'REV_ACCEL_3M',           // latest YoY minus prior 3m mean YoY
  'REV_PERSISTENCE_3M',     // count of positive YoY accelerations in last 3 months
  'EARNINGS_SURPRISE',      // quarterly earnings surprise, when point-in-time reconstructable
  'ROE_OR_OP_MARGIN',       // profitability control
  'ASSET_GROWTH',           // investment control
  'HIGH52_PROX',            // distance to 52-week high
  'LIQUIDITY_20D',          // traded value
  'VOLATILITY_60D'          // risk control
];
const PROTOCOL={
  objective:'From Taiwan listed/OTC universe, produce a scientifically testable top-10 research list rather than a broad theme list.',
  stage1:{
    targetCount:'20-50',
    rule:'Cross-sectional candidate score formed only from predeclared evidence-backed signals: MOM6_1 + standardized unexpected monthly revenue. No sector/theme overrides.',
    reason:'Momentum and Taiwan monthly-revenue information have prior empirical support; stage1 is only candidate generation.'
  },
  stage2:{
    targetCount:10,
    rule:'Rank stage1 candidates with a regularized logistic model trained only on past dates. No manual stock selection.',
    label:'future 84-trading-day total return >= +20%',
    features:FEATURES,
    fallback:'Features not reconstructable point-in-time are dropped before the first run and documented; they are never backfilled with future information.'
  },
  validation:{
    design:'expanding walk-forward by date; train strictly before test date',
    primaryPeriod:'2023-01-01 through 2026-06-30 test dates',
    formationSpacing:'>=84 trading days for primary significance test',
    comparisons:[
      'Top10 vs full eligible universe',
      'Top10 vs Stage1 candidate pool',
      'Top10 vs MOM6-only top10',
      'Top20 and Top50 sensitivity'
    ],
    success:[
      'Top10 future +20% hit-rate > Stage1 pool',
      'Paired date-level lift > 0',
      'one-sided permutation p < 0.05',
      '95% bootstrap CI lower bound > 0',
      'positive lift in both 2023-24 and 2025-26 subperiods',
      'result remains positive after conservative transaction-cost stress',
      'no look-ahead and all feature timestamps <= formation date'
    ],
    failure:'If these conditions are not met, method is not accepted even if a single aggregate return looks attractive.'
  },
  integrity:{
    noPostHocThresholds:true,
    noManualTop10:true,
    noThemeOverride:true,
    noClaimWithoutRunOutput:true,
    noIndependentClaimWithoutZeroOverlapProof:true
  }
};

async function fm(dataset,id,start=START,end=END){
  const u=new URL(API);u.searchParams.set('dataset',dataset);
  if(id)u.searchParams.set('data_id',id);
  u.searchParams.set('start_date',start);u.searchParams.set('end_date',end);
  const r=await fetch(u);
  let j={};try{j=await r.json()}catch{}
  return {status:r.status,n:Array.isArray(j.data)?j.data.length:0,first:Array.isArray(j.data)&&j.data.length?j.data[0]:null,last:Array.isArray(j.data)&&j.data.length?j.data.at(-1):null,msg:j.msg||null};
}

(async()=>{
  const probeId='2301';
  const datasets=[
    'TaiwanStockPrice',
    'TaiwanStockMonthRevenue',
    'TaiwanStockFinancialStatements',
    'TaiwanStockCashFlowsStatement',
    'TaiwanStockPER',
    'TaiwanStockInstitutionalInvestorsBuySell'
  ];
  const availability={};
  for(const ds of datasets) availability[ds]=await fm(ds,probeId);
  console.log('PROTOCOL',JSON.stringify(PROTOCOL));
  console.log('DATA_AVAILABILITY',JSON.stringify(availability));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
