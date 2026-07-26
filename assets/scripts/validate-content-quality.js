"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const pages = fs.readdirSync(root)
  .filter((name) => /(?:^index|teer(?:-2)?-(?:results|previous-results))\.html$/.test(name))
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
  const minimum = file.includes("previous-results") ? 400 : 800;
  const h1Count = (source.match(/<h1\b/gi) || []).length;

  if (words < minimum) fail(file, `only ${words} visible words; expected at least ${minimum}`);
  if (h1Count !== 1) fail(file, `expected exactly one H1, found ${h1Count}`);
  if (file !== "index.html" && /<section\b[^>]*class=["'][^"']*\btask4b-seo\b/i.test(source)) {
    fail(file, "legacy duplicate task4b-seo section remains");
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
console.log(`Content quality validation: PASS (${pages.length} result/archive pages checked)`);
