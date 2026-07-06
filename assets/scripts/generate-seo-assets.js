#!/usr/bin/env node
/*
 * TeerOnline SEO/CMS asset generator
 * Source of truth:
 *   - cms/seo-pages.json for page routing, titles, canonical paths, indexing rules
 *   - cms/keywords.csv for keyword volume and competition data
 * Generates sitemap, robots, llms, search index, RSS/feed and SEO_REPORT.md.
 * It does not rewrite HTML, so it is safe before deployment.
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "cms", "seo-pages.json");
const KEYWORDS_PATH = path.join(ROOT, "cms", "keywords.csv");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map(cell => cell.trim());
}

function readKeywords(filePath) {
  if (!fs.existsSync(filePath)) return new Map();
  const lines = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return new Map();
  const headers = parseCsvLine(lines.shift()).map(h => h.toLowerCase());
  const keywordIndex = headers.indexOf("keyword");
  const volumeIndex = headers.indexOf("avg. monthly searches");
  const competitionIndex = headers.indexOf("competition");
  const map = new Map();
  for (const line of lines) {
    const row = parseCsvLine(line);
    const keyword = String(row[keywordIndex] || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!keyword) continue;
    const volume = Number(String(row[volumeIndex] || "0").replace(/,/g, "")) || 0;
    const competition = row[competitionIndex] || "";
    const existing = map.get(keyword);
    if (!existing || volume > existing.searchVolume) {
      map.set(keyword, { keyword, searchVolume: volume, competition });
    }
  }
  return map;
}

function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cleanBase(baseUrl) {
  return String(baseUrl || "").replace(/\/+$/, "");
}

function pageUrl(baseUrl, pagePath) {
  if (pagePath === "/") return `${baseUrl}/`;
  return `${baseUrl}${pagePath}`;
}

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

function publicPages(config) {
  return config.pages.filter(page => page.index !== false && page.path && page.file);
}

function internalPages(config) {
  return config.pages.filter(page => page.index === false);
}

function write(fileName, content) {
  fs.writeFileSync(path.join(ROOT, fileName), content.endsWith("\n") ? content : `${content}\n`);
  console.log(`wrote ${fileName}`);
}

function keywordMeta(page, keywordMap) {
  return (page.keywords || []).map(keyword => {
    const key = String(keyword).toLowerCase().trim();
    return keywordMap.get(key) || { keyword: key, searchVolume: 0, competition: "" };
  });
}

function generateSitemapIndex(baseUrl) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${baseUrl}/sitemap-pages.xml</loc></sitemap>
  <sitemap><loc>${baseUrl}/sitemap-results.xml</loc></sitemap>
</sitemapindex>`;
}

function generatePagesSitemap(config, baseUrl) {
  const today = currentDate();
  const entries = publicPages(config).map(page => `  <url>
    <loc>${xmlEscape(pageUrl(baseUrl, page.path))}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${xmlEscape(page.changefreq || "weekly")}</changefreq>
    <priority>${xmlEscape(page.priority || "0.5")}</priority>
  </url>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
}

function generateRobots(config, baseUrl) {
  const blocked = new Set(config.indexingRules?.blockedPaths || []);
  for (const page of internalPages(config)) {
    if (page.path) blocked.add(page.path);
    if (page.file) blocked.add(`/${page.file}`);
  }

  const disallowLines = Array.from(blocked).sort().map(item => `Disallow: ${item}`).join("\n");
  return `User-agent: *
Allow: /
${disallowLines}

Sitemap: ${baseUrl}/sitemap.xml`;
}

function generateSearch(config, baseUrl, keywordMap) {
  return JSON.stringify(publicPages(config).map(page => ({
    title: page.title,
    url: pageUrl(baseUrl, page.path),
    description: page.description,
    primaryKeyword: page.primaryKeyword || "",
    keywords: keywordMeta(page, keywordMap)
  })), null, 2);
}

function generateLlms(config, baseUrl) {
  const rows = publicPages(config)
    .map(page => `- [${page.title}](${pageUrl(baseUrl, page.path)}): ${page.description}`)
    .join("\n");

  return `# ${config.site.name}

${config.site.name} provides structured Teer result pages, previous result archives, common-number statistics, dream-number references, and formula explainers for users in India.

## Important public pages

${rows}

## Indexing policy

Internal dashboard, raw data files, build assets, CMS config, and admin pages are not intended for search indexing.`;
}

function generateFeed(config, baseUrl) {
  const today = new Date().toUTCString();
  const items = publicPages(config).slice(0, 12).map(page => `    <item>
      <title>${xmlEscape(page.title)}</title>
      <link>${xmlEscape(pageUrl(baseUrl, page.path))}</link>
      <guid>${xmlEscape(pageUrl(baseUrl, page.path))}</guid>
      <description>${xmlEscape(page.description)}</description>
      <pubDate>${today}</pubDate>
    </item>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xmlEscape(config.site.name)}</title>
    <link>${xmlEscape(baseUrl)}/</link>
    <description>${xmlEscape(config.site.name)} public page feed</description>
    <lastBuildDate>${today}</lastBuildDate>
${items}
  </channel>
</rss>`;
}

function getTag(html, regex) {
  const match = html.match(regex);
  return match ? match[1].trim() : "";
}

function auditHtml(config, baseUrl, keywordMap) {
  const report = [];

  for (const page of config.pages) {
    const filePath = path.join(ROOT, page.file || "");
    if (!page.file || !fs.existsSync(filePath)) {
      report.push({ file: page.file, status: "missing-file", issues: ["missing-file"] });
      continue;
    }

    const html = fs.readFileSync(filePath, "utf8");
    const title = getTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const description = getTag(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)
      || getTag(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
    const robots = getTag(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["'][^>]*>/i)
      || getTag(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']robots["'][^>]*>/i);
    const canonical = getTag(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["'][^>]*>/i)
      || getTag(html, /<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["'][^>]*>/i);

    const expectedCanonical = pageUrl(baseUrl, page.path);
    const expectedRobots = page.index === false ? config.indexingRules.internal : config.indexingRules.public;
    const issues = [];
    const primaryKeyword = String(page.primaryKeyword || "").toLowerCase();
    const pageKeywords = keywordMeta(page, keywordMap);

    if (!title) issues.push("missing-title");
    if (title && (title.length < 25 || title.length > 65)) issues.push(`title-length-${title.length}`);
    if (!description) issues.push("missing-description");
    if (description && (description.length < 70 || description.length > 170)) issues.push(`description-length-${description.length}`);
    if (!canonical) issues.push("missing-canonical");
    if (canonical && canonical !== expectedCanonical) issues.push(`canonical-expected-${expectedCanonical}`);
    if (!robots) issues.push("missing-robots");
    if (robots && page.index === false && !robots.includes("noindex")) issues.push("internal-page-indexable");
    if (robots && page.index !== false && robots.includes("noindex")) issues.push("public-page-noindex");
    if (page.index !== false && primaryKeyword && title && !title.toLowerCase().includes(primaryKeyword.split(" ")[0])) issues.push(`title-may-not-target-primary-${primaryKeyword}`);

    report.push({
      file: page.file,
      url: expectedCanonical,
      primaryKeyword: page.primaryKeyword || "",
      topKeywords: pageKeywords.slice(0, 5).map(item => `${item.keyword} (${item.searchVolume})`),
      robots: robots || expectedRobots,
      titleLength: title.length,
      descriptionLength: description.length,
      issues
    });
  }

  write("SEO_REPORT.md", `# SEO Automation Report\n\nGenerated: ${new Date().toISOString()}\nKeyword source: cms/keywords.csv\n\n${report.map(row => {
    const issueText = row.issues && row.issues.length ? row.issues.join(", ") : "OK";
    return `## ${row.file}\n- URL: ${row.url || ""}\n- Primary keyword: ${row.primaryKeyword || ""}\n- Top mapped keywords: ${(row.topKeywords || []).join(", ")}\n- Robots: ${row.robots || ""}\n- Title length: ${row.titleLength || 0}\n- Description length: ${row.descriptionLength || 0}\n- Issues: ${issueText}`;
  }).join("\n\n")}\n`);
}

function main() {
  if (!fs.existsSync(CONFIG_PATH)) throw new Error("Missing cms/seo-pages.json");
  const config = readJson(CONFIG_PATH);
  const keywordMap = readKeywords(KEYWORDS_PATH);
  const baseUrl = cleanBase(config.site.baseUrl);

  write("sitemap.xml", generateSitemapIndex(baseUrl));
  write("sitemap-pages.xml", generatePagesSitemap(config, baseUrl));
  write("robots.txt", generateRobots(config, baseUrl));
  write("search.json", generateSearch(config, baseUrl, keywordMap));
  write("llms.txt", generateLlms(config, baseUrl));
  write("rss.xml", generateFeed(config, baseUrl));
  write("feed.xml", generateFeed(config, baseUrl));
  auditHtml(config, baseUrl, keywordMap);
}

main();
