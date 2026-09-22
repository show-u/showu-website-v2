const { chromium } = require('playwright');

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:412,height:915}});
  const base='https://www.showujapan.com/stock-price/';

  for(const [code,market,name] of [
    ['2409','TWSE','友達'],
    ['6488','TPEx','環球晶']
  ]){
    await page.goto(base,{waitUntil:'networkidle',timeout:120000});
    await page.fill('#query',code);
    await page.click('#submit');
    await Promise.race([
      page.waitForSelector('#result:not([hidden])',{timeout:120000}),
      page.waitForSelector('#error:not([hidden])',{timeout:120000}).then(async()=>{
        throw new Error(code+' frontend error: '+await page.textContent('#error'));
      })
    ]);
    const gotMarket=(await page.textContent('#market')||'').trim();
    const gotName=(await page.textContent('#name')||'').trim();
    const latest=(await page.textContent('#latest')||'').trim();
    const confidence=(await page.textContent('#confidence')||'').trim();
    if(!gotMarket.includes(market)) throw new Error(code+' market mismatch: '+gotMarket);
    if(!gotName.includes(name)) throw new Error(code+' name mismatch: '+gotName);
    if(!latest || latest==='尚未成立') throw new Error(code+' latest missing');
    if(!confidence.includes('/ 100')) throw new Error(code+' confidence missing');
    console.log(JSON.stringify({code,market:gotMarket,name:gotName,latest,confidence}));
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
