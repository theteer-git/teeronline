"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const failures = [];
const warnings = [];
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

const config = read("assets/scripts/game-config.js");
const controller = read("assets/scripts/game-unified-page.js");
const sw = read("sw.js");

const expectedGames = ["SHD", "KH", "JWD", "SHM", "KHM", "JWM", "SHN1", "SHN2"];
for (const gameId of expectedGames) {
  if (!new RegExp(`\\b${gameId}:\\s*Object\\.freeze`).test(config)) failures.push(`game config missing ${gameId}`);
}

for (const endpoint of ["latest-results.json", "latest-version.json", "recent-results.json", "all-results.json", "polling-plan.json", "common-numbers.json"]) {
  const present = config.includes(endpoint) || controller.includes(endpoint);
  if (!present) failures.push(`public R2 endpoint missing: ${endpoint}`);
}

if (!controller.includes("fetchLatestVersion")) failures.push("version-first result refresh is missing");
if (!controller.includes("visibilitychange")) failures.push("visibility-aware polling is missing");
if (!controller.includes("setTimeout")) failures.push("adaptive rescheduling primitive is missing");
if (controller.includes("setInterval(")) failures.push("fixed interval polling remains in unified controller");
if (/workers\.dev|admin\.teeronline\.com|live\.teeronline\.com\/data\//.test(controller)) failures.push("frontend result controller addresses a Worker/backend result route");
if (/sourceId|verifiedBy/.test(controller)) failures.push("frontend exposes source identity fields");

if (!/results\.teeronline\.com/.test(config)) failures.push("R2/CDN result origin is not configured");
if (/latest-results\.json/.test(sw) && /cache\.put|cache\.addAll/.test(sw)) warnings.push("service worker references live JSON; verify it never stores stale live results");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Task 12 GitHub baseline: PASS");
console.log(`Games: ${expectedGames.length}`);
console.log("Public result path: browser -> results.teeronline.com -> CDN/R2");
console.log("Current polling: version-first, setTimeout-based, visibility-aware");
console.log("Known Batch 5 gap: current active interval floor is 5 seconds, not the Task 12 1-second target");
for (const warning of warnings) console.log(`WARNING: ${warning}`);
