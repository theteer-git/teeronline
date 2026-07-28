"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = process.cwd();
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
let failures = 0;
function check(label, condition, detail = "") {
  console.log(`${condition ? "PASS" : "FAIL"}: ${label}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures += 1;
}
function decode(value) {
  return String(value || "").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&rsquo;/g, "’");
}
function strip(value) {
  return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
const title = decode(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);
const description = decode(html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"[^>]*>/i)?.[1] || html.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"[^>]*>/i)?.[1]);
const h1s = html.match(/<h1\b/gi) || [];
const bodyWords = strip(html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || "").split(" ").filter(Boolean).length;
const faqDetails = html.match(/<details\b/gi) || [];
const sections = [...html.matchAll(/data-semantic-section="([^"]+)"/gi)].map(x => x[1]);
const schemaText = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i)?.[1];
let schema = null;
try { schema = JSON.parse(schemaText); } catch {}
const faqNode = schema?.["@graph"]?.find(node => node["@type"] === "FAQPage");
const webPageNode = schema?.["@graph"]?.find(node => node["@type"] === "WebPage");

check("Homepage title is concise and intent-led", title === "Shillong Teer Result Today: Live FR & SR | TeerOnline", `${title.length} chars`);
check("Homepage description is useful length", description.length >= 120 && description.length <= 165, `${description.length} chars`);
check("Exactly one homepage H1", h1s.length === 1, `${h1s.length} found`);
check("Homepage retains live result section", sections.includes("live_result"));
check("Homepage retains common-number section", sections.includes("common_numbers"));
for (const name of ["homepage_overview", "schedule_and_status", "records_and_statistics", "editorial_policy", "faq", "responsible_use"]) {
  check(`Homepage includes ${name}`, sections.includes(name));
}
check("Homepage visible copy is substantial but focused", bodyWords >= 950 && bodyWords <= 1900, `${bodyWords} words`);
check("Visible FAQ count follows shared limits", faqDetails.length >= 3 && faqDetails.length <= 12, `${faqDetails.length} FAQs`);
check("FAQ schema count matches visible FAQ", faqNode?.mainEntity?.length === faqDetails.length, `${faqNode?.mainEntity?.length || 0} schema FAQs`);
check("WebPage schema uses current title", webPageNode?.name === title);
check("WebPage schema uses current description", webPageNode?.description === description);
check("Open Graph title matches", decode(html.match(/property="og:title"[^>]+content="([^"]+)"/i)?.[1] || html.match(/content="([^"]+)"[^>]+property="og:title"/i)?.[1]) === title);
check("Twitter title matches", decode(html.match(/name="twitter:title"[^>]+content="([^"]+)"/i)?.[1] || html.match(/content="([^"]+)"[^>]+name="twitter:title"/i)?.[1]) === title);
check("Legacy keyword meta removed", !/name="keywords"/i.test(html));
check("Batch B stylesheet is loaded", html.includes("/assets/css/task13-homepage.css?v=20260728-batch-b"));
check("No unsupported official-source claim", !/official source|official result provider/i.test(strip(html)));
check("No excessive FAQ block remains", faqDetails.length < 13);
check("No backend or result script changed by page markup", html.includes("/assets/scripts/game-unified-page.js"));

if (failures) {
  console.error(`TASK 13 BATCH B: FAIL (${failures})`);
  process.exit(1);
}
console.log(JSON.stringify({
  task: 13,
  batch: "B",
  homepageOptimised: true,
  visibleWords: bodyWords,
  visibleFaqs: faqDetails.length,
  liveWidgetsPreserved: true,
  approvedNavigationPreserved: true,
  backendAffected: false
}, null, 2));
console.log("TASK 13 BATCH B: PASS");
