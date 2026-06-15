const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");

const DATA_FILE = path.join(__dirname, "../../data/all-results.json");

const GAMES = [
  {
    gameId: "SD",
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
    gameId: "JD",
    game: "juwai day",
    city: "Juwai",
    sources: ["https://khanaparateerresult.tv/", "https://www.teerresults.com/"],
    keywords: ["JUWAI", "JOWAI", "JUWAI TEER", "JOWAI TEER"]
  },
  {
    gameId: "JM",
    game: "juwai morning",
    city: "Juwai",
    sources: ["https://juwaimorningresult.com/", "https://khanaparateerresult.tv/"],
    keywords: ["JUWAI MORNING", "JOWAI MORNING"]
  },
  {
    gameId: "KM",
    game: "khanapara morning",
    city: "Khanapara",
    sources: ["https://www.khanaparateermorning.com/"],
    keywords: ["KHANAPARA MORNING"]
  },
  {
    gameId: "SM",
    game: "shillong morning",
    city: "Shillong",
    sources: ["https://morningsundayteer.com/"],
    keywords: ["SHILLONG MORNING", "MORNING SUNDAY"]
  },
  {
    gameId: "SN",
    game: "shillong night",
    city: "Shillong",
    sources: ["https://www.shillonghillsnightteer.com/"],
    keywords: ["SHILLONG HILLS NIGHT", "SHILLONG NIGHT"]
  },
  {
    gameId: "SN2",
    game: "shillong night 2",
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

function nowISO() {
  return new Date().toISOString();
}

function getISTMinutes() {
  const ist = getISTDateObject();
  return ist.getHours() * 60 + ist.getMinutes();
}

function toMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function isWithinWindow(gameId) {
  const windows = {
    SM: ["10:15", "11:30"],
    KM: ["10:15", "11:30"],
    JM: ["10:15", "11:30"],

    SD: ["15:30", "16:45"],
    KH: ["15:30", "16:45"],
    JD: ["15:30", "16:45"],

    SN: ["19:30", "20:45"],
    SN2: ["20:00", "21:15"]
  };

  const range = windows[gameId];

  if (!range) return true;

  const current = getISTMinutes();
  return current >= toMinutes(range[0]) && current <= toMinutes(range[1]);
}

function normalizeNumber(value) {
  if (!value) return "";
  const match = String(value).match(/\b\d{1,2}\b/);
  if (!match) return "";
  return match[0].padStart(2, "0");
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

    const block = text.slice(index, index + 800);

    const numbers = [...block.matchAll(/\b\d{1,2}\b/g)]
      .map(m => normalizeNumber(m[0]))
      .filter(n => /^\d{2}$/.test(n))
      .filter(n => Number(n) >= 0 && Number(n) <= 99);

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
          fr: result.fr,
          sr: result.sr,
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

function updateRecord(data, game, result) {
  const date = todayIST();
  const checkedAt = nowISO();

  let record = data.find(item => item.gameId === game.gameId && item.date === date);

  if (!record) {
    record = {
      id: `${game.gameId}-${date}`,
      game: game.game,
      city: game.city,
      gameId: game.gameId,
      date,
      fr: "",
      frUpdatedAt: "",
      sr: "",
      srUpdatedAt: "",
      status: "PENDING",
      source: "",
      lastCheckedAt: checkedAt
    };

    data.push(record);
  }

  let changed = false;

  if (result.fr && result.fr !== record.fr) {
    record.fr = result.fr;
    record.frUpdatedAt = checkedAt;
    changed = true;
  }

  if (result.sr && result.sr !== record.sr) {
    record.sr = result.sr;
    record.srUpdatedAt = checkedAt;
    changed = true;
  }

  record.game = game.game;
  record.city = game.city;
  record.gameId = game.gameId;
  record.id = `${game.gameId}-${date}`;
  record.lastCheckedAt = checkedAt;

  if (result.source) {
    record.source = result.source;
  }

  if (record.fr && record.sr) {
    record.status = "COMPLETE";
  } else if (record.fr || record.sr) {
    record.status = "PARTIAL";
  } else {
    record.status = "PENDING";
  }

  return changed;
}

async function main() {
  const data = loadData();
  let changed = false;

  for (const game of GAMES) {
    if (!isWithinWindow(game.gameId)) {
      console.log(`Skipping ${game.game}. Outside update window.`);
      continue;
    }

    const existingToday = data.find(
      item =>
        item.gameId === game.gameId &&
        item.date === todayIST() &&
        item.status === "COMPLETE" &&
        item.fr &&
        item.sr
    );

    if (existingToday) {
      console.log(`Skipping ${game.game}. Today's result already complete.`);
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