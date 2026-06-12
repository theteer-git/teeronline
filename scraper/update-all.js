const fs = require("fs");
const cheerio = require("cheerio");

// 👉 Path to your HTML file
const FILE_PATH = "./index.html";

// 👉 Output JSON file
const आउट_FILE = "./data/shillong-night.json";

function scrapeAndSave() {
    try {
        console.log("📂 Reading HTML file...");

        const html = fs.readFileSync(FILE_PATH, "utf-8");
        const $ = cheerio.load(html);

        const results = [];

        $("table tr").each((i, row) => {
            const cols = $(row)
                .find("td, th")
                .map((j, cell) => $(cell).text().trim())
                .get();

            if (cols.length < 4) return;

            const date = cols[1];
            const fr = cols[2];
            const sr = cols[3];

            // ❌ skip headers / invalid rows
            const isHeader =
                !date ||
                date.toLowerCase().includes("date") ||
                fr.toLowerCase().includes("f/r") ||
                sr.toLowerCase().includes("s/r");

            // ✅ validation
            const isValidDate = /\d{2}\/\d{2}\/\d{4}/.test(date);
            const isValidNumber = /^\d{2}$/.test(fr) && /^\d{2}$/.test(sr);

            if (!isHeader && isValidDate && isValidNumber) {
                results.push({
                    date,
                    fr,
                    sr
                });
            }
        });

        // 🔥 remove duplicates
        const unique = Array.from(
            new Map(
                results.map(item => [item.date + item.fr + item.sr, item])
            ).values()
        );

        // 🔄 sort by date (old → new)
        unique.sort((a, b) => {
            const [da, ma, ya] = a.date.split("/");
            const [db, mb, yb] = b.date.split("/");

            return new Date(`${ya}-${ma}-${da}`) - new Date(`${yb}-${mb}-${db}`);
        });

        // 📁 ensure folder exists
        fs.mkdirSync("./data", { recursive: true });

        // 💾 save JSON
        fs.writeFileSync(
            आउट_FILE,
            JSON.stringify(unique, null, 2)
        );

        console.log("\n========================");
        console.log("✅ DATA SAVED SUCCESSFULLY");
        console.log("Total records:", unique.length);
        console.log("File:", आउट_FILE);
        console.log("Latest:", unique[unique.length - 1]);
        console.log("Oldest:", unique[0]);
        console.log("========================\n");

    } catch (err) {
        console.error("❌ Error:", err.message);
    }
}

scrapeAndSave();