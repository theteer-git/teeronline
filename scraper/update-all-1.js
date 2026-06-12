const fs = require("fs");
const cheerio = require("cheerio");

const html = fs.readFileSync("./index.html", "utf8");

const $ = cheerio.load(html);

const archiveResults = [];

$("table").each((i, table) => {
    $(table)
        .find("tr")
        .each((j, row) => {
            const cols = $(row)
                .find("td,th")
                .map((k, cell) => $(cell).text().trim())
                .get();

            if (
                cols.length >= 3 &&
                cols[0] !== "Date" &&
                cols[0] !== "DATE"
            ) {
                archiveResults.push({
                    date: cols[0],
                    fr: cols[1],
                    sr: cols[2]
                });
            }
        });
});

fs.writeFileSync(
    "./data/shillong-night-archive.json",
    JSON.stringify(archiveResults, null, 2)
);

console.log("Saved:", archiveResults.length);