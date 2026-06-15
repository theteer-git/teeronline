const fs = require("fs");
const path = require("path");

const FILE = path.join(
  __dirname,
  "../data/all-results.json"
);

const BACKUP = path.join(
  __dirname,
  "../data/all-results.backup.json"
);

try {

  console.log("Loading:", FILE);

  const raw = fs.readFileSync(FILE, "utf8");
  const data = JSON.parse(raw);

  // Backup first
  fs.writeFileSync(
    BACKUP,
    raw,
    "utf8"
  );

  console.log("Backup created:", BACKUP);

  const records = Array.isArray(data)
    ? data
    : data.results;

  if (!Array.isArray(records)) {
    throw new Error(
      "Could not find results array"
    );
  }

  const originalCount = records.length;

  const cleaned = [];

  for (const record of records) {

    const game = String(
      record.game || ""
    )
      .toLowerCase()
      .trim();

    if (
      game !== "shillong night" &&
      game !== "night teer 2"
    ) {
      cleaned.push(record);
    }

  }

  const removed =
    originalCount - cleaned.length;

  if (Array.isArray(data)) {

    fs.writeFileSync(
      FILE,
      JSON.stringify(cleaned, null, 2),
      "utf8"
    );

  } else {

    data.results = cleaned;

    fs.writeFileSync(
      FILE,
      JSON.stringify(data, null, 2),
      "utf8"
    );

  }

  console.log(
    `Original Records : ${originalCount}`
  );

  console.log(
    `Removed Records  : ${removed}`
  );

  console.log(
    `Remaining Records: ${cleaned.length}`
  );

  console.log("Completed Successfully");

} catch (err) {

  console.error(
    "Error:"
  );

  console.error(err);

}