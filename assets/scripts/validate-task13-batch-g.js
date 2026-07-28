const fs = require("fs");
const path = require("path");

const root = process.cwd();
const pages = [
  "index.html",
  "juwai-morning-teer-results.html",
  "juwai-teer-results.html",
  "khanapara-morning-teer-results.html",
  "khanapara-teer-results.html",
  "shillong-morning-teer-results.html",
  "shillong-night-teer-2-results.html",
  "shillong-teer-previous-results.html"
];

const failures = [];
for (const page of pages) {
  const file = path.join(root, page);
  if (!fs.existsSync(file)) {
    failures.push(`${page}: missing`);
    continue;
  }
  const html = fs.readFileSync(file, "utf8");
  for (const required of [
    "data-live-monitor",
    "/assets/css/live-monitoring.css",
    "/assets/scripts/live-monitoring.js",
    "data-monitor-connection",
    "data-monitor-freshness",
    "data-monitor-sync",
    "data-monitor-state"
  ]) {
    if (!html.includes(required)) failures.push(`${page}: missing ${required}`);
  }
  if ((html.match(/data-live-monitor/g) || []).length !== 1) {
    failures.push(`${page}: expected exactly one monitor panel`);
  }
}
for (const asset of [
  "assets/css/live-monitoring.css",
  "assets/scripts/live-monitoring.js"
]) {
  if (!fs.existsSync(path.join(root, asset))) failures.push(`${asset}: missing`);
}
if (failures.length) {
  console.error("TASK 13 BATCH G: FAIL");
  failures.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}
console.log("TASK 13 BATCH G: PASS");
console.log(`${pages.length} monitored pages checked`);
