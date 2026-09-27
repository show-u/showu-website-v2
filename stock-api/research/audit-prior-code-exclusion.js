
const fs=require('fs'),path=require('path');
const dir=path.join(process.cwd(),'stock-api','research');
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.js'));
const details=[];const set=new Set();
for(const f of files){
 const txt=fs.readFileSync(path.join(dir,f),'utf8');
 const matches=[...txt.matchAll(/["']([0-9]{4})["']/g)].map(m=>m[1]);
 matches.forEach(x=>set.add(x));
 if(matches.length)details.push({f,n:matches.length,sample:matches.slice(0,10)});
}
console.log('RESULT',JSON.stringify({cwd:process.cwd(),fileCount:files.length,files:files.slice(0,20),matchedFiles:details.length,unique:set.size,details:details.slice(0,30)}));
