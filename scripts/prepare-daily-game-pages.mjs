import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import * as cheerio from "cheerio";

const require = createRequire(import.meta.url);
const config = require("../assets/scripts/game-config.js");

const ROOT = process.cwd();
const IST = "Asia/Kolkata";
const RECENT_URL = `${config.resultsOrigin}/recent-results.json`;
const ALL_URL = `${config.resultsOrigin}/all-results.json`;

const OUTPUT_FILES = Object.freeze({
  SHD: "index.html",
  KH: "khanapara-teer-results.html",
  JWD: "juwai-teer-results.html",
  SHM: "shillong-morning-teer-results.html",
  KHM: "khanapara-morning-teer-results.html",
  JWM: "juwai-morning-teer-results.html",
  SHN1: "shillong-night-teer-results.html",
  SHN2: "shillong-night-teer-2-results.html"
});

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const dueMode = args.has("--due") || ![...args].some(value => value.startsWith("--game="));
const requestedGame = [...args].find(value => value.startsWith("--game="))?.split("=")[1]?.toUpperCase() || null;
const historyFile = [...args].find(value => value.startsWith("--history-file="))?.split("=").slice(1).join("=") || null;

function istParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short"
  }).formatToParts(date).reduce((acc, item) => {
    acc[item.type] = item.value;
    return acc;
  }, {});
  return {
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: parts.weekday,
    minutesOfDay: Number(parts.hour) * 60 + Number(parts.minute)
  };
}

function longDate(isoDate) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function displayDate(isoDate) {
  const [year, month, day] = String(isoDate).split("-");
  return `${day}/${month}/${year}`;
}

