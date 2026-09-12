/**
 * Build high-refresh Cloudflare Pages output.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const output = path.join(root, "dist-pages");
const publicFiles = [
  "_headers", "_redirects", "ads.txt", "BingSiteAuth.xml", "humans.txt",
  "llms.txt", "robots.txt", "rss.xml", "security.txt", "site.webmanifest",
  "sitemap.xml", "sw.js"
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

for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".html")) copyFile(entry.name);
}
for (const file of publicFiles) copyFile(file);
copyDirectory("assets");

console.log("Cloudflare Pages split output created in dist-pages/");
console.log("Included the complete public site and assets.");
