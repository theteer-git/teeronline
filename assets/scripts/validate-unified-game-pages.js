"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const config = require("./game-config.js");

const root = process.cwd();
const files = {
  SHD: "shillong-teer-results.html",
  KH: "khanapara-teer-results.html",
  JWD: "juwai-teer-results.html",
  SHM: "shillong-morning-teer-results.html",
  KHM: "khanapara-morning-teer-results.html",
  JWM: "juwai-morning-teer-results.html",
  SHN1: "shillong-night-teer-results.html",
  SHN2: "shillong-night-teer-2-results.html"
};

let failures = 0;
function check(label, condition) {
  console.log(`${label}: ${condition ? "PASS" : "FAIL"}`);
  if (!condition) failures += 1;
}

for (const gameId of config.gameOrder) {
  const game = config.games[gameId];
  const file = files[gameId];
  const full = path.join(root, file);
  const exists = fs.existsSync(full);
  check(`${gameId} page exists`, exists);
  if (!exists) continue;
  const html = fs.readFileSync(full, "utf8");
  const canonical = `https://teeronline.com/${file.replace(/\.html$/, "")}`;
  check(`${gameId} canonical`, html.includes(`href="${canonical}"`));
  check(`${gameId} body game id`, html.includes(`data-game-id="${gameId}"`));
  check(`${gameId} archive retained`, html.includes(`href="${game.previousResultsPath}"`));
  check(`${gameId} shared runtime`, html.includes('/assets/scripts/game-unified-page.js'));
  check(`${gameId} shared config`, html.includes('/assets/scripts/game-config.js'));
  check(`${gameId} shared CSS`, html.includes('/assets/css/game-unified-page.css'));
  check(`${gameId} own common card`, html.includes(`data-game="${gameId}"`));
  check(`${gameId} no all-results`, !html.includes("all-results.json"));
  check(`${gameId} semantic sections`, ["live_result", "previous_7_days", "common_numbers"].every(id => html.includes(`id="${id}"`)));
}

const runtimePath = path.join(root, "assets/scripts/game-unified-page.js");
const runtime = fs.readFileSync(runtimePath, "utf8");
check("Production latest endpoint", runtime.includes("config.endpoints.latestResults"));
check("Production recent endpoint", runtime.includes("config.endpoints.recentResults"));
check("Production polling endpoint", runtime.includes("config.endpoints.pollingPlan"));
check("Latest request deduplication", runtime.includes("if (loadingLatest) return loadingLatest;"));
check("Recent request deduplication", runtime.includes("if (loadingRecent) return loadingRecent;"));
check("Independent request handling", runtime.includes("Promise.allSettled"));
check("Hidden-tab pause", runtime.includes("document.hidden"));
check("SHN2 shared boundary", config.games.SHN2.crossesMidnight === true);
check("No all-results runtime", !runtime.includes("all-results.json"));
try {
  new vm.Script(runtime, { filename: runtimePath });
  check("Shared runtime syntax", true);
} catch (error) {
  console.error(error);
  check("Shared runtime syntax", false);
}

if (failures) {
  console.error(`Unified game-page validation: FAIL (${failures})`);
  process.exit(1);
}
console.log("Unified game-page validation: PASS");
