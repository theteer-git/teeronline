const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "../data/all-results.json");

const data = JSON.parse(fs.readFileSync(file, "utf8"));

const cleaned = data.map(item => {
  const copy = { ...item };
  delete copy.frUpdatedAt;
  delete copy.srUpdatedAt;
  delete copy.lastCheckedAt;
  return copy;
});

fs.writeFileSync(file, JSON.stringify(cleaned, null, 2) + "\n");

console.log("all-results.json cleaned successfully");