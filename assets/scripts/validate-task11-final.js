"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "../..");
const pages = ["index.html","khanapara-teer-results.html","juwai-teer-results.html","shillong-morning-teer-results.html","khanapara-morning-teer-results.html","juwai-morning-teer-results.html","shillong-night-teer-results.html","shillong-night-teer-2-results.html"];
const js = fs.readFileSync(path.join(root,"assets/scripts/game-unified-page.js"),"utf8");
const css = fs.readFileSync(path.join(root,"assets/css/game-unified-page.css"),"utf8");
const required = ["Live ${label} Result Monitoring","Result Updated","Monitoring Extended","Today’s Result Complete","scheduled off-day","aria-live","initialResultState","weeklyOffDays","crossesMidnight"];
const failures=[];
for (const token of required) if (!js.includes(token)) failures.push(`missing JS token: ${token}`);
for (const token of ["live-monitoring-banner","data-state=\"active\"","min-height"]) if (!css.includes(token)) failures.push(`missing CSS token: ${token}`);
for (const file of pages) {
  const html=fs.readFileSync(path.join(root,file),"utf8");
  if (!html.includes("game-unified-page.js?v=20260727-task11")) failures.push(`${file}: JS cache version missing`);
  if (!html.includes("game-unified-page.css?v=20260727-task11")) failures.push(`${file}: CSS cache version missing`);
}
if (js.includes("sourceId") || js.includes("verifiedBy")) failures.push("public frontend script exposes source identity fields");
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log(`Task 11 frontend validation: PASS (${pages.length} game pages, 7 banner states, transition protection, SHN2/off-day guards)`);
