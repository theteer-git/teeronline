const fs = require("fs");
const path = require("path");

const pages = [
  "index.html",
  "juwai-morning-teer-results.html",
  "juwai-teer-results.html",
  "khanapara-morning-teer-results.html",
  "khanapara-teer-results.html",
  "shillong-morning-teer-results.html",
  "shillong-night-teer-2-results.html"
];

const required = [
  "data-result-live-monitor",
  "/assets/css/result-live-monitoring.css",
  "/assets/scripts/result-live-monitoring.js",
  "data-monitor-title",
  "data-monitor-message",
  "data-monitor-badge"
];

const failures = [];
for (const page of pages) {
  const file = path.join(process.cwd(), page);
  if (!fs.existsSync(file)) {
    failures.push(`${page}: missing`);
    continue;
  }
  const html = fs.readFileSync(file, "utf8");
  for (const token of required) {
    if (!html.includes(token)) failures.push(`${page}: missing ${token}`);
  }
  if ((html.match(/data-result-live-monitor/g) || []).length !== 1) {
    failures.push(`${page}: expected exactly one state monitor`);
  }
  if (html.includes('class="live-monitor"')) {
    failures.push(`${page}: obsolete diagnostic monitor remains`);
  }
}

for (const asset of [
  "assets/css/result-live-monitoring.css",
  "assets/scripts/result-live-monitoring.js"
]) {
  if (!fs.existsSync(path.join(process.cwd(), asset))) failures.push(`${asset}: missing`);
}

if (failures.length) {
  console.error("TASK 13 BATCH G2: FAIL");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("TASK 13 BATCH G2: PASS");
console.log(`${pages.length} live-result pages checked`);
console.log("States: live, updated, waiting, off, complete, scheduled, offline");
