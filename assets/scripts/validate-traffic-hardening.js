"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const source = fs.readFileSync(path.join(__dirname, "game-unified-page.js"), "utf8");
const monitoring = fs.readFileSync(path.join(__dirname, "result-live-monitoring.js"), "utf8");
const telemetry = fs.readFileSync(path.join(__dirname, "intent-telemetry.js"), "utf8");
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
assert.match(source, /Math\.random\(\) \* \(TASK12_POLL\.HOT_JITTER_MS \+ 1\)/);
assert.match(source, /history\/\$\{encodeURIComponent\(GAME_ID\)\}\.json/);
assert.doesNotMatch(source, /api\/game-history/);
assert.match(source, /if \(manual \|\| !historyLoaded\)/);
assert.match(source, /document\.hidden/);
assert.match(source, /refresh\(false\)\.finally\(schedule\)/);
assert.match(source, /acceptsCurrentRecord/);
assert.match(source, /function currentBusinessDate/);
assert.match(source, /GAME_ID !== "SHN2"/);
assert.match(source, /isCurrentCachedResult\(latest\)/);
assert.doesNotMatch(monitoring, /api\/game-result/);
assert.doesNotMatch(telemetry, /api\/game-result/);

for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  assert.match(html, /assets\/scripts\/game-unified-page\.js/);
}

console.log("Traffic hardening frontend validation: PASS");
console.log("Game pages checked: 8");
console.log("Per-game pointers, jitter, history isolation, visibility, and duplicate-read removal: PASS");
