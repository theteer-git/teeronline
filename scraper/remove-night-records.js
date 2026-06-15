const fs = require("fs");
const path = require("path");

const FILE = path.join(
  __dirname,
  "../data/all-results.json"
);

try {

  const data = JSON.parse(
    fs.readFileSync(FILE, "utf8")
  );

  const records = Array.isArray(data)
    ? data
    : data.results;

  const originalCount = records.length;

  const cleaned = records.filter((record) => {

    const game = String(
      record.game || ""
    )
      .toLowerCase()
      .trim();

    return (
      game !== "shillong night" &&
      game !== "night teer 2"
    );

  });

  const removed =
    originalCount - cleaned.length;

  // Backup
  fs.writeFileSync(
    FILE + ".backup",
    JSON.stringify(data, null, 2),
    "utf8"
  );

  if (Array.isArray(data)) {

    fs.writeFileSync(
      FILE,
      JSON.stringify(
        cleaned,
        null,
        2
      ),
      "utf8"
    );

  } else {

    data.results = cleaned;

    fs.writeFileSync(
      FILE,
      JSON.stringify(
        data,
        null,
        2
      ),
      "utf8"
    );

  }

  console.log("");
  console.log("Completed Successfully");
  console.log(
    "Original Records:",
    originalCount
  );
  console.log(
    "Removed Records:",
    removed
  );
  console.log(
    "Remaining Records:",
    cleaned.length
  );

} catch (err) {

  console.error(
    "Failed:"
  );

  console.error(err);

}