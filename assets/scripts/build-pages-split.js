/**
 * Build high-refresh Cloudflare Pages output.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const output = path.join(root, "dist-pages");
const gamePages = [
  "khanapara-teer-results.html",
  "juwai-teer-results.html",
  "shillong-morning-teer-results.html",
  "khanapara-morning-teer-results.html",
  "juwai-morning-teer-results.html",
  "shillong-night-teer-results.html",
  "shillong-night-teer-2-results.html"
];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

function copyFile(relativePath, required = true) {
  const source = path.join(root, relativePath);
  const destination = path.join(output, relativePath);
  if (!fs.existsSync(source)) {
    if (required) throw new Error(`Missing required source file: ${relativePath}`);
    return;
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function copyDirectory(relativePath) {
  const source = path.join(root, relativePath);
  const destination = path.join(output, relativePath);
  if (!fs.existsSync(source)) return;
  fs.cpSync(source, destination, { recursive: true, force: true });
}

copyFile("index.html");
for (const page of gamePages) copyFile(page);
copyFile("404.html");
copyFile("sw.js");
copyFile("site.webmanifest", false);
copyFile("robots.txt", false);
copyFile("sitemap.xml", false);
copyFile("sitemap-pages.xml", false);
copyFile("sitemap-results.xml", false);
copyDirectory("assets/img");
copyFile("assets/css/game-unified-page.css");
copyFile("assets/scripts/game-config.js");
copyFile("assets/scripts/game-unified-page.js");

fs.writeFileSync(path.join(output, "_headers"), `/*
  Cache-Control: public, max-age=0, must-revalidate
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/sw.js
  Cache-Control: no-cache, no-store, must-revalidate
`, "utf8");

const redirects = [
  "/index.html / 301",
  "/shillong-teer-results / 301",
  "/shillong-teer-results.html / 301",
  "/common-numbers / 301",
  "/common-numbers.html / 301",
  ...gamePages.map(page => `/${page} /${page.replace(/\.html$/, "")} 301`)
];
fs.writeFileSync(path.join(output, "_redirects"), `${redirects.join("\n")}\n`, "utf8");

console.log("Cloudflare Pages split output created in dist-pages/");
console.log(`Included homepage (SHD), ${gamePages.length} non-home unified game pages, SEO fallbacks and shared assets.`);
