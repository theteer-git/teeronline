const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");

const DATA_FILE = path.join(__dirname, "../../data/all-results.json");

const GAMES = [
  {
    gameId: "shillong-day",
    name: "Shillong Day",
    sources: ["https://teertooday.com/", "https://www.teerresults.com/"],
    keywords: ["SHILLONG", "SHILLONG TEER"]
  },
  {
    gameId: "khanapara-day",
    name: "Khanapara Day",
    sources: ["https://www.teerresults.com/", "https://khanaparateerresult.tv/"],
    keywords: ["KHANAPARA", "KHANAPARA TEER"]
  },
  {
    gameId: "juwai-day",
    name: "Juwai Day",
    sources: ["https://khanaparateerresult.tv/", "https://www.teerresults.com/"],
    keywords: ["JUWAI", "JOWAI", "JUWAI TEER", "JOWAI TEER"]
  },
  {
    gameId: "juwai-morning",
    name: "Juwai Morning",
    sources: ["https://juwaimorningresult.com/", "https://khanaparateerresult.tv/"],
    keywords: ["JUWAI MORNING", "JOWAI MORNING"]
  },
  {
    gameId: "khanapara-morning",
    name: "Khanapara Morning",
    sources: ["https://www.khanaparateermorning.com/"],
    keywords: ["KHANAPARA MORNING"]
  },
  {
    gameId: "shillong-morning",
    name: "Shillong Morning",
    sources: ["https://morningsundayteer.com/"],
    keywords: ["SHILLONG MORNING", "MORNING SUNDAY"]
  },
  {
    gameId: "shillong-night",
    name: "Shillong Night",
    sources: ["https://www.shillonghillsnightteer.com/"],
    keywords: ["SHILLONG HILLS NIGHT", "SHILLONG NIGHT"]
  },
  {
    gameId: "shillong-night-2",
    name: "Shillong Night 2",
    sources: ["https://nightteer.com/"],
    keywords: ["NIGHT TEER", "SHILLONG NIGHT"]
  }
];

function todayIST() {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const yyyy = ist.getFullYear();
  const mm = String(ist.getMonth() + 1).padStart(2, "0");
  const dd = String(ist.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function nowISO() {
  return new Date().toISOString();
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

    const block = text.slice(index, index + 600);

    const numbers = [...block.matchAll(/\b\d{1,2}\b/g)]
      .map(m => normalizeNumber(m[0]))
      .filter(n => /^\d{2}$/.test(n));

    const filtered = numbers.filter(n => {
      const x = Number(n);
      return x >= 0 && x <= 99;
    });

    if (filtered.length >= 2) {
      return {
        fr: filtered[0],
        sr: filtered[1]
      };
    }

    if (filtered.length === 1) {
      return {
        fr: filtered[0],
        sr: ""
      };
    }
  }

  return null;
}

async function fetchResult(game) {
  for (const source of game.sources) {
    try {
      const response = await axios.get(source, {
        timeout: 20000,
        headers: {
          "User-Agent": "Mozilla/5.0 Teer Result Bot"
        }
      });

      const text = cleanText(response.data);
      const result = extractFromText(text, game.keywords);

      if (result && (result.fr || result.sr)) {
        return {
          ...result,
          source
        };
      }
    } catch (error) {
      console.log(`Failed: ${game.name} from ${source}`);
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
  } catch {
    return [];
  }
}

function saveData(data) {
  data.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.gameId.localeCompare(b.gameId);
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
    console.log(`Checking ${game.name}...`);

    const result = await fetchResult(game);

    if (!result) {
      console.log(`No result found for ${game.name}`);
      continue;
    }

    console.log(`${game.name}: FR=${result.fr || "-"} SR=${result.sr || "-"} Source=${result.source}`);

    const didChange = updateRecord(data, game, result);

    if (didChange) changed = true;
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