"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "../..");
const pagePath = path.join(root, "juwai-teer-results.html");
const scriptPath = path.join(root, "assets/scripts/jwd-unified-page.js");
const cssPath = path.join(root, "assets/css/jwd-unified-page.css");
const archivePath = path.join(root, "juwai-teer-previous-results.html");

for (const filePath of [pagePath, scriptPath, cssPath, archivePath]) {
  if (!fs.existsSync(filePath)) {
    console.error(`Missing required file: ${path.relative(root, filePath)}`);
    process.exit(1);
  }
}

const page = fs.readFileSync(pagePath, "utf8");
const script = fs.readFileSync(scriptPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const archive = fs.readFileSync(archivePath, "utf8");

const checks = [];
const addCheck = (condition, label) => checks.push([Boolean(condition), label]);

addCheck(
  page.includes('class="result-card"') && page.includes('class="game-history-card"'),
  "Existing result UI composition"
);
addCheck(
  page.includes('class="game-card" data-game="JWD"') &&
    page.includes("Statistical Numbers") &&
    page.includes("Blocked Numbers") &&
    (page.includes("Group & Point Missing") || page.includes("Group &amp; Point Missing")),
  "Complete existing common/statistics UI"
);
addCheck(
  page.indexOf('class="result-card"') < page.indexOf('class="game-card" data-game="JWD"'),
  "Result before common statistics"
);
addCheck(
  page.includes("https://teeronline.com/juwai-teer-results"),
  "Canonical URL"
);
addCheck(
  page.includes("./juwai-teer-previous-results") || page.includes("/juwai-teer-previous-results"),
  "Archive link retained"
);
addCheck(
  !script.includes("all-results.json") && !page.includes("all-results.json"),
  "No all-results dependency"
);
addCheck(
  script.includes("if (loadingLatest) return loadingLatest;"),
  "Latest request deduplication"
);
addCheck(
  script.includes("visibilitychange") && script.includes("polling-plan.json"),
  "Visibility and polling plan"
);
addCheck(css.length > 30000, "Production result/common CSS retained");
addCheck(
  archive.includes("Juwai Teer Previous Results"),
  "Existing archive remains archive"
);
addCheck(
  script.includes("https://results.teeronline.com/latest-results.json"),
  "Production latest-results endpoint"
);
addCheck(
  script.includes("https://results.teeronline.com/recent-results.json"),
  "Production recent-results endpoint"
);
addCheck(
  script.includes("https://results.teeronline.com/polling-plan.json"),
  "Production polling-plan endpoint"
);

const requiredNavLabels = [
  "Home",
  "Shillong Teer",
  "Khanapara Teer",
  "Juwai Teer",
  "Shillong Morning",
  "Khanapara Morning",
  "Juwai Morning",
  "Shillong Night",
  "Shillong Night 2",
  "Dream Numbers",
  "Teer Formula"
];

for (const label of requiredNavLabels) {
  addCheck(
    page.includes(`>${label}</a>`) || page.includes(`>${label}</span>`),
    `Navigation item: ${label}`
  );
}

try {
  new vm.Script(script, { filename: "jwd-unified-page.js" });
} catch (error) {
  console.error(error);
  process.exit(1);
}

let failures = 0;
for (const [ok, label] of checks) {
  console.log(`${label}: ${ok ? "PASS" : "FAIL"}`);
  if (!ok) failures += 1;
}

if (failures > 0) {
  console.error(`JWD unified UI validation: FAIL (${failures})`);
  process.exit(1);
}

console.log("JWD unified UI validation: PASS");
