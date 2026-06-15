const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const EXCEL_FILE = path.join(__dirname, "../Book.CSV.xlsx");
const JSON_FILE = path.join(__dirname, "../data/all-results.json");

const GAME_ID = "SHN1";
const GAME_NAME = "Shillong Night";
const CITY = "Shillong";

const FR_TIME = "19:00:00";
const SR_TIME = "19:15:00";

function normalizeDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const str = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    const [dd, mm, yyyy] = str.split("-");
    return yyyy + "-" + mm + "-" + dd;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [dd, mm, yyyy] = str.split("/");
    return yyyy + "-" + mm + "-" + dd;
  }

  return null;
}

function normalizeNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "xx" ||
    value === "XX" ||
    value === "–" ||
    value === "—" ||
    value === "-"
  ) {
    return "--";
  }

  return String(value).trim().padStart(2, "0");
}

try {
  const workbook = XLSX.readFile(EXCEL_FILE, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const existingData = JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));
  const records = Array.isArray(existingData) ? existingData : existingData.results;

  let added = 0;
  let skipped = 0;
  let badDate = 0;

  for (const row of rows) {
    const date = normalizeDate(row.DATE || row.Date || row.date);

    if (!date) {
      badDate++;
      continue;
    }

    const fr = normalizeNumber(row["F/R"] || row.FR || row.fr);
    const sr = normalizeNumber(row["S/R"] || row.SR || row.sr);

    const id = GAME_ID + "-" + date;

    const exists = records.some(function (r) {
      return r.id === id;
    });

    if (exists) {
      skipped++;
      continue;
    }

    records.push({
      id: id,
      game: GAME_NAME,
      city: CITY,
      gameId: GAME_ID,
      date: date,

      fr: fr,
      frUpdatedAt: date + "T" + FR_TIME + "+05:30",

      sr: sr,
      srUpdatedAt: date + "T" + SR_TIME + "+05:30",

      status: "completed",
      source: "historical-import",
      timestampType: "estimated",
      lastCheckedAt: date + "T" + SR_TIME + "+05:30"
    });

    added++;
  }

  records.sort(function (a, b) {
    return b.date.localeCompare(a.date);
  });

  fs.writeFileSync(
    JSON_FILE + ".backup-before-shn1",
    JSON.stringify(existingData, null, 2),
    "utf8"
  );

  if (Array.isArray(existingData)) {
    fs.writeFileSync(JSON_FILE, JSON.stringify(records, null, 2), "utf8");
  } else {
    existingData.results = records;
    fs.writeFileSync(JSON_FILE, JSON.stringify(existingData, null, 2), "utf8");
  }

  console.log("Shillong Night import completed");
  console.log("Added:", added);
  console.log("Skipped:", skipped);
  console.log("Bad dates:", badDate);
  console.log("Total records:", records.length);

} catch (err) {
  console.error("Import failed:");
  console.error(err);
}