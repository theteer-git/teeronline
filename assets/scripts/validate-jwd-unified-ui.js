"use strict";
const fs=require("fs"), path=require("path"), vm=require("vm");
const root=path.resolve(__dirname,"../..");
const page=fs.readFileSync(path.join(root,"juwai-teer-results.html"),"utf8");
const js=fs.readFileSync(path.join(root,"assets/scripts/jwd-unified-page.js"),"utf8");
const css=fs.readFileSync(path.join(root,"assets/css/jwd-unified-page.css"),"utf8");
const archive=fs.readFileSync(path.join(root,"juwai-teer-previous-results.html"),"utf8");
const checks=[
 [page.includes('class="result-card"')&&page.includes('class="game-history-card"'),"Existing result UI composition"],
 [page.includes('class="game-card" data-game="JWD"')&&page.includes('Statistical Numbers')&&page.includes('Blocked Numbers')&&(page.includes('Group & Point Missing')||page.includes('Group &amp; Point Missing')),"Complete existing common/statistics UI"],
 [page.indexOf('class="result-card"')<page.indexOf('class="game-card" data-game="JWD"'),"Result before common statistics"],
 [page.includes('https://teeronline.com/juwai-teer-results'),"Canonical URL"],
 [page.includes('./juwai-teer-previous-results'),"Archive link retained"],
 [!js.includes('all-results.json')&&!page.includes('all-results.json'),"No all-results dependency"],
 [js.includes('if (loadingLatest) return loadingLatest;'),"Latest request deduplication"],
 [js.includes('visibilitychange')&&js.includes('/polling-plan.json'),"Visibility and polling plan"],
 [css.length>30000,"Production result/common CSS retained"],
 [archive.includes('Juwai Teer Previous Results'),"Existing archive remains archive"]
];
try{new vm.Script(js,{filename:"jwd-unified-page.js"});}catch(e){console.error(e);process.exit(1)}
let fail=0; for(const [ok,label] of checks){console.log(`${label}: ${ok?'PASS':'FAIL'}`);if(!ok)fail++;}
if(fail){console.error(`JWD unified UI validation: FAIL (${fail})`);process.exit(1)}
console.log("JWD unified UI validation: PASS");
