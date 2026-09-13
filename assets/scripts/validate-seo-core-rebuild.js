"use strict";

const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..", "..");
const CORE = [
  ["index.html", "/", "shillong-teer-previous-results.html"],
  ["khanapara-teer-results.html", "/khanapara-teer-results", "khanapara-teer-previous-results.html"],
  ["juwai-teer-results.html", "/juwai-teer-results", "juwai-teer-previous-results.html"],
  ["shillong-morning-teer-results.html", "/shillong-morning-teer-results", "shillong-morning-teer-previous-results.html"],
  ["khanapara-morning-teer-results.html", "/khanapara-morning-teer-results", "khanapara-morning-teer-previous-results.html"],
  ["juwai-morning-teer-results.html", "/juwai-morning-teer-results", "juwai-morning-teer-previous-results.html"],
  ["shillong-night-teer-results.html", "/shillong-night-teer-results", "shillong-night-teer-previous-results.html"],
  ["shillong-night-teer-2-results.html", "/shillong-night-teer-2-results", "shillong-night-teer-2-previous-results.html"],
  ["shillong-teer-previous-results.html", "/shillong-teer-previous-results", "index.html"],
  ["khanapara-teer-previous-results.html", "/khanapara-teer-previous-results", "khanapara-teer-results.html"],
  ["juwai-teer-previous-results.html", "/juwai-teer-previous-results", "juwai-teer-results.html"],
  ["shillong-morning-teer-previous-results.html", "/shillong-morning-teer-previous-results", "shillong-morning-teer-results.html"],
  ["khanapara-morning-teer-previous-results.html", "/khanapara-morning-teer-previous-results", "khanapara-morning-teer-results.html"],
  ["juwai-morning-teer-previous-results.html", "/juwai-morning-teer-previous-results", "juwai-morning-teer-results.html"],
  ["shillong-night-teer-previous-results.html", "/shillong-night-teer-previous-results", "shillong-night-teer-results.html"],
  ["shillong-night-teer-2-previous-results.html", "/shillong-night-teer-2-previous-results", "shillong-night-teer-2-results.html"]
];
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const text = (s) => decode(s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
const tokens = (s) => new Set(text(s).toLowerCase().match(/[a-z0-9]+/g) || []);
const jaccard = (a, b) => { let both = 0; for (const item of a) if (b.has(item)) both += 1; return both / new Set([...a, ...b]).size; };
const trigrams = (s) => { const clean = text(s).toLowerCase().replace(/\s+/g, " "); const out = new Set(); for (let i = 0; i < clean.length - 2; i += 1) out.add(clean.slice(i, i + 3)); return out; };
function meta(source, name) { return [...source.matchAll(/<meta\b[^>]*>/gi)].find((tag) => new RegExp(`\\bname=["']${name}["']`, "i").test(tag[0]))?.[0] || ""; }
const attr = (source, name) => meta(source, name).match(/\bcontent=["']([^"']+)["']/i)?.[1] || "";
const slug = (file) => file === "index.html" ? "/" : `/${file.replace(/\.html$/, "")}`;
let errors = 0;
function fail(message) { errors += 1; console.error(`FAIL: ${message}`); }
const pages = CORE.map(([file, route, counterpart]) => ({ file, route, counterpart, source: fs.readFileSync(path.join(ROOT, file), "utf8") }));
const titles = new Set(), descriptions = new Set(), h1s = new Set();
for (const page of pages) {
  const canonicalTag = [...page.source.matchAll(/<link\b[^>]*>/gi)].find((tag) => /\brel=["']canonical["']/i.test(tag[0]))?.[0] || "";
  const canonical = canonicalTag.match(/\bhref=["']([^"']+)["']/i)?.[1] || "";
  const title = text(page.source.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");
  const description = attr(page.source, "description");
  const h1 = text(page.source.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
  const prose = [...page.source.matchAll(/<section\b[^>]*class=["'][^"']*seo-rebuild[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi)].map((m) => text(m[1])).join(" ");
  if (canonical !== `https://teeronline.com${page.route}`) fail(`${page.file}: canonical is ${canonical}`);
  if ((page.source.match(/<h1\b/gi) || []).length !== 1) fail(`${page.file}: must have one H1`);
  if (titles.has(title) || descriptions.has(description) || h1s.has(h1)) fail(`${page.file}: title, description, or H1 duplicates another core page`);
  titles.add(title); descriptions.add(description); h1s.add(h1);
  if (prose.split(/\s+/).filter(Boolean).length < 70) fail(`${page.file}: rebuilt server prose is too short`);
  if (/FAQPage|"@type"\s*:\s*"Article"|dateModified/i.test(page.source)) fail(`${page.file}: stale FAQPage/Article date schema remains`);
  if (!page.source.includes(`href="${slug(page.counterpart)}"`)) fail(`${page.file}: counterpart link is missing`);
  if (!/index,follow/i.test(meta(page.source, "robots"))) fail(`${page.file}: is not explicitly indexable`);
}
const sitemap = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urls.length !== 23 || new Set(urls).size !== 23) fail(`sitemap expected 23 unique URLs, found ${urls.length}`);
if (/<lastmod>/i.test(sitemap)) fail("sitemap still contains unverified stale lastmod values");
for (const page of pages) if (!urls.includes(`https://teeronline.com${page.route}`)) fail(`${page.file}: absent from sitemap`);
if (pages.some((page) => /shillong-teer-results(?:\.html)?/i.test(page.source))) fail("forbidden /shillong-teer-results route referenced by a core page");
for (const target of pages) {
  const inbound = pages.filter((source) => source.source.includes(`href="${target.route}"`)).length;
  if (!inbound) fail(`${target.file}: no crawlable inbound core-page link`);
}
const sections = pages.map((page) => ({ file: page.file, prose: [...page.source.matchAll(/<section\b[^>]*class=["'][^"']*seo-rebuild[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi)].map((m) => m[1]).join(" ") }));
console.log("SEO core similarity matrix (Jaccard / trigram Jaccard)");
for (let i = 0; i < sections.length; i += 1) for (let j = i + 1; j < sections.length; j += 1) {
  const lexical = jaccard(tokens(sections[i].prose), tokens(sections[j].prose));
  const character = jaccard(trigrams(sections[i].prose), trigrams(sections[j].prose));
  console.log(`${sections[i].file} <> ${sections[j].file}: ${lexical.toFixed(3)} / ${character.toFixed(3)}`);
  if (lexical > 0.52 || character > 0.58) fail(`${sections[i].file} and ${sections[j].file}: near-duplicate rebuilt prose`);
}
if (errors) process.exit(1);
console.log("SEO core rebuild validation: PASS (16 core pages, 23 sitemap URLs)");
