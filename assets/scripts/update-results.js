const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");

const DATA_FILE = path.join(__dirname, "../../data/all-results.json");
const RECENT_FILE = path.join(__dirname, "../../data/recent-results.json");
const LATEST_FILE = path.join(__dirname, "../../data/latest-results.json");

const GAME_META = {
  SHD: { gameId: "SHD", game: "shillong day", city: "Shillong" },
  KH: { gameId: "KH", game: "khanapara day", city: "Khanapara" },
  JWD: { gameId: "JWD", game: "juwai day", city: "Juwai" },
  JWM: { gameId: "JWM", game: "juwai morning", city: "Juwai" },
  KHM: { gameId: "KHM", game: "khanapara morning", city: "Khanapara" },
  SHM: { gameId: "SHM", game: "shillong morning", city: "Shillong" },
  SHN1: { gameId: "SHN1", game: "Shillong Night", city: "Shillong" },
  SHN2: { gameId: "SHN2", game: "Shillong Night 2", city: "Shillong" }
};

const GAMES = [
  { ...GAME_META.SHD, url: "https://teertooday.com/", parser: parseShillongDay },
  { ...GAME_META.KH, url: "https://khanaparateerresult.tv/", parser: parseElementorGame("KHANAPARA TEER RESULT TODAY") },
  { ...GAME_META.JWD, url: "https://khanaparateerresult.tv/", parser: parseElementorGame("JUWAI TEER RESULT TODAY") },
  { ...GAME_META.JWM, url: "https://khanaparateerresult.tv/", parser: parseElementorGame("JUWAI MORNING TEER RESULT") },
  { ...GAME_META.KHM, url: "https://www.khanaparateermorning.com/", parser: parseKhanaparaMorning },
  { ...GAME_META.SHM, url: "https://morningsundayteer.com/", parser: parseShillongMorning },
  { ...GAME_META.SHN1, url: "https://www.shillonghillsnightteer.com/", parser: parseShillongNight1 },
  { ...GAME_META.SHN2, url: "https://nightteer.com/", parser: parseShillongNight2 }
];

function getISTDateObject() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

