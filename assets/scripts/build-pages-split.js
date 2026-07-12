/**
 * Phase XIX: build only the two high-refresh pages for Cloudflare Pages.
 * The source of truth remains the existing GitHub repository.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const output = path.join(root, 'dist-pages');
const required = ['index.html', 'common-numbers.html', '404.html'];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const filename of required) {
  const source = path.join(root, filename);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing required source file: ${filename}`);
  }
  fs.copyFileSync(source, path.join(output, filename));
}

fs.writeFileSync(
  path.join(output, '_headers'),
  `/*\n  Cache-Control: public, max-age=0, must-revalidate\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`,
  'utf8'
);

fs.writeFileSync(
  path.join(output, '_redirects'),
  `/index.html / 301\n/common-numbers.html /common-numbers 301\n`,
  'utf8'
);

console.log('Cloudflare Pages split output created in dist-pages/');
console.log('Included: index.html, common-numbers.html, 404.html, _headers, _redirects');
