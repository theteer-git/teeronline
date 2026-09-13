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
assert.match(source, /HOT_MS:\s*5000/);
assert.match(source, /HOT_JITTER_MS:\s*1000/);
assert.match(source, /CRITICAL_MS:\s*1500/);
assert.match(source, /CRITICAL_JITTER_MS:\s*500/);
assert.match(source, /return Math\.max\(TASK12_POLL\.CRITICAL_MS, Math\.min\(TASK12_POLL\.IDLE_MS, planned\)\);/);
assert.match(source, /Math\.random\(\) \* \(jitter \+ 1\)/);
assert.match(source, /history\/\$\{encodeURIComponent\(GAME_ID\)\}\.json/);
assert.doesNotMatch(source, /api\/game-history/);
assert.match(source, /if \(manual \|\| !historyLoaded\)/);
assert.match(source, /document\.hidden/);
assert.match(source, /refresh\(false\)\.finally\(schedule\)/);
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

for (const archive of archives) {
  const archiveSource = fs.readFileSync(path.join(__dirname, archive), "utf8");
  assert.match(archiveSource, /https:\/\/static-results\.teeronline\.com\/all-results\.json/, archive);
  assert.doesNotMatch(archiveSource, /https:\/\/results\.teeronline\.com\/all-results\.json/, archive);
}

for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  assert.match(html, /assets\/scripts\/game-unified-page\.js/);
}

console.log("Traffic hardening frontend validation: PASS");
console.log("Game pages checked: 8");
console.log("Per-game pointers, jitter, history isolation, visibility, and duplicate-read removal: PASS");
