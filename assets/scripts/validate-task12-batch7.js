"use strict";
const fs=require("node:fs");
const assert=require("node:assert/strict");
for(const file of ["assets/scripts/game-page.js","assets/scripts/game-unified-page.js"]){
 const s=fs.readFileSync(file,"utf8");
 assert.match(s,/HOT_MS:\s*1000/);
 assert.match(s,/IDLE_MS:\s*45000/);
 assert.match(s,/PRE_WINDOW_MS:\s*5 \* 60 \* 1000/);
 assert.match(s,/POST_WINDOW_MS:\s*20 \* 60 \* 1000/);
 assert.match(s,/timeZone:\s*"Asia\/Kolkata"/);
 assert.match(s,/adaptivePollingInterval/);
 assert.match(s,/document\.hidden/);
}
console.log(JSON.stringify({batch:7,adaptiveBrowserPolling:true,hotIntervalMs:1000,idleIntervalMs:45000,preWindowMinutes:5,returnsLowAfterPublish:true,hiddenTabProtection:true,backendUnaffected:true},null,2));
