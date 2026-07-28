"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const pages = [
  "index.html",
  "khanapara-teer-results.html",
  "juwai-teer-results.html",
  "shillong-morning-teer-results.html",
  "khanapara-morning-teer-results.html",
  "juwai-morning-teer-results.html",
  "shillong-night-teer-results.html",
  "shillong-night-teer-2-results.html"
];

const js = fs.readFileSync(path.join(root, "assets/scripts/game-unified-page.js"), "utf8");
const config = fs.readFileSync(path.join(root, "assets/scripts/game-config.js"), "utf8");
const css = fs.readFileSync(path.join(root, "assets/css/game-unified-page.css"), "utf8");
const failures = [];

const requiredJs = [
  "LATEST_VERSION_URL",
  "POLLING_PLAN_URL",
  "fetchLatestVersion",
  "latestVersion",
  "versionChanged",
  "function intervalMs()",
  "setTimeout",
  "document.hidden",
  "visibilitychange",
  "clearTimeout(timer)",
  "restoreCachedState",
  "cache: \"no-store\""
];

const requiredConfig = [
  "weeklyOffDays",
  "crossesMidnight: true",
  "latest-results.json",
  "latest-version.json",
  "polling-plan.json"
];

for (const token of requiredJs) {
  if (!js.includes(token)) failures.push(`missing unified JS token: ${token}`);
}
for (const token of requiredConfig) {
  if (!config.includes(token)) failures.push(`missing game config token: ${token}`);
}
for (const token of ["min-height", "result-card", "status"]) {
  if (!css.includes(token)) failures.push(`missing CSS safety token: ${token}`);
}

for (const file of pages) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  if (!/game-config\.js\?v=[^"']+/.test(html)) failures.push(`${file}: game config cache version missing`);
  if (!/game-unified-page\.js\?v=[^"']+/.test(html)) failures.push(`${file}: unified JS cache version missing`);
  if (!/game-unified-page\.css\?v=[^"']+/.test(html)) failures.push(`${file}: unified CSS cache version missing`);
  if (!/data-game-id="(?:SHD|KH|JWD|SHM|KHM|JWM|SHN1|SHN2)"/.test(html)) failures.push(`${file}: valid data-game-id missing`);
}

if (/sourceId|verifiedBy/.test(js)) failures.push("public frontend script exposes source identity fields");
if (/setInterval\s*\(/.test(js)) failures.push("fixed setInterval polling detected; unified controller must use rescheduled setTimeout");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Task 11 frontend validation: PASS (${pages.length} game pages, version-first refresh, adaptive timeout polling, visibility guard, SHN2/off-day configuration)`);
