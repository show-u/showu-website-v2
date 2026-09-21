const stocks=['2330','2454','2409','2317','2303','2881','6488','5483'];

async function run(){
  for(const stock of stocks){
    const ctrl=new AbortController();
    const t=setTimeout(()=>ctrl.abort(),90000);
    try{
      const r=await fetch(`http://127.0.0.1:3000/api/analyze?stock=${stock}`,{signal:ctrl.signal});
      const j=await r.json();
      if(!r.ok||!j.ok) throw new Error(j.error||('HTTP '+r.status));
      if(!j.stock?.code||j.stock.code!==stock) throw new Error('stock mismatch');
      if(!['TWSE','TPEx'].includes(j.stock.market)) throw new Error('market missing');
      if(!(j.stock.bars>=60)) throw new Error('bars < 60');
      if(!Number.isFinite(j.latest)) throw new Error('latest missing');
      if(!j.prices||!j.confidence) throw new Error('analysis missing');
      console.log(JSON.stringify({stock,name:j.stock.name,market:j.stock.market,date:j.stock.date,bars:j.stock.bars,latest:j.latest,confidence:j.confidence.score}));
    } finally {
      clearTimeout(t);
    }
  }
}
run().catch(e=>{console.error(e);process.exit(1)});
