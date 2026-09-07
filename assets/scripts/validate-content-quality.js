"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const staticPages = new Set([
  "teer-formula.html",
  "dream-numbers.html",
  "about.html",
  "contact.html",
  "privacy-policy.html",
  "terms-and-conditions.html",
  "disclaimer.html"
]);
const pages = fs.readdirSync(root)
  .filter((name) => /(?:^index|teer(?:-2)?-(?:results|previous-results))\.html$/.test(name) || staticPages.has(name))
  .sort();

const bannedPhrases = [
  "resultsd results",
  "Result results",
  "Previous results at a Glance",
  "Previous Results: Today, FR SR and results",
  "Editorial Standards and results Accuracy"
];

function stripTags(value) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

let failures = 0;
function fail(file, message) {
  failures += 1;
  console.error(`FAIL ${file}: ${message}`);
}

for (const file of pages) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const text = stripTags(source);
  const words = text ? text.split(" ").length : 0;
  // These templates receive verified result/history rows at render time. Keep
  // a modest prose floor without rewarding repetitive keyword filler.
  const minimum = file.includes("previous-results") ? 150 : 300;
  const h1Count = (source.match(/<h1\b/gi) || []).length;
  const headingLevels = [...source.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]));
  const title = stripTags(source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const descriptionTag = [...source.matchAll(/<meta\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((tag) => /\bname=["']description["']/i.test(tag)) || "";
  const description = descriptionTag.match(/\bcontent=(["'])([\s\S]*?)\1/i)?.[2] || "";

  if (words < minimum) fail(file, `only ${words} visible words; expected at least ${minimum}`);
  if (h1Count !== 1) fail(file, `expected exactly one H1, found ${h1Count}`);
  if (title.length < 25 || title.length > 65) fail(file, `title length is ${title.length}; expected 25-65 characters`);
  if (description.length < 70 || description.length > 160) fail(file, `description length is ${description.length}; expected 70-160 characters`);
  for (let index = 1; index < headingLevels.length; index += 1) {
    if (headingLevels[index] > headingLevels[index - 1] + 1) {
      fail(file, `heading order skips from H${headingLevels[index - 1]} to H${headingLevels[index]}`);
      break;
    }
  }
  if (file !== "index.html" && !staticPages.has(file) && /<section\b[^>]*class=["'][^"']*\btask4b-seo\b/i.test(source)) {
    fail(file, "legacy duplicate task4b-seo section remains");
  }
  if (/\btask13-archive-(?:overview|guide|faq)\b/i.test(source)) {
    fail(file, "duplicate generated archive content remains");
  }

  for (const phrase of bannedPhrases) {
    if (source.includes(phrase)) fail(file, `contains weak or malformed phrase: ${phrase}`);
  }

  const main = source.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || source;
  const paragraphMatches = [...main.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  const seen = new Map();
  for (const match of paragraphMatches) {
    const paragraph = stripTags(match[1]);
    if (paragraph.split(" ").length < 18) continue;
    const key = paragraph.toLowerCase();
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  for (const [paragraph, count] of seen) {
    if (count > 1) fail(file, `repeats the same substantial paragraph ${count} times: ${paragraph.slice(0, 90)}…`);
  }
}

if (failures) {
  console.error(`Content quality validation: FAIL (${failures})`);
  process.exit(1);
}
console.log(`Content quality validation: PASS (${pages.length} public sitemap pages checked)`);
