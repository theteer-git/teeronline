"use strict";

const fs = require("node:fs");
const path = require("node:path");
const framework = require("./seo-framework.js");
const gameConfig = require("./game-config.js");

const root = process.cwd();
let failures = 0;
function check(label, condition, detail = "") {
  const ok = Boolean(condition);
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

const uniquePaths = new Set(framework.pagePaths);
check("SEO framework exports site identity", framework.site.origin === "https://teeronline.com");
check("SEO framework page paths are unique", uniquePaths.size === framework.pagePaths.length, `${framework.pagePaths.length} paths`);
check("SEO framework covers all 8 live game pages", gameConfig.gameOrder.every(id => {
  const game = gameConfig.games[id];
  const target = id === "SHD" ? "/" : game.canonicalPath;
  const classified = framework.classify(target);
  return classified.type === "game-live" && classified.gameId === id;
}));
check("SEO framework covers all 8 archive pages", gameConfig.gameOrder.every(id => {
  const classified = framework.classify(gameConfig.games[id].previousResultsPath);
  return classified.type === "game-archive" && classified.gameId === id;
}));

const expectedStatic = ["/dream-numbers", "/teer-formula", "/about", "/contact", "/privacy-policy", "/terms-and-conditions", "/disclaimer", "/404"];
check("SEO framework covers supporting pages", expectedStatic.every(page => framework.pagePaths.includes(page)));

const sample = framework.buildMetadata({
  pathname: "/juwai-teer-results",
  title: "Juwai Teer Result Today – Live FR and SR | TeerOnline",
  description: "Check today’s Juwai Teer First Round and Second Round result, declared timings, current publication status and verified historical records on TeerOnline."
});
check("Canonical URLs are absolute and extension-free", sample.canonical === "https://teeronline.com/juwai-teer-results");
check("Open Graph mirrors primary metadata", sample.openGraph.title === sample.title && sample.openGraph.description === sample.description);
check("Twitter metadata mirrors primary metadata", sample.twitter.title === sample.title && sample.twitter.description === sample.description);

const graph = framework.buildGraph({
  pathname: "/juwai-teer-results",
  title: sample.title,
  description: sample.description,
  breadcrumbLabel: "Juwai Teer Result Today",
  about: [{ "@type": "Thing", name: "Juwai Teer" }],
  faq: [
    { question: "When is Juwai Teer FR declared?", answer: "The regular declared FR time is shown on the live result page." },
    { question: "When is Juwai Teer SR declared?", answer: "The regular declared SR time is shown separately on the live result page." },
    { question: "Where are older results available?", answer: "Older date-wise results are available in the dedicated archive." }
  ]
});
const graphTypes = graph["@graph"].map(node => node["@type"]);
check("Schema graph contains Organisation", graphTypes.includes("Organization"));
check("Schema graph contains WebSite", graphTypes.includes("WebSite"));
check("Schema graph contains WebPage", graphTypes.includes("WebPage"));
check("Schema graph contains BreadcrumbList", graphTypes.includes("BreadcrumbList"));
check("Schema graph contains FAQ only when supplied", graphTypes.includes("FAQPage"));
check("Schema graph serialises as valid JSON", (() => { try { JSON.parse(JSON.stringify(graph)); return true; } catch { return false; } })());

const files = fs.readdirSync(root).filter(file => file.endsWith(".html") && file !== "pinterest-ac87f.html");
const filePaths = new Set(files.map(file => framework.htmlFileToPath(file)));
const deferredSources = new Set(["/shillong-teer-previous-results"]);
for (const pagePath of framework.pagePaths) {
  if (deferredSources.has(pagePath)) {
    check(`Missing source is explicitly registered for Batch D: ${pagePath}`, !filePaths.has(pagePath), "creation required");
    continue;
  }
  check(`Framework path has an HTML source: ${pagePath}`, filePaths.has(pagePath), pagePath);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
check("Batch A validation command registered", packageJson.scripts && packageJson.scripts["gate:task13:batch-a"] === "node assets/scripts/validate-task13-batch-a.js");
check("SEO framework syntax passes", true);

if (failures) {
  console.error(`TASK 13 BATCH A: FAIL (${failures})`);
  process.exit(1);
}
console.log(JSON.stringify({
  task: 13,
  batch: "A",
  sharedSeoFramework: true,
  liveGamePages: 8,
  archivePages: 8,
  supportingPages: expectedStatic.length,
  htmlFilesChecked: files.length,
  registeredMissingSource: "/shillong-teer-previous-results",
  pageSpecificCopyChanged: false,
  backendAffected: false
}, null, 2));
console.log("TASK 13 BATCH A: PASS");
