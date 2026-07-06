const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "../../data/all-results.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));

const GAME_ID_BY_NAME = {
  "shillong day": "SHD",
  "shillong teer": "SHD",
  "khanapara day": "KH",
  "khanapara teer": "KH",
  "juwai day": "JWD",
  "juwai teer": "JWD",
  "juwai morning": "JWM",
  "khanapara morning": "KHM",
  "shillong morning": "SHM",
  "shillong night": "SHN1",
  "shillong hills night teer": "SHN1",
  "shillong night 2": "SHN2",
  "shillong night teer 2": "SHN2"
};

function number(value) {
  const v = String(value || "").trim().toLowerCase();
  if (["", "xx", "x", "-", "—", "na", "n/a", "off", "null", "undefined"].includes(v)) return "";
  if (!/^\d{1,2}$/.test(v)) return "";
  return String(Number(v)).padStart(2, "0");
}

function gameId(item) {
  const id = String(item.g || item.gameId || item.game_id || "").toUpperCase().trim();
  if (id) return id;
  return GAME_ID_BY_NAME[String(item.game || "").toLowerCase().trim()] || "";
}

const seen = new Set();
const cleaned = data
  .map(item => ({
    g: gameId(item),
    d: item.d || item.date || "",
    f: number(item.f || item.fr || item.first_round),
    s: number(item.s || item.sr || item.second_round)
  }))
  .filter(item => item.g && item.d && item.f && item.s)
  .filter(item => {
    const key = `${item.g}|${item.d}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })
  .sort((a, b) => {
    if (a.d !== b.d) return b.d.localeCompare(a.d);
    return a.g.localeCompare(b.g);
  });

fs.writeFileSync(file, JSON.stringify(cleaned, null, 2) + "\n");
console.log(`all-results.json compacted: ${cleaned.length} records`);
