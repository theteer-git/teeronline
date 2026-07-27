const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const runtimePath = path.join(root, 'assets', 'scripts', 'game-unified-page.js');
const runtime = fs.readFileSync(runtimePath, 'utf8');

const livePages = [
  'index.html',
  'khanapara-teer-results.html',
  'juwai-teer-results.html',
  'shillong-morning-teer-results.html',
  'khanapara-morning-teer-results.html',
  'juwai-morning-teer-results.html',
  'shillong-night-teer-results.html',
  'shillong-night-teer-2-results.html'
];

const checks = [
  ['version endpoint is used', /LATEST_VERSION_URL\s*=\s*config\.endpoints\.latestVersion/],
  ['version polling bypasses browser cache', /fetch\([^\n]*LATEST_VERSION_URL[\s\S]{0,180}cache:\s*["']no-store["']/],
  ['unchanged versions avoid a full result refresh', /versionChanged\s*=\s*manual\s*\|\|\s*initialLoad/],
  ['version failure has a latest-result fallback', /catch \(error\) \{[\s\S]{0,220}versionChanged\s*=\s*true;[\s\S]{0,220}latest version check failed/],
  ['latest, recent and common data load independently', /const latestPromise\s*=\s*fetchLatest\(\)[\s\S]{0,260}const recentPromise\s*=\s*manual\s*\|\|\s*initialLoad\s*\?\s*fetchRecent\(\)[\s\S]{0,260}const commonPromise\s*=\s*manual\s*\|\|\s*initialLoad\s*\?\s*fetchCommonNumbers\(\)/],
  ['latest result renders before secondary data completes', /const latest\s*=\s*await latestPromise[\s\S]{0,220}renderResult/],
  ['recent history renders independently', /const recent\s*=\s*await\s*\(recentPromise\s*\|\|\s*fetchRecent\(\)\)[\s\S]{0,220}renderHistory/],
  ['local cache has schema and expiry controls', /CACHE_SCHEMA[\s\S]{0,500}CACHE_TTL[\s\S]{0,1000}localStorage\.removeItem/],
  ['hidden-tab polling protection is present', /visibilitychange[\s\S]{0,300}document\.hidden/],
  ['manual refresh remains available', /getElementById|byId\(["']refresh["']\)[\s\S]{0,120}refresh\(true\)/]
];

let failed = false;
for (const [label, pattern] of checks) {
  if (!pattern.test(runtime)) {
    console.error(`FAIL: ${label}`);
    failed = true;
  } else {
    console.log(`PASS: ${label}`);
  }
}

for (const page of livePages) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  const runtimeRefs = html.match(/game-unified-page\.js\?v=[^"']+/g) || [];
  const configRefs = html.match(/game-config\.js\?v=[^"']+/g) || [];
  if (runtimeRefs.length !== 1 || configRefs.length !== 1) {
    console.error(`FAIL: ${page}: expected one versioned config and runtime reference`);
    failed = true;
  } else {
    console.log(`PASS: ${page}: versioned smart-polling runtime loaded once`);
  }
}

if (failed) process.exit(1);
console.log('Task 10 final frontend regression validation: PASS');