function shiftIsoDate(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function minutes(value) {
  const [hour, minute] = String(value).split(":").map(Number);
  return hour * 60 + minute;
}

function clock(value) {
  const [hourText, minute] = String(value).split(":");
  const hour = Number(hourText);
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function validNumber(value) {
  return /^\d{1,2}$/.test(String(value ?? "").trim());
}

function pad(value) {
  return validNumber(value) ? String(value).padStart(2, "0") : "XX";
}

function normalizeRecord(item = {}) {
  return {
    gameId: String(item.gameId || item.g || item.game || "").toUpperCase(),
    date: String(item.date || item.d || ""),
    fr: item.fr ?? item.f ?? "",
    sr: item.sr ?? item.s ?? ""
  };
}

function flattenRecords(payload) {
  if (Array.isArray(payload)) return payload.map(normalizeRecord);
  if (Array.isArray(payload?.results)) return payload.results.map(normalizeRecord);
  if (Array.isArray(payload?.records)) return payload.records.map(normalizeRecord);
  if (payload?.records && typeof payload.records === "object") {
    return Object.values(payload.records).flatMap(value => Array.isArray(value) ? value : [value]).map(normalizeRecord);
  }
  if (payload && typeof payload === "object") {
    return Object.values(payload).flatMap(value => Array.isArray(value) ? value : [value]).map(normalizeRecord);
  }
  return [];
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "TeerOnline-Daily-Preparation/1.0" },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

async function loadHistory() {
  let combined;
  if (historyFile) {
    const fixture = JSON.parse(fs.readFileSync(path.resolve(ROOT, historyFile), "utf8"));
    combined = flattenRecords(fixture);
  } else {
    const [recentPayload, allPayload] = await Promise.all([fetchJson(RECENT_URL), fetchJson(ALL_URL)]);
    combined = [...flattenRecords(allPayload), ...flattenRecords(recentPayload)];
  }
  const seen = new Set();
  return combined.filter(item => {
    if (!item.gameId || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !validNumber(item.fr) || !validNumber(item.sr)) return false;
    const key = `${item.gameId}|${item.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    item.fr = pad(item.fr);
    item.sr = pad(item.sr);
    return true;
  });
}

function dateMs(isoDate) {
  return Date.parse(`${isoDate}T00:00:00Z`) || 0;
}

function daysBetween(newer, older) {
  return Math.max(0, Math.round((dateMs(newer) - dateMs(older)) / 86_400_000));
}

function frequency(values) {
  const map = new Map();
  for (const value of values) map.set(value, (map.get(value) || 0) + 1);
  return map;
}

function topValues(map, count, tieBreaker = "asc") {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || (tieBreaker === "desc" ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0])))
    .slice(0, count)
    .map(([value]) => value);
}

function repeatedPairs(records, count = 6) {
  const map = frequency(records.map(item => `${item.fr}-${item.sr}`));
  const repeated = [...map.entries()].filter(([, total]) => total > 1).sort((a, b) => b[1] - a[1]);
  return (repeated.length ? repeated : [...map.entries()]).slice(0, count).map(([value]) => value);
}

function lastSeen(records, round, number, targetDate) {
  const found = records.find(item => item[round] === number);
  return found ? daysBetween(targetDate, found.date) : 9999;
}

function missingNumbers(records, round, targetDate, count = 3) {
  return Array.from({ length: 100 }, (_, index) => String(index).padStart(2, "0"))
    .map(number => ({ number, days: lastSeen(records, round, number, targetDate) }))
    .sort((a, b) => b.days - a.days || a.number.localeCompare(b.number))
    .slice(0, count);
}

function bothMissing(records, targetDate, count = 3) {
  return Array.from({ length: 100 }, (_, index) => String(index).padStart(2, "0"))
    .map(number => {
      const frDays = lastSeen(records, "fr", number, targetDate);
      const srDays = lastSeen(records, "sr", number, targetDate);
      return { number, days: Math.min(frDays, srDays) };
    })
    .sort((a, b) => b.days - a.days || a.number.localeCompare(b.number))
    .slice(0, count);
}

function weekdayOf(isoDate) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(new Date(`${isoDate}T00:00:00Z`));
}

function gameAnalytics(allRecords, gameId, targetDate) {
  const history = allRecords
    .filter(item => item.gameId === gameId && item.date < targetDate)
    .sort((a, b) => dateMs(b.date) - dateMs(a.date));

  if (!history.length) throw new Error(`No completed historical records found for ${gameId}.`);

  const previous = history[0];
  const last7 = history.slice(0, 7);
  const last14 = history.slice(0, 14);
  const last30 = history.slice(0, 30);
  const targetWeekday = weekdayOf(targetDate);
  const weekdayRecords = history.filter(item => weekdayOf(item.date) === targetWeekday).slice(0, 52);
  const sameDate = history.filter(item => item.date.slice(5) === targetDate.slice(5)).slice(0, 5);

  const recentFreq = frequency(last30.flatMap(item => [item.fr, item.sr]));
  const allFreq = frequency(history.flatMap(item => [item.fr, item.sr]));
  const last14Freq = frequency(last14.flatMap(item => [item.fr, item.sr]));
  const weekdayFreq = frequency(weekdayRecords.flatMap(item => [item.fr, item.sr]));
  const last7Freq = frequency(last7.flatMap(item => [item.fr, item.sr]));

  const direct = topValues(recentFreq, 6);
  const houses = topValues(frequency(direct.map(value => value[0])), 4).map(Number).map(String);
  const endings = topValues(frequency(direct.map(value => value[1])), 4).map(Number).map(String);
  const repeated = [...last14Freq.entries()].filter(([, total]) => total > 1).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([value]) => value);
  const statistical = topValues(allFreq, 6);
  const weekdayPattern = topValues(weekdayFreq, 6);
  const trend = topValues(last7Freq, 6);
  const hot = topValues(recentFreq, 6);
  const cold = Array.from({ length: 100 }, (_, index) => String(index).padStart(2, "0"))
    .map(number => ({ number, days: Math.min(lastSeen(history, "fr", number, targetDate), lastSeen(history, "sr", number, targetDate)) }))
    .sort((a, b) => b.days - a.days || a.number.localeCompare(b.number))
    .slice(0, 6)
    .map(item => item.number);

  return {
    history,
    previous,
    last7,
    direct,
    houses: houses.length ? houses : ["0", "1", "2", "3"],
    endings: endings.length ? endings : ["0", "1", "2", "3"],
    statistical,
    sameDate: sameDate.length ? sameDate.map(item => `${item.fr}-${item.sr}`) : ["No earlier match"],
    weekdayPattern,
    trend,
    repeated: repeated.length ? repeated : trend,
    pairs: repeatedPairs(history),
    hot,
    cold,
    missingFr: missingNumbers(history, "fr", targetDate),
    missingSr: missingNumbers(history, "sr", targetDate),
    missingBoth: bothMissing(history, targetDate)
  };
}

function chips(values, className = "chip") {
  return values.map(value => `<span class="${className}">${escapeHtml(value)}</span>`).join("");
}

function missingColumn(label, values) {
  return `<div class="missing-col"><b>${escapeHtml(label)}</b>${values.map(item => `<span class="missing-chip"><span>${item.number}</span><i>${item.days >= 9999 ? "not recorded" : `${item.days}d`}</i></span>`).join("")}</div>`;
}

function buildCommonCard(game, targetDate, analytics) {
  const dateLabel = displayDate(targetDate);
  const last7Rows = analytics.last7.map(item => `
    <tr><td>${displayDate(item.date)}</td><td>${item.fr}-${item.sr}</td><td>${item.fr}</td><td>${item.sr}</td><td class="hit">RECORDED</td></tr>`).join("");
  const bars = analytics.last7.map(item => `
    <div class="barcol"><i style="height:${Math.max(8, Number(item.fr))}%"></i><small>${item.fr}</small></div>`).join("");

  return `<article class="game-card" data-game="${game.id}" data-prepared-date="${targetDate}">
    <div class="game-head">
      <div><h2>${escapeHtml(game.name)} Common Numbers and Statistics for ${dateLabel}</h2><div class="result-line">Fresh historical analysis prepared before today’s FR publication window</div></div>
      <span class="game-id">${game.id}</span>
    </div>
    <div class="game-body">
      <section class="common-side">
        <div class="panel-label">🔢 Common Numbers</div>
        <div class="previous-card">
          <div><div class="prev-label">Previous Result</div><div class="prev-result">${analytics.previous.fr} - ${analytics.previous.sr}</div><div class="prev-date">${displayDate(analytics.previous.date)}</div></div>
          <div class="mini-timer">FR Time<br><span class="unlock-badge">${clock(game.rounds.fr)}</span></div>
        </div>
        <div class="two-col">
          <div class="box"><h3>House</h3><div class="num-row">${chips(analytics.houses, "digit")}</div></div>
          <div class="box"><h3>Ending</h3><div class="num-row">${chips(analytics.endings, "digit")}</div></div>
        </div>
        <div class="box"><h3>Direct Common Numbers</h3><div class="direct-grid">${chips(analytics.direct, "direct")}</div></div>
        <div class="accuracy"><div class="accuracy-top"><b>Historical sample</b><span>${Math.min(30, analytics.history.length)} draws</span></div><div class="bar"><i style="width:${Math.min(100, Math.max(10, analytics.history.length * 3))}%"></i></div></div>
        <div class="last7-table"><table><thead><tr><th>Date</th><th>Result</th><th>FR</th><th>SR</th><th>Status</th></tr></thead><tbody>${last7Rows}</tbody></table></div>
        <div class="trend-chart"><h4>Last 7 FR Result Flow</h4><div class="bars">${bars}</div></div>
      </section>
      <section class="stats-side">
        <div class="panel-label">📊 Statistics</div>
        <div class="stats-main"><div class="metric-title"><h3>Most Frequent Historical Numbers</h3><span class="metric-badge">All records</span></div><div class="stats-grid">${chips(analytics.statistical, "statnum")}</div><div class="note-strip">Historical statistics only — not a guaranteed prediction.</div></div>
        <div class="substats">
          <div class="subbox"><div class="metric-title"><h4>Same Date History</h4><span class="metric-badge">Past years</span></div>${chips(analytics.sameDate, "history-item")}</div>
          <div class="subbox"><div class="metric-title"><h4>${weekdayOf(targetDate)} Pattern</h4><span class="metric-badge">Same weekday</span></div>${chips(analytics.weekdayPattern, "pattern-item")}</div>
          <div class="subbox"><div class="metric-title"><h4>Last 7 Days Trend</h4><span class="metric-badge">Recent</span></div>${chips(analytics.trend, "history-item")}</div>
          <div class="subbox"><div class="metric-title"><h4>Repeated Numbers</h4><span class="metric-badge">Last 14</span></div>${chips(analytics.repeated)}</div>
          <div class="subbox pair-block span-2"><h4>Repeated FR-SR Pairs</h4>${chips(analytics.pairs, "chip pair")}</div>
        </div>
        <div class="insight-grid">
          <div class="insight-box"><h4>🔥 Hot Numbers</h4>${chips(analytics.hot)}</div>
          <div class="insight-box"><h4>❄️ Long-Missing Numbers</h4>${chips(analytics.cold, "chip cold")}</div>
        </div>
        <div class="analytics-wide">
          <div class="blocked-panel"><h4>🚫 Longest Missing by Round</h4><div class="missing-grid">${missingColumn("FR", analytics.missingFr)}${missingColumn("SR", analytics.missingSr)}${missingColumn("Both", analytics.missingBoth)}</div></div>
          <div class="formula-panel"><h4>How this panel is prepared</h4><div class="formula-grid"><div class="formula-block"><b>Recent frequency</b><span>Last 30 completed draws</span></div><div class="formula-block"><b>Historical frequency</b><span>All available completed records</span></div><div class="formula-block"><b>Same-date history</b><span>Matching day and month from earlier years</span></div><div class="formula-block"><b>Missing period</b><span>Days since the number last appeared</span></div></div></div>
        </div>
      </section>
    </div>
  </article>`;
}

function updateJsonLd($, game, canonical, targetDate, title, description) {
  const script = $('script[type="application/ld+json"]').first();
  if (!script.length) return;
  try {
    const data = JSON.parse(script.text());
    const nodes = Array.isArray(data?.["@graph"]) ? data["@graph"] : [data];
    for (const node of nodes) {
      if (node?.["@type"] === "WebPage") {
        node.name = title;
        node.description = description;
        node.dateModified = targetDate;
        node.url = canonical;
      }
      if (node?.["@type"] === "BreadcrumbList" && Array.isArray(node.itemListElement)) {
        const last = node.itemListElement[node.itemListElement.length - 1];
        if (last) last.name = `${game.name} Result Today (${longDate(targetDate)})`;
      }
    }
    script.text(JSON.stringify(data));
  } catch (error) {
    throw new Error(`Invalid JSON-LD in ${OUTPUT_FILES[game.id]}: ${error.message}`);
  }
}

function preparePage(gameId, targetDate, allRecords) {
  const game = config.getGame(gameId);
  const file = OUTPUT_FILES[gameId];
  const fullPath = path.join(ROOT, file);
  if (!game || !file || !fs.existsSync(fullPath)) throw new Error(`Missing page or configuration for ${gameId}.`);

  const html = fs.readFileSync(fullPath, "utf8");
  const $ = cheerio.load(html, { decodeEntities: false });
  const alreadyPrepared = $("body").attr("data-prepared-date") === targetDate;
  if (alreadyPrepared && !force) {
    console.log(`[SKIP] ${gameId} already prepared for ${targetDate}.`);
    return false;
  }

  const analytics = gameAnalytics(allRecords, gameId, targetDate);
  const dateText = displayDate(targetDate);
  const canonical = config.absoluteUrl(game.canonicalPath);
  const title = String(game.seo?.title || `${game.name} Result Today – {date}`).replaceAll("{date}", dateText);
  const description = String(game.seo?.description || `Check ${game.name} result for {date} on TeerOnline.`).replaceAll("{date}", dateText);

  $("title").text(title);
  $('meta[name="description"]').attr("content", description);
  $('meta[property="og:title"]').attr("content", title);
  $('meta[property="og:description"]').attr("content", description);
  $('meta[property="og:url"]').attr("content", canonical);
  $('meta[name="twitter:title"]').attr("content", title);
  $('meta[name="twitter:description"]').attr("content", description);
  $('link[rel="canonical"]').attr("href", canonical);

  $("body").attr("data-prepared-date", targetDate);
  $("section.hero h1").text(`${game.name} Result Today – ${dateText}`);
  $("section.hero p").text(`Today’s ${game.name} page is prepared for ${dateText}. FR and SR remain XX until the official results are captured and published.`);

  const prefix = gameId.toLowerCase();
  $(`#${prefix}-date`).text(`📅 ${displayDate(targetDate)}`);
  $(`#${prefix}-fr`).text("XX");
  $(`#${prefix}-sr`).text("XX");
  $(`#${prefix}-status`).text("Pending");
  $(`#${prefix}-fr-time`).text(`🏹 FR: ${clock(game.rounds.fr)}`);
  $(`#${prefix}-sr-time`).text(`🎯 SR: ${clock(game.rounds.sr)}`);
  $(`#${prefix}-fr-badge`).text(clock(game.rounds.fr));
  $(`#${prefix}-sr-badge`).text(clock(game.rounds.sr));

  const commonTarget = $(`#${prefix}-common-card`);
  if (!commonTarget.length) throw new Error(`Missing #${prefix}-common-card in ${file}.`);
  commonTarget.html(buildCommonCard(game, targetDate, analytics));

  updateJsonLd($, game, canonical, targetDate, title, description);
  fs.writeFileSync(fullPath, $.html(), "utf8");
  console.log(`[UPDATED] ${gameId} → ${file} for ${targetDate}.`);
  return true;
}

function isOffDay(game, targetDate) {
  const weekday = new Date(`${targetDate}T00:00:00Z`).getUTCDay();
  return Array.isArray(game.weeklyOffDays) && game.weeklyOffDays.includes(weekday);
}

function duePreparations(now) {
  return config.gameOrder.flatMap(gameId => {
    const game = config.games[gameId];
    const leadMinutes = Number(game.prepareBeforeMinutes || 720);
    const rawPreparationMinute = minutes(game.rounds.fr) - leadMinutes;
    const preparesPreviousDay = rawPreparationMinute < 0;
    const preparationMinute = (rawPreparationMinute + 1440) % 1440;
    const targetDate = preparesPreviousDay
      ? shiftIsoDate(now.isoDate, 1)
      : now.isoDate;

    if (now.minutesOfDay < preparationMinute || isOffDay(game, targetDate)) {
      return [];
    }

    return [{ gameId, targetDate }];
  });
}

async function main() {
  const now = istParts();
  let preparations;
  if (requestedGame) {
    if (!config.getGame(requestedGame)) throw new Error(`Unknown game ID: ${requestedGame}`);
    preparations = [{ gameId: requestedGame, targetDate: now.isoDate }];
  } else if (dueMode) {
    preparations = duePreparations(now);
  } else {
    preparations = [];
  }

  if (!preparations.length) {
    console.log(`No game is due for preparation at ${now.isoDate} ${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")} IST.`);
    return;
  }

  console.log(`Preparing ${preparations.map(item => `${item.gameId}:${item.targetDate}`).join(", ")} (${now.hour}:${String(now.minute).padStart(2, "0")} IST).`);
  const records = await loadHistory();
  let updated = 0;
  for (const { gameId, targetDate } of preparations) {
    if (isOffDay(config.games[gameId], targetDate) && !requestedGame) {
      console.log(`[OFF DAY] ${gameId} skipped for ${targetDate}.`);
      continue;
    }
    if (preparePage(gameId, targetDate, records)) updated += 1;
  }
  console.log(`Daily preparation complete. ${updated} page(s) changed.`);
}

main().catch(error => {
  console.error(`[PREPARATION FAILED] ${error.stack || error.message}`);
  process.exitCode = 1;
});
