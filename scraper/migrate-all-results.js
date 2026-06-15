const fs = require("fs");

const INPUT_FILE = "../data/all-results.json";
const OUTPUT_FILE = "../data/all-results-migrated.json";

const GAME_CONFIG = {
  "khanapara teer": {
    gameId: "KH",
    fr: "16:00:00",
    sr: "16:15:00"
  },

  "juwai morning": {
    gameId: "JWM",
    fr: "11:00:00",
    sr: "11:15:00"
  },

  "juwai day": {
    gameId: "JWD",
    fr: "15:00:00",
    sr: "15:15:00"
  },

  "shillong morning": {
    gameId: "SHM",
    fr: "10:30:00",
    sr: "10:45:00"
  },

  "shillong day": {
    gameId: "SHD",
    fr: "15:30:00",
    sr: "15:45:00"
  },

  "night teer 1": {
    gameId: "SHN1",
    fr: "19:00:00",
    sr: "19:15:00"
  },

  "night teer 2": {
    gameId: "SHN2",
    fr: "20:00:00",
    sr: "20:15:00"
  }
};

function normalizeDate(dateStr) {

  if (!dateStr) return null;

  dateStr = String(dateStr).trim();

  // dd/mm/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [dd, mm, yyyy] = dateStr.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }

  // dd-mm-yyyy
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [dd, mm, yyyy] = dateStr.split("-");
    return `${yyyy}-${mm}-${dd}`;
  }

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  return dateStr;
}

function createTimestamp(date, time) {
  return `${date}T${time}+05:30`;
}

function getGameConfig(gameName) {

  const key = String(gameName || "")
    .toLowerCase()
    .trim();

  return (
    GAME_CONFIG[key] || {
      gameId: "UNKNOWN",
      fr: "00:00:00",
      sr: "00:00:00"
    }
  );
}

try {

  const raw = fs.readFileSync(INPUT_FILE, "utf8");

  let data = JSON.parse(raw);

  // Support both:
  // [ ... ]
  // and
  // { results:[ ... ] }

  let records;

  if (Array.isArray(data)) {
    records = data;
  }
  else if (Array.isArray(data.results)) {
    records = data.results;
  }
  else {
    throw new Error(
      "Cannot find results array in all-results.json"
    );
  }

  console.log(`Found ${records.length} records`);

  const migrated = records.map(record => {

    const config =
      getGameConfig(record.game);

    const date =
      normalizeDate(record.date);

    const frUpdatedAt =
      createTimestamp(date, config.fr);

    const srUpdatedAt =
      createTimestamp(date, config.sr);

    return {

      id: `${config.gameId}-${date}`,

      game: record.game || null,

      city: record.city || null,

      gameId: config.gameId,

      date,

      fr: record.fr || null,

      frUpdatedAt,

      sr: record.sr || null,

      srUpdatedAt,

      status:
        record.fr && record.sr
          ? "completed"
          : "pending",

      source: "historical-import",

      timestampType: "estimated",

      lastCheckedAt: srUpdatedAt
    };

  });

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(migrated, null, 2),
    "utf8"
  );

  console.log(
    `Migration completed successfully`
  );

  console.log(
    `Output file: ${OUTPUT_FILE}`
  );

  console.log(
    `Total records converted: ${migrated.length}`
  );

} catch (err) {

  console.error(
    "Migration failed:"
  );

  console.error(err);

}