"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const RESULTS_URL = "https://results.teeronline.com/all-results.json";
const ARCHIVES = {
  SHD: { file: "shillong-teer-previous-results.html", game: "shillong day" },
  KH: { file: "khanapara-teer-previous-results.html", game: "khanapara day" },
  JWD: { file: "juwai-teer-previous-results.html", game: "juwai day" },
  SHM: { file: "shillong-morning-teer-previous-results.html", game: "shillong morning" },
  KHM: { file: "khanapara-morning-teer-previous-results.html", game: "khanapara morning" },
  JWM: { file: "juwai-morning-teer-previous-results.html", game: "juwai morning" },
  SHN1: { file: "shillong-night-teer-previous-results.html", game: "shillong night" },
  SHN2: { file: "shillong-night-teer-2-previous-results.html", game: "shillong night 2" }
};

const LIVE = {
  SHD: { file: "index.html", id: "shd-date", datePublished: true },
  KH: { file: "khanapara-teer-results.html", id: "kh-date", datePublished: true },
  JWD: { file: "juwai-teer-results.html", id: "jwd-date", datePublished: true },
  SHM: { file: "shillong-morning-teer-results.html", id: "shm-date", datePublished: true },
  KHM: { file: "khanapara-morning-teer-results.html", id: "khm-date", datePublished: true },
  JWM: { file: "juwai-morning-teer-results.html", id: "jwm-date", datePublished: true },
  SHN1: { file: "shillong-night-teer-results.html", id: "shn1-date", datePublished: true },
  SHN2: { file: "shillong-night-teer-2-results.html", id: "shn2-date", datePublished: true }
};

const ALIASES = {
  SHD: ["shillong day", "shillong teer"],
  KH: ["khanapara day", "khanapara teer"],
  JWD: ["juwai day", "juwai teer"],
  SHM: ["shillong morning"],
  KHM: ["khanapara morning"],
  JWM: ["juwai morning"],
  SHN1: ["shillong night", "shillong hills night teer"],
  SHN2: ["shillong night 2", "shillong night teer 2"]
};

function pad(n) { return String(n).padStart(2, "0"); }
function isoDate(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function displayDate(d) { return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`; }
function cleanNumber(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!/^\d{1,2}$/.test(s)) return null;
  const n = Number(s);
  return n >= 0 && n <= 99 ? String(n).padStart(2, "0") : null;
}
function parseDate(value) {
  const s = String(value || "").trim();
  let m = s.match(/^(\d{4})[-\/]([01]\d)[-\/]([0-3]\d)/);
  if (m) return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
  m = s.match(/^([0-3]\d)[-\/]([01]\d)[-\/](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2])-1, Number(m[1]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function dayName(d) { return d.toLocaleDateString("en-IN", { weekday: "long" }); }
function gameRows(raw, gameId) {
  if (!Array.isArray(raw)) throw new Error("all-results.json is not an array");
  const aliases = new Set(ALIASES[gameId]);
  return raw.map(item => {
    const gid = String(item.g || item.gameId || item.game_id || "").toUpperCase().trim();
    const game = String(item.game || "").toLowerCase().trim();
    if (gid === gameId || aliases.has(game)) {
      const d = parseDate(item.d || item.date);
      const fr = cleanNumber(item.f ?? item.fr ?? item.first_round);
      const sr = cleanNumber(item.s ?? item.sr ?? item.second_round);
      if (d && fr !== null && sr !== null) return { d, fr, sr };
    }
    return null;
  }).filter(Boolean).sort((a,b) => b.d - a.d);
}
function rowsHtml(rows) {
  return rows.slice(0, 25).map(r =>
    `<tr data-static-archive-row="true"><td>${displayDate(r.d)}</td><td>${dayName(r.d)}</td><td>${r.fr}</td><td>${r.sr}</td></tr>`
  ).join("\n");
}
function currentBusinessDate(gameId) {
  const now = new Date();
  // Convert to IST without relying on the machine timezone.
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  if (gameId === "SHN2" && ist.getHours() === 0) ist.setDate(ist.getDate() - 1);
  return ist;
}
function refreshLivePage(file, gameId) {
  const full = path.join(root, file);
  let html = fs.readFileSync(full, "utf8");
  const d = currentBusinessDate(gameId);
  const ymd = isoDate(d);
  const dmy = displayDate(d);
  const isoModified = `${ymd}T00:00:00+05:30`;

  html = html.replace(/TODAY_IST/g, ymd);
  html = html.replace(/\"dateModified\"\s*:\s*\"[^\"]+\"/g, `"dateModified":"${isoModified}"`);
  html = html.replace(/(<span[^>]+id=["'](?:shd-date|kh-date|jwd-date|shm-date|khm-date|jwm-date|shn1-date|shn2-date)["'][^>]*>\s*📅\s*)\d{2}\/\d{2}\/\d{4}/g, `$1${dmy}`);
  fs.writeFileSync(full, html, "utf8");
}
async function fetchResultsWithRetry() {
  const attempts = 5;
  const delayMs = 20000;
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${RESULTS_URL}?t=${Date.now()}`, {
        headers: { accept: "application/json", "cache-control": "no-cache" }
      });
      if (!response.ok) throw new Error(`all-results.json HTTP ${response.status}`);
      const raw = await response.json();
      if (!Array.isArray(raw)) throw new Error("all-results.json is not an array");
      return raw;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError || new Error("all-results.json could not be verified");
}

async function main() {
  const raw = await fetchResultsWithRetry();
  const skippedGames = [];
  for (const [gameId, cfg] of Object.entries(ARCHIVES)) {
    const rows = gameRows(raw, gameId);
    if (!rows.length) {
      skippedGames.push(gameId);
      continue;
    }
    const file = path.join(root, cfg.file);
    let html = fs.readFileSync(file, "utf8");
    const tbodyPattern = /(<tbody[^>]*>)([\s\S]*?)(<\/tbody>)/i;
    if (!tbodyPattern.test(html)) throw new Error(`Missing archive tbody in ${cfg.file}`);
    html = html.replace(tbodyPattern, (_, open, _old, close) => `${open}\n${rowsHtml(rows)}\n${close}`);
    html = html.replace(/<div([^>]*id=["']loading[^>]*>)[\s\S]*?<\/div>/i, m => m.replace(/Loading data\.\.\./, "Loading full archive…"));
    fs.writeFileSync(file, html, "utf8");
  }
  for (const [gameId, cfg] of Object.entries(LIVE)) refreshLivePage(cfg.file, gameId);
  console.log(`SEO refresh complete: archive rows and live business dates updated. Skipped unverified games: ${skippedGames.length ? skippedGames.join(", ") : "none"}.`);
}

main().catch(error => { console.error(error); process.exit(1); });
