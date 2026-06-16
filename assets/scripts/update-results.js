const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");

const DATA_FILE = path.join(__dirname, "../../data/all-results.json");

const GAMES = [
  {
    gameId: "SHD",
    game: "shillong day",
    city: "Shillong",
    sources: ["https://teertooday.com/", "https://www.teerresults.com/"],
    keywords: ["SHILLONG", "SHILLONG TEER"]
  },
  {
    gameId: "KH",
    game: "khanapara day",
    city: "Khanapara",
    sources: ["https://www.teerresults.com/", "https://khanaparateerresult.tv/"],
    keywords: ["KHANAPARA", "KHANAPARA TEER"]
  },
  {
    gameId: "JWD",
    game: "juwai day",
    city: "Juwai",
    sources: ["https://khanaparateerresult.tv/", "https://www.teerresults.com/"],
    keywords: ["JUWAI", "JOWAI", "JUWAI TEER", "JOWAI TEER"]
  },
  {
    gameId: "JWM",
    game: "juwai morning",
    city: "Juwai",
    sources: ["https://juwaimorningresult.com/", "https://khanaparateerresult.tv/"],
    keywords: ["JUWAI MORNING", "JOWAI MORNING"]
  },
  {
    gameId: "KHM",
    game: "khanapara morning",
    city: "Khanapara",
    sources: ["https://www.khanaparateermorning.com/"],
    keywords: ["KHANAPARA MORNING"]
  },
  {
    gameId: "SHM",
    game: "shillong morning",
    city: "Shillong",
    sources: ["https://morningsundayteer.com/"],
    keywords: ["SHILLONG MORNING", "MORNING SUNDAY"]
  },
  {
    gameId: "SHN1",
    game: "Shillong Night",
    city: "Shillong",
    sources: ["https://www.shillonghillsnightteer.com/"],
    keywords: ["SHILLONG HILLS NIGHT", "SHILLONG NIGHT"]
  },
  {
    gameId: "SHN2",
    game: "Shillong Night 2",
    city: "Shillong",
    sources: ["https://nightteer.com/"],
    keywords: ["NIGHT TEER", "SHILLONG NIGHT"]
  }
];

function getISTDateObject() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

function todayIST() {
  const ist = getISTDateObject();
  const yyyy = ist.getFullYear();
  const mm = String(ist.getMonth() + 1).padStart(2, "0");
  const dd = String(ist.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function nowISTISO() {
  const ist = getISTDateObject();
  const yyyy = ist.getFullYear();
  const mm = String(ist.getMonth() + 1).padStart(2, "0");
  const dd = String(ist.getDate()).padStart(2, "0");
  const hh = String(ist.getHours()).padStart(2, "0");
  const min = String(ist.getMinutes()).padStart(2, "0");
  const ss = String(ist.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}+05:30`;
}

function isInvalidValue(value) {
  const v = String(value || "").trim().toLowerCase();
  return ["", "xx", "x", "-", "—", "na", "n/a", "null", "undefined", "off"].includes(v);
}

function isValidResultNumber(value) {
  if (isInvalidValue(value)) return false;
  const v = String(value).trim();
  if (!/^\d{1,2}$/.test(v)) return false;
  const n = Number(v);
  return n >= 0 && n <= 99;
}

function normalizeNumber(value) {
  if (!isValidResultNumber(value)) return "";
  return String(Number(value)).padStart(2, "0");
}

function isCompleted(record) {
  return (
    record &&
    isValidResultNumber(record.fr) &&
    isValidResultNumber(record.sr)
  );
}

function cleanText(html) {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

function extractFromText(text, keywords) {
  const upper = text.toUpperCase();

  for (const keyword of keywords) {
    const index = upper.indexOf(keyword.toUpperCase());
    if (index === -1) continue;

    const block = text.slice(index, index + 1000);

    const numbers = [...block.matchAll(/\b\d{1,2}\b/g)]
      .map(m => normalizeNumber(m[0]))
      .filter(Boolean);

    if (numbers.length >= 2) {
      return {
        fr: numbers[0],
        sr: numbers[1]
      };
    }

    if (numbers.length === 1) {
      return {
        fr: numbers[0],
        sr: ""
      };
    }
  }

  return null;
}

async function fetchResult(game) {
  for (const source of game.sources) {
    try {
      console.log(`Fetching ${game.game} from ${source}`);

      const response = await axios.get(source, {
        timeout: 20000,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; TeerResultBot/1.0)"
        }
      });

      const text = cleanText(response.data);
      const result = extractFromText(text, game.keywords);

      if (result && (result.fr || result.sr)) {
        return {
          fr: result.fr || "",
          sr: result.sr || "",
          source
        };
      }
    } catch (error) {
      console.log(`Failed ${game.game} from ${source}: ${error.message}`);
    }
  }

  return null;
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) return [];

  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Could not read all-results.json:", error.message);
    return [];
  }
}

function saveData(data) {
  data.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return String(a.gameId).localeCompare(String(b.gameId));
  });

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n");
}

function findTodayRecord(data, game) {
  const date = todayIST();

  return data.find(item =>
    item.gameId === game.gameId &&
    item.date === date
  );
}

function createTodayRecord(data, game) {
  const date = todayIST();
  const checkedAt = nowISTISO();

  const record = {
    id: `${game.gameId}-${date}`,
    game: game.game,
    city: game.city,
    gameId: game.gameId,
    date,
    fr: "",
    frUpdatedAt: "",
    sr: "",
    srUpdatedAt: "",
    status: "pending",
    source: "",
    timestampType: "live",
    lastCheckedAt: checkedAt
  };

  data.push(record);
  return record;
}

function updateRecord(data, game, result) {
  let record = findTodayRecord(data, game);

  if (!record) {
    record = createTodayRecord(data, game);
  }

  const checkedAt = nowISTISO();
  let changed = false;

  record.id = `${game.gameId}-${todayIST()}`;
  record.game = game.game;
  record.city = game.city;
  record.gameId = game.gameId;
  record.date = todayIST();
  record.timestampType = record.timestampType || "live";
  record.lastCheckedAt = checkedAt;

  if (result.source) {
    record.source = result.source;
  }

  const newFr = normalizeNumber(result.fr);
  const newSr = normalizeNumber(result.sr);

  if (newFr && newFr !== record.fr) {
    record.fr = newFr;
    record.frUpdatedAt = checkedAt;
    changed = true;
  }

  if (newSr && newSr !== record.sr) {
    record.sr = newSr;
    record.srUpdatedAt = checkedAt;
    changed = true;
  }

  if (isCompleted(record)) {
    record.status = "completed";
  } else if (isValidResultNumber(record.fr) || isValidResultNumber(record.sr)) {
    record.status = "partial";
  } else {
    record.status = "pending";
  }

  return changed;
}

async function main() {
  const data = loadData();
  let changed = false;

  for (const game of GAMES) {
    const todayRecord = findTodayRecord(data, game);

    if (isCompleted(todayRecord)) {
      console.log(`Skipping ${game.game}. Today's FR and SR already completed.`);
      continue;
    }

    console.log(`Checking ${game.game}...`);

    const result = await fetchResult(game);

    if (!result) {
      console.log(`No result found for ${game.game}`);
      continue;
    }

    console.log(
      `${game.game}: FR=${result.fr || "-"} SR=${result.sr || "-"} Source=${result.source}`
    );

    const didChange = updateRecord(data, game, result);

    if (didChange) {
      changed = true;
    }
  }

  if (changed) {
    saveData(data);
    console.log("all-results.json updated.");
  } else {
    console.log("No new result changes.");
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});