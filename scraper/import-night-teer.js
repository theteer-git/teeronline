const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const EXCEL_FILE = path.join(
  __dirname,
  "../Book1.CSV.xlsx"
);

const JSON_FILE = path.join(
  __dirname,
  "../data/all-results.json"
);

try {

  const workbook =
    XLSX.readFile(EXCEL_FILE);

  const sheet =
    workbook.Sheets[
      workbook.SheetNames[0]
    ];

  const rows =
    XLSX.utils.sheet_to_json(
      sheet,
      { defval: "" }
    );

  const existingData =
    JSON.parse(
      fs.readFileSync(
        JSON_FILE,
        "utf8"
      )
    );

  const records =
    Array.isArray(existingData)
      ? existingData
      : existingData.results;

  let added = 0;
  let skipped = 0;

  for (const row of rows) {

    if (!row.DATE) {
      continue;
    }

    const date =
      String(row.DATE)
        .substring(0, 10);

    const fr =
      String(row.FR || "")
        .trim()
        .padStart(2, "0");

    const sr =
      String(row.SR || "")
        .trim()
        .padStart(2, "0");

    const id =
      "SHN2-" + date;

    const exists =
      records.some(function(r) {
        return r.id === id;
      });

    if (exists) {
      skipped++;
      continue;
    }

    records.push({

      id: id,

      game: "night teer 2",

      city: "Shillong Night",

      gameId: "SHN2",

      date: date,

      fr: fr,

      frUpdatedAt:
        date +
        "T20:00:00+05:30",

      sr: sr,

      srUpdatedAt:
        date +
        "T20:15:00+05:30",

      status: "completed",

      source:
        "historical-import",

      timestampType:
        "estimated",

      lastCheckedAt:
        date +
        "T20:15:00+05:30"

    });

    added++;

  }

  records.sort(function(a, b) {
    return b.date.localeCompare(
      a.date
    );
  });

  if (Array.isArray(existingData)) {

    fs.writeFileSync(
      JSON_FILE,
      JSON.stringify(
        records,
        null,
        2
      ),
      "utf8"
    );

  } else {

    existingData.results =
      records;

    fs.writeFileSync(
      JSON_FILE,
      JSON.stringify(
        existingData,
        null,
        2
      ),
      "utf8"
    );

  }

  console.log(
    "Added:",
    added
  );

  console.log(
    "Skipped:",
    skipped
  );

  console.log(
    "Total:",
    records.length
  );

} catch (err) {

  console.error(err);

}