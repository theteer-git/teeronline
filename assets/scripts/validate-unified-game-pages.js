"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const config = require("./game-config.js");

const root = process.cwd();
const files = {
  SHD: "index.html",
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
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function tagText(html, tag) {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return (match?.[1] || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
function attrValue(html, tag, attrName, attrValueExpected, targetAttr) {
  const tagPattern = new RegExp(`<${tag}\\b[^>]*${attrName}=["']${escapeRegExp(attrValueExpected)}["'][^>]*>`, "i");
  const match = html.match(tagPattern);
  if (!match) return "";
  const attr = match[0].match(new RegExp(`${targetAttr}=["']([^"']*)["']`, "i"));
  return attr?.[1] || "";
}
function countTag(html, tag) {
  return (html.match(new RegExp(`<${tag}\\b`, "gi")) || []).length;
}

for (const gameId of config.gameOrder) {
  const game = config.games[gameId];
  const file = files[gameId];
  const full = path.join(root, file);
  const exists = fs.existsSync(full);
  check(`${gameId} page exists`, exists);
  if (!exists) continue;

  const html = fs.readFileSync(full, "utf8");
  const canonical = gameId === "SHD" ? "https://teeronline.com/" : `https://teeronline.com/${file.replace(/\.html$/, "")}`;
  const title = tagText(html, "title");
  const h1 = tagText(html, "h1");
  const description = attrValue(html, "meta", "name", "description", "content");
  const bodyGameId = attrValue(html, "body", "data-game-id", gameId, "data-game-id");

  check(`${gameId} canonical`, new RegExp(`<link\\b[^>]*rel=["']canonical["'][^>]*href=["']${escapeRegExp(canonical)}["']|<link\\b[^>]*href=["']${escapeRegExp(canonical)}["'][^>]*rel=["']canonical["']`, "i").test(html));
  check(`${gameId} body game id`, bodyGameId === gameId);
  check(`${gameId} archive retained`, new RegExp(`href=["']${escapeRegExp(game.previousResultsPath)}["']`, "i").test(html));
  check(`${gameId} shared runtime`, html.includes('/assets/scripts/game-unified-page.js'));
  check(`${gameId} shared config`, html.includes('/assets/scripts/game-config.js'));
  check(`${gameId} shared CSS`, html.includes('/assets/css/game-unified-page.css'));
  check(`${gameId} common panel container`, new RegExp(`id=["']${gameId.toLowerCase()}-common-card["']`, "i").test(html));
  check(`${gameId} no all-results`, !html.includes("all-results.json"));
  check(`${gameId} semantic sections`, ["live_result", "previous_7_days", "common_numbers"].every(id => new RegExp(`id=["']${id}["']`, "i").test(html)));
  check(`${gameId} unique title mentions game`, title.includes(game.name) && /Result Today/i.test(title));
  check(`${gameId} description mentions game`, description.includes(game.name));
  check(`${gameId} one clear H1`, countTag(html, "h1") === 1 && h1.includes(game.name));
  check(`${gameId} game-specific visible copy`, html.includes(game.name));
  check(`${gameId} FAQ content`, /Frequently Asked Questions/i.test(html));
  check(`${gameId} FAQ schema`, html.includes('"@type":"FAQPage"') || html.includes('"@type": "FAQPage"'));
  check(`${gameId} no retired Common Numbers link`, !/href=["'](?:\.\/|\/)?common-numbers(?:\.html)?["']/.test(html));
}

check("No separate Shillong Teer result page", !fs.existsSync(path.join(root, "shillong-teer-results.html")));
check("SHD configuration canonical is homepage", config.games.SHD.canonicalPath === "/");

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
