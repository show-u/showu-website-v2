// Research scaffold for Stock Price Model v2.
// Intentionally does not produce production buy/sell prices yet.

function mean(xs){ return xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : NaN; }

function quantile(xs,q){
  if(!xs.length) return NaN;
  const a=[...xs].sort((x,y)=>x-y);
  const p=(a.length-1)*q, lo=Math.floor(p), hi=Math.ceil(p);
  return lo===hi ? a[lo] : a[lo]+(a[hi]-a[lo])*(p-lo);
}

function wilson95(successes,n){
  if(!n) return [NaN,NaN];
  const z=1.959963984540054, p=successes/n, d=1+z*z/n;
  const c=(p+z*z/(2*n))/d;
  const h=z*Math.sqrt((p*(1-p)+z*z/(4*n))/n)/d;
  return [Math.max(0,c-h),Math.min(1,c+h)];
}

function evaluateEvents(events){
  const valid=events.filter(e=>Number.isFinite(e.forwardReturn)&&typeof e.hit==='boolean');
  const n=valid.length, hits=valid.filter(e=>e.hit).length;
  const returns=valid.map(e=>e.forwardReturn);
  const [ciLow,ciHigh]=wilson95(hits,n);
  return {
    n,
    hitRate:n?hits/n:NaN,
    hitRateCI95:[ciLow,ciHigh],
    meanForwardReturn:mean(returns),
    medianForwardReturn:quantile(returns,.5),
    p25ForwardReturn:quantile(returns,.25),
    p75ForwardReturn:quantile(returns,.75)
  };
}

function chronologicalSplits(bars,{train=504,validation=126,test=126}={}){
  const out=[];
  for(let start=0; start+train+validation+test<=bars.length; start+=test){
    out.push({
      train:bars.slice(start,start+train),
      validation:bars.slice(start+train,start+train+validation),
      test:bars.slice(start+train+validation,start+train+validation+test)
    });
  }
  return out;
}

module.exports={evaluateEvents,chronologicalSplits,wilson95};
