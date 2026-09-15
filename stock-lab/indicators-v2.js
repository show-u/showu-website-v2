// Deterministic indicator formula layer v2.
// RSI uses J. Welles Wilder's 14-period smoothing instead of a simple rolling average.
rsi=function(r,p=14){
  if(!Array.isArray(r)||r.length<=p)return null;
  let gain=0,loss=0;
  for(let i=1;i<=p;i++){
    const d=r[i].c-r[i-1].c;
    if(d>0)gain+=d;else loss-=d;
  }
  let avgGain=gain/p,avgLoss=loss/p;
  for(let i=p+1;i<r.length;i++){
    const d=r[i].c-r[i-1].c;
    const g=d>0?d:0,l=d<0?-d:0;
    avgGain=(avgGain*(p-1)+g)/p;
    avgLoss=(avgLoss*(p-1)+l)/p;
  }
  if(avgLoss===0)return avgGain===0?50:100;
  const rs=avgGain/avgLoss;
  return 100-(100/(1+rs));
};
window.StockLabFormulaVersion={...(window.StockLabFormulaVersion||{}),rsi:'Wilder RSI 14 v2'};
