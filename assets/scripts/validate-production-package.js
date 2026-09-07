'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const REQUIRED = [
  'index.html',
  '404.html',
  'robots.txt',
  'sitemap.xml',
  'site.webmanifest',
  '_headers',
  '_redirects',
  'assets/scripts/game-config.js',
  'assets/scripts/result-live-monitoring.js',
  'assets/scripts/game-unified-page.js',
  'assets/css/game-unified-page.css',
  'assets/img/logo.webp',
];

function fail(messages) {
  console.error('Production package validation: FAIL');
  for (const message of messages) console.error(`- ${message}`);
  process.exitCode = 1;
}

const errors = [];
for (const name of REQUIRED) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) errors.push(`Missing required file: ${name}`);
  else if (fs.statSync(file).size === 0) errors.push(`Required file is empty: ${name}`);
}

const htmlFiles = fs.readdirSync(ROOT).filter((name) => name.endsWith('.html'));
for (const name of htmlFiles) {
  const html = fs.readFileSync(path.join(ROOT, name), 'utf8');
  if (/teer-api\.maya-digital-rkn\.workers\.dev/i.test(html)) {
    errors.push(`${name} contains a retired Worker endpoint`);
  }
  if (/\b(?:src|href)=["'](?:\.\/)?assets\/[^"']+["']/gi.test(html)) {
    for (const match of html.matchAll(/\b(?:src|href)=["'](?:\.\/)?(assets\/[^"'#?]+)["']/gi)) {
      if (!fs.existsSync(path.join(ROOT, match[1]))) errors.push(`${name} references missing asset: ${match[1]}`);
    }
  }
}

const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
if (!/<urlset\b/i.test(sitemap)) errors.push('sitemap.xml must directly list canonical URLs');
if (sitemapUrls.length !== 23 || new Set(sitemapUrls).size !== 23) {
  errors.push(`sitemap.xml must contain 23 unique URLs; found ${sitemapUrls.length}`);
}
if (sitemapUrls.some((url) => !url.startsWith('https://teeronline.com/'))) {
  errors.push('sitemap.xml contains a non-canonical host or protocol');
}

const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
if (!/^User-agent:\s*\*/mi.test(robots) || !/^Sitemap:\s*https:\/\/teeronline\.com\/sitemap\.xml\s*$/mi.test(robots)) {
  errors.push('robots.txt must declare the apex sitemap with standard directives');
}

if (errors.length) fail([...new Set(errors)]);
else {
  console.log('Production package validation: PASS');
  console.log(`Required files checked: ${REQUIRED.length}`);
  console.log(`HTML files checked: ${htmlFiles.length}`);
  console.log('Retired endpoint scan: PASS');
  console.log('Local asset reference scan: PASS');
  console.log('Canonical 23-URL sitemap and robots scan: PASS');
}
