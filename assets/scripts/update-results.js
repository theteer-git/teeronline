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
    url: "https://teertooday.com/",
    parser: parseShillongDay
  },
  {
    gameId: "KH",
    game: "khanapara day",
    city: "Khanapara",
    url: "https://khanaparateerresult.tv/",
    parser: parseElementorGame("KHANAPARA TEER RESULT TODAY")
  },
  {
    gameId: "JWD",
    game: "juwai day",
    city: "Juwai",
    url: "https://khanaparateerresult.tv/",
    parser: parseElementorGame("JUWAI TEER RESULT TODAY")
  },
  {
    gameId: "JWM",
    game: "juwai morning",
    city: "Juwai",
    url: "https://juwaimorningresult.com/",
    parser: parseJuwaiMorning
  },
  {
    gameId: "KHM",
    game: "khanapara morning",
    city: "Khanapara",
    url: "https://www.khanaparateermorning.com/",
    parser: parseKhanaparaMorning
  },
  {
    gameId: "SHM",
    game: "shillong morning",
    city: "Shillong",
    url: "https://morningsundayteer.com/",
    parser: parseShillongMorning
  },
  {
    gameId: "SHN1",
    game: "Shillong Night",
    city: "Shillong",
    url: "https://www.shillonghillsnightteer.com/",
    parser: parseShillongNight1
  },
  {
    gameId: "SHN2",
    game: "Shillong Night 2",
    city: "Shillong",
    url: "https://nightteer.com/",
    parser: parseShillongNight2
  }
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

  if (["", "xx", "x", "-", "—", "na", "n/a", "off", "null", "undefined"].includes(v)) {
    return "";
  }

  if (!/^\d{1,2}$/.test(v)) return "";

  const n = Number(v);
  if (n < 0 || n > 99) return "";

  return String(n).padStart(2, "0");
}

function isComplete(record) {
  return normalizeNumber(record?.fr) && normalizeNumber(record?.sr);
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
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Invalid JSON:", error.message);
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
  return data.find(item => item.gameId === game.gameId && item.date === todayIST());
}

function createTodayRecord(data, game) {
  const checkedAt = nowISTISO();

  const record = {
    id: `${game.gameId}-${todayIST()}`,
    game: game.game,
    city: game.city,
    gameId: game.gameId,
    date: todayIST(),
    fr: "",
    frUpdatedAt: "",
    sr: "",
    srUpdatedAt: "",
    status: "pending",
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

  const newFr = normalizeNumber(result.fr);
  const newSr = normalizeNumber(result.sr);

  record.id = `${game.gameId}-${todayIST()}`;
  record.game = game.game;
  record.city = game.city;
  record.gameId = game.gameId;
  record.date = todayIST();
  record.lastCheckedAt = checkedAt;

  delete record.source;
  delete record.timestampType;

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

  if (isComplete(record)) {
    record.status = "completed";
  } else if (normalizeNumber(record.fr) || normalizeNumber(record.sr)) {
    record.status = "partial";
  } else {
    record.status = "pending";
  }

  return changed;
}

/* ---------------- SOURCE-SPECIFIC PARSERS ---------------- */

function parseShillongDay(html) {
  const $ = cheerio.load(html);

  const table = $("th")
    .filter((i, el) => $(el).text().trim().toUpperCase() === "SHILLONG")
    .closest("table");

  const row = table.find("tr").eq(2);

  return {
    fr: normalizeNumber(row.find("td").eq(0).text()),
    sr: normalizeNumber(row.find("td").eq(1).text())
  };
}

function parseShillongMorning(html) {
  const $ = cheerio.load(html);

  const table = $("th")
    .filter((i, el) => $(el).text().toUpperCase().includes("SHILLONG"))
    .closest("table");

  const row = table.find("tr").eq(2);

  return {
    fr: normalizeNumber(row.find("td").eq(0).text()),
    sr: normalizeNumber(row.find("td").eq(1).text())
  };
}

function parseJuwaiMorning(html) {
  const $ = cheerio.load(html);

  return {
    fr: normalizeNumber($("#frResult").text()),
    sr: normalizeNumber($("#srResult").text())
  };
}

function parseKhanaparaMorning(html) {
  const $ = cheerio.load(html);

  const text = $(".result_box").text().replace(/\s+/g, " ");

  const frMatch = text.match(/F\/R\s*:\s*(\d{1,2}|xx)/i);
  const srMatch = text.match(/S\/R\s*:\s*(\d{1,2}|xx)/i);

  return {
    fr: normalizeNumber(frMatch?.[1]),
    sr: normalizeNumber(srMatch?.[1])
  };
}

function parseShillongNight1(html) {
  const $ = cheerio.load(html);

  const table = $("th")
    .filter((i, el) => $(el).text().toUpperCase().includes("SHILLONG HILLS NIGHT TEER"))
    .closest("table");

  const resultRow = table.find("tr").eq(2);

  return {
    fr: normalizeNumber(resultRow.find("td").eq(0).text()),
    sr: normalizeNumber(resultRow.find("td").eq(1).text())
  };
}

function parseShillongNight2(html) {
  const $ = cheerio.load(html);

  const table = $("th")
    .filter((i, el) => $(el).text().toUpperCase().includes("SHILLONG NIGHT"))
    .closest("table");

  const resultRow = table.find("tr").eq(2);

  return {
    fr: normalizeNumber(resultRow.find("td").eq(0).text()),
    sr: normalizeNumber(resultRow.find("td").eq(1).text())
  };
}

function parseElementorGame(titleText) {
  return function(html) {
    const $ = cheerio.load(html);
    const fullText = $("body").text().replace(/\s+/g, " ").trim();
    const upper = fullText.toUpperCase();
    const title = titleText.toUpperCase();

    const startIndex = upper.indexOf(title);
    if (startIndex === -1) {
      return { fr: "", sr: "" };
    }

    const block = fullText.slice(startIndex, startIndex + 900);

    const frMatch = block.match(/FR\s*\(First Round\)\s*[\d: ]*[AP]M\s*(\d{1,2}|xx)/i);
    const srMatch = block.match(/SR\s*\(Second Round\)\s*[\d: ]*[AP]M\s*(\d{1,2}|xx)/i);

    return {
      fr: normalizeNumber(frMatch?.[1]),
      sr: normalizeNumber(srMatch?.[1])
    };
  };
}

/* ---------------- MAIN ---------------- */

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

      if (!result.fr && !result.sr) {
        console.log(`No published result found for ${game.game}`);
        continue;
      }

      const didChange = updateRecord(data, game, result);

      if (didChange) {
        changed = true;
      }
    } catch (error) {
      console.log(`Failed ${game.game}: ${error.message}`);
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