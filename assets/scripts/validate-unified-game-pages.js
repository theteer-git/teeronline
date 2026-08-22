'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME_PAGES = [
  'khanapara-teer-results.html',
  'juwai-teer-results.html',
  'shillong-morning-teer-results.html',
  'khanapara-morning-teer-results.html',
  'juwai-morning-teer-results.html',
  'shillong-night-teer-results.html',
  'shillong-night-teer-2-results.html',
];
const ARCHIVE_PAGES = [
  'shillong-teer-previous-results.html',
  ...GAME_PAGES.map((name) => name.replace('-results.html', '-previous-results.html')),
];

function fail(message) {
  console.error(`Unified game page validation: FAIL\n${message}`);
  process.exitCode = 1;
}

function read(name) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) throw new Error(`Missing page: ${name}`);
  return fs.readFileSync(file, 'utf8');
}

try {
  for (const page of [...GAME_PAGES, ...ARCHIVE_PAGES]) {
    const html = read(page);
    if (!/<html\b/i.test(html) || !/<main\b/i.test(html)) {
      throw new Error(`${page} is not a complete HTML page with a main landmark`);
    }
  }
  for (const page of GAME_PAGES) {
    const html = read(page);
    if (!/game-config\.js/i.test(html)) {
      throw new Error(`${page} does not load game-config.js`);
    }
  }

  const jwd = read('juwai-teer-results.html');
  if (!/(2:00\s*PM|14:00)/i.test(jwd) || !/(2:40\s*PM|14:40)/i.test(jwd)) {
    throw new Error('JWD live page does not contain the corrected 2:00 PM / 2:40 PM schedule');
  }
  if (/id="jwd-fr-time"[^>]*>[^<]*2:30\s*PM/i.test(jwd) || /id="jwd-sr-time"[^>]*>[^<]*3:15\s*PM/i.test(jwd)) {
    throw new Error('JWD live page still shows the retired 2:30 PM / 3:15 PM header times');
  }

  const shn2 = read('shillong-night-teer-2-results.html');
  if (!/(11:10\s*PM|23:10)/i.test(shn2) || !/(12:10\s*AM|00:10)/i.test(shn2)) {
    throw new Error('SHN2 live page does not contain the 11:10 PM / 12:10 AM schedule');
  }

  console.log('Unified game page validation: PASS');
  console.log(`Live pages checked: ${GAME_PAGES.length}`);
  console.log(`Archive pages checked: ${ARCHIVE_PAGES.length}`);
  console.log('JWD corrected schedule: PASS');
  console.log('SHN2 midnight schedule: PASS');
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