function todayIST() {
  const d = getISTDateObject();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowISTISO() {
  const d = getISTDateObject();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}+05:30`;
}

function normalizeNumber(value) {
  const v = String(value || "").trim().toLowerCase();
  if (["", "xx", "x", "-", "—", "na", "n/a", "off", "null", "undefined"].includes(v)) return "";
  if (!/^\d{1,2}$/.test(v)) return "";
  return String(Number(v)).padStart(2, "0");
}

function normalizeRecord(item) {
  const gameId = String(item?.g || item?.gameId || item?.game_id || "").toUpperCase().trim();
  const meta = GAME_META[gameId] || {};
  return {
    g: gameId,
    d: item?.d || item?.date || "",
    f: normalizeNumber(item?.f || item?.fr || item?.first_round),
    s: normalizeNumber(item?.s || item?.sr || item?.second_round),
    _frUpdatedAt: item?.frUpdatedAt || "",
    _srUpdatedAt: item?.srUpdatedAt || "",
    _lastCheckedAt: item?.lastCheckedAt || "",
    _game: item?.game || meta.game || "",
    _city: item?.city || meta.city || ""
  };
}

function toPublicRecord(item) {
  const r = normalizeRecord(item);
  return { g: r.g, d: r.d, f: r.f, s: r.s };
}

function toVerboseRecord(item) {
  const r = normalizeRecord(item);
  const meta = GAME_META[r.g] || {};
  return {
    id: `${r.g}-${r.d}`,
    game: r._game || meta.game || r.g,
    city: r._city || meta.city || "",
    gameId: r.g,
    date: r.d,
    fr: r.f,
    sr: r.s,
    status: r.f && r.s ? "completed" : r.f || r.s ? "partial" : "pending",
    lastCheckedAt: r._lastCheckedAt || nowISTISO(),
    frUpdatedAt: r._frUpdatedAt || "",
    srUpdatedAt: r._srUpdatedAt || ""
  };
}

function isComplete(record) {
  const r = normalizeRecord(record);
  return Boolean(r.f && r.s);
}

async function fetchHtml(url) {
  const response = await axios.get(url, {
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });
  return response.data;
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return Array.isArray(data) ? data.map(toPublicRecord).filter(r => r.g && r.d) : [];
  } catch {
    return [];
  }
}

function saveData(data) {
  const compact = data.map(toPublicRecord).filter(r => r.g && r.d);
  compact.sort((a, b) => {
    if (a.d !== b.d) return b.d.localeCompare(a.d);
    return a.g.localeCompare(b.g);
  });
  fs.writeFileSync(DATA_FILE, JSON.stringify(compact, null, 2) + "\n");
}

function saveRecentResults(data) {
  const recent = data
    .map(toVerboseRecord)
    .filter(item => item.gameId && item.date && item.fr && item.sr)
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return String(a.gameId).localeCompare(String(b.gameId));
    })
    .slice(0, 100);
  fs.writeFileSync(RECENT_FILE, JSON.stringify(recent, null, 2) + "\n");
}

function saveLatestResults(data) {
  const today = todayIST();
  const latest = GAMES.map(game => {
    const record = data.find(item => normalizeRecord(item).g === game.gameId && normalizeRecord(item).d === today);
    if (!record) {
      return { id: `${game.gameId}-${today}`, game: game.game, city: game.city, gameId: game.gameId, date: today, fr: "", sr: "", status: "pending", lastCheckedAt: nowISTISO() };
    }
    return toVerboseRecord(record);
  });
  fs.writeFileSync(LATEST_FILE, JSON.stringify(latest, null, 2) + "\n");
}

function findTodayRecord(data, game) {
  return data.find(item => normalizeRecord(item).g === game.gameId && normalizeRecord(item).d === todayIST());
}

function createTodayRecord(data, game) {
  const record = { g: game.gameId, d: todayIST(), f: "", s: "" };
  data.push(record);
  return record;
}

function updateRecord(data, game, result) {
  let record = findTodayRecord(data, game);
  if (!record) record = createTodayRecord(data, game);
  const newFr = normalizeNumber(result.fr);
  const newSr = normalizeNumber(result.sr);
  let changed = false;
  if (newFr && newFr !== normalizeRecord(record).f) { record.f = newFr; changed = true; }
  if (newSr && newSr !== normalizeRecord(record).s) { record.s = newSr; changed = true; }
  return changed;
}

function parseShillongDay(html) {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const m = text.match(/SHILLONG\s+F\/R\s*\([^)]*\)\s*S\/R\s*\([^)]*\)\s*(\d{1,2}|xx)\s+(\d{1,2}|xx)/i);
  return { fr: normalizeNumber(m?.[1]), sr: normalizeNumber(m?.[2]) };
}

function parseShillongMorning(html) {
  const $ = cheerio.load(html);
  const table = $("th").filter((i, el) => $(el).text().toUpperCase().includes("SHILLONG")).closest("table");
  const row = table.find("tr").eq(2);
  return { fr: normalizeNumber(row.find("td").eq(0).text()), sr: normalizeNumber(row.find("td").eq(1).text()) };
}

function parseKhanaparaMorning(html) {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const frMatch = text.match(/F\/R\s*:\s*(\d{1,2}|xx)/i);
  const srMatch = text.match(/S\/R\s*:\s*(\d{1,2}|xx)/i);
  return { fr: normalizeNumber(frMatch?.[1]), sr: normalizeNumber(srMatch?.[1]) };
}

function parseShillongNight1(html) {
  const $ = cheerio.load(html);
  const table = $("th").filter((i, el) => $(el).text().toUpperCase().includes("SHILLONG HILLS NIGHT TEER")).closest("table");
  const row = table.find("tr").eq(2);
  return { fr: normalizeNumber(row.find("td").eq(0).text()), sr: normalizeNumber(row.find("td").eq(1).text()) };
}

function parseShillongNight2(html) {
  const $ = cheerio.load(html);
  const table = $("th").filter((i, el) => $(el).text().toUpperCase().includes("SHILLONG NIGHT")).closest("table");
  const row = table.find("tr").eq(2);
  return { fr: normalizeNumber(row.find("td").eq(0).text()), sr: normalizeNumber(row.find("td").eq(1).text()) };
}

function parseElementorGame(titleText) {
  return function(html) {
    const $ = cheerio.load(html);
    const fullText = $("body").text().replace(/\s+/g, " ").trim();
    const upper = fullText.toUpperCase();
    const title = titleText.toUpperCase();
    const startIndex = upper.indexOf(title);
    if (startIndex === -1) return { fr: "", sr: "" };
    const block = fullText.slice(startIndex, startIndex + 1200);
    const frMatch = block.match(/FR\s*\(First Round\)\s*[\d: ]*[AP]M\s*(\d{1,2}|xx)/i);
    const srMatch = block.match(/SR\s*\(Second Round\)\s*[\d: ]*[AP]M\s*(\d{1,2}|xx)/i);
    return { fr: normalizeNumber(frMatch?.[1]), sr: normalizeNumber(srMatch?.[1]) };
  };
}

async function main() {
  const data = loadData();
  let changed = false;
  for (const game of GAMES) {
    const todayRecord = findTodayRecord(data, game);
    if (isComplete(todayRecord)) {
      console.log(`Skipping ${game.game}. Today's FR and SR already completed.`);
      continue;
    }
    console.log(`Checking ${game.game} from ${game.url}`);
    try {
      const html = await fetchHtml(game.url);
      const result = game.parser(html);
      console.log(`${game.game}: FR=${result.fr || "-"} SR=${result.sr || "-"}`);
      if (!result.fr && !result.sr) continue;
      if (updateRecord(data, game, result)) changed = true;
    } catch (error) {
      console.log(`Failed ${game.game}: ${error.message}`);
    }
  }
  if (changed) {
    saveData(data);
    console.log("all-results.json updated in compact public schema.");
  } else {
    console.log("No new result changes.");
  }
  saveRecentResults(data);
  saveLatestResults(data);
  console.log("recent-results.json and latest-results.json rebuilt.");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
