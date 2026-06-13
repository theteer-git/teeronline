const fs = require("fs");

const data = JSON.parse(
    fs.readFileSync("D:/GitHub/teeronline/data/all-results.json", "utf-8")
);

// 🔥 VALID NUMBER FILTER
function isValidNumber(n) {
    return /^\d{2}$/.test(n); // only 00–99 allowed
}

const freq = {};

data.forEach(d => {
    [d.fr, d.sr].forEach(n => {

        if (!isValidNumber(n)) return; // 🚫 remove junk

        freq[n] = (freq[n] || 0) + 1;
    });
});

const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1]);

console.log("\n🔥 TOP 10 HOT NUMBERS:");
console.log(sorted.slice(0, 10));

console.log("\n❄️ TOP 10 COLD NUMBERS:");
console.log(sorted.slice(-10));