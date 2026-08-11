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

if (errors.length) fail([...new Set(errors)]);
else {
  console.log('Production package validation: PASS');
  console.log(`Required files checked: ${REQUIRED.length}`);
  console.log(`HTML files checked: ${htmlFiles.length}`);
  console.log('Retired endpoint scan: PASS');
  console.log('Local asset reference scan: PASS');
}
