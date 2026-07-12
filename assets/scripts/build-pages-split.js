/**
 * Phase XIX: build only the high-refresh pages for Cloudflare Pages.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const output = path.join(root, "dist-pages");

const filesToCopy = [
  "index.html",
  "common-numbers.html",
  "404.html",
  "sw.js",
  "logo.webp",
  "site.webmanifest",
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "apple-touch-icon.png"
];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const filename of filesToCopy) {
  const source = path.join(root, filename);
  const destination = path.join(output, filename);

  if (!fs.existsSync(source)) {
    console.warn(`Skipping missing file: ${filename}`);
    continue;
  }

  fs.copyFileSync(source, destination);
}

fs.writeFileSync(
  path.join(output, "_headers"),
`/*
  Cache-Control: public, max-age=0, must-revalidate
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/sw.js
  Cache-Control: no-cache, no-store, must-revalidate
`,
  "utf8"
);

fs.writeFileSync(
  path.join(output, "_redirects"),
`/index.html / 301
/common-numbers.html /common-numbers 301
`,
  "utf8"
);

console.log("Cloudflare Pages split output created in dist-pages/");
console.log("Included available files plus _headers and _redirects.");