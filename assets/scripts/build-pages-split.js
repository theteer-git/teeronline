/**
 * Phase XIX: build only the high-refresh pages for Cloudflare Pages.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const output = path.join(root, "dist-pages");

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

function copyFile(relativePath, required = true) {
  const source = path.join(root, relativePath);
  const destination = path.join(output, relativePath);

  if (!fs.existsSync(source)) {
    if (required) {
      throw new Error(`Missing required source file: ${relativePath}`);
    }

    console.warn(`Skipping missing file: ${relativePath}`);
    return;
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function copyDirectory(relativePath) {
  const source = path.join(root, relativePath);
  const destination = path.join(output, relativePath);

  if (!fs.existsSync(source)) {
    console.warn(`Skipping missing directory: ${relativePath}`);
    return;
  }

  fs.cpSync(source, destination, {
    recursive: true,
    force: true
  });
}

copyFile("index.html");
copyFile("common-numbers.html");
copyFile("404.html");
copyFile("sw.js");
copyFile("site.webmanifest", false);

// Preserve the same paths referenced by the HTML.
copyDirectory("assets/img");

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
console.log(
  "Included index, common-numbers, 404, service worker, manifest and assets/img."
);