"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const source = fs.readFileSync(path.join(__dirname, "game-unified-page.js"), "utf8");
const monitoring = fs.readFileSync(path.join(__dirname, "result-live-monitoring.js"), "utf8");
const telemetry = fs.readFileSync(path.join(__dirname, "intent-telemetry.js"), "utf8");
const archives = [
  "khanapara-teer-archive.js", "juwai-teer-archive.js", "shillong-teer-archive.js",
  "shillong-morning-teer-archive.js", "khanapara-morning-teer-archive.js",
  "juwai-morning-teer-archive.js", "shillong-night-teer-archive.js",
  "shillong-night-teer-2-archive.js"
];
const pages = [
  "index.html", "khanapara-teer-results.html", "juwai-teer-results.html",
  "shillong-morning-teer-results.html", "khanapara-morning-teer-results.html",
  "juwai-morning-teer-results.html", "shillong-night-teer-results.html",
  "shillong-night-teer-2-results.html"
];

assert.match(source, /static-results\.teeronline\.com/);
assert.match(source, /pointers\/result\//);
assert.match(source, /pointers\/common-numbers\//);
assert.match(source, /latest-results\.json/);
assert.match(source, /polling-plan\.json/);
assert.doesNotMatch(source, /api\/latest-version/);
assert.match(source, /SECOND_CHECK_MS:\s*8 \* 1000/);
assert.match(source, /THIRD_CHECK_MIN_MS:\s*30 \* 1000/);
assert.match(source, /THIRD_CHECK_MAX_MS:\s*45 \* 1000/);
assert.match(source, /function createFiniteRoundScheduler/);
assert.match(source, /\.slice\(0, 3\)/);
assert.doesNotMatch(source, /TASK12_POLL|adaptivePollingInterval|PLAN_REFRESH_MS/);
assert.doesNotMatch(source, /await refresh\(false\);\s*schedule\(\);/);
assert.doesNotMatch(source, /setInterval\(/);
assert.match(source, /history\/\$\{encodeURIComponent\(GAME_ID\)\}\.json/);
assert.doesNotMatch(source, /api\/game-history/);
assert.match(source, /if \(history \|\| !historyLoaded\)/);
assert.match(source, /document\.hidden/);
assert.match(source, /finiteScheduler\?\.reconcile\(\)/);
assert.match(source, /finiteScheduler\?\.cancelAll\(\)/);
assert.match(source, /acceptsCurrentRecord/);
assert.match(source, /function currentBusinessDate/);
assert.match(source, /GAME_ID !== "SHN2"/);
assert.match(source, /isCurrentCachedResult\(latest\)/);
assert.match(source, /pointerCacheMatches\(pointer, cachedPointer, payloadMatchesPointer\)/);
assert.match(source, /cachedResultMatchesPointer\(nextResult\)/);
assert.match(source, /cachedCommonNumbersMatchPointer\(nextCommon\)/);
assert.match(source, /common-numbers\/\$\{GAME_ID\}/);
assert.doesNotMatch(monitoring, /api\/game-result/);
assert.doesNotMatch(telemetry, /api\/game-result/);
assert.doesNotMatch(telemetry, /live\.teeronline\.com/);
assert.doesNotMatch(telemetry, /intent-sample/);
assert.doesNotMatch(telemetry, /sendBeacon\(|fetch\(/);

for (const archive of archives) {
  const archiveSource = fs.readFileSync(path.join(__dirname, archive), "utf8");
  assert.match(archiveSource, /https:\/\/static-results\.teeronline\.com\/all-results\.json/, archive);
  assert.doesNotMatch(archiveSource, /https:\/\/results\.teeronline\.com\/all-results\.json/, archive);
}

const TELEMETRY_SHA = "9728b7af856c7e1003f72015527cc8e94227ad12bb09e4cd817f63157021bf2e";
const MONITORING_SHA = "4d1050f4f4eaf884efd12b1fbc4b10101db057e59e8415ac21e511c14a33f412";

for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  assert.match(html, /assets\/scripts\/game-unified-page\.js/);
  assert.match(html, new RegExp(`assets/scripts/intent-telemetry\\.js\\?v=sha256-${TELEMETRY_SHA}`));
  assert.match(html, new RegExp(`assets/scripts/result-live-monitoring\\.js\\?v=sha256-${MONITORING_SHA}`));
}

console.log("Traffic hardening frontend validation: PASS");
console.log("Game pages checked: 8");
console.log("Per-game pointers, jitter, history isolation, visibility, and duplicate-read removal: PASS");
