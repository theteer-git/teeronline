const fs = require("fs");

const SITE_URL = "https://teeronline.com";

const RESULTS_SITEMAP_PATH = "sitemap-results.xml";
const PAGES_SITEMAP_PATH = "sitemap-pages.xml";

const RESULT_URLS = {
  SHD: `${SITE_URL}/shillong-teer-previous-results`,
  KH: `${SITE_URL}/khanapara-teer-previous-results`,
  JWD: `${SITE_URL}/juwai-teer-previous-results`,
  SHM: `${SITE_URL}/shillong-morning-teer-previous-results`,
  KHM: `${SITE_URL}/khanapara-morning-teer-previous-results`,
  JWM: `${SITE_URL}/juwai-morning-teer-previous-results`,
  SHN1: `${SITE_URL}/shillong-night-teer-previous-results`,
  SHN2: `${SITE_URL}/shillong-night-teer-2-previous-results`
};

const PAGE_URLS = {
  HOME: `${SITE_URL}/`,
  COMMON: `${SITE_URL}/common-numbers`,
  FORMULA: `${SITE_URL}/teer-formula`,
  DREAM: `${SITE_URL}/dream-numbers`,
  ABOUT: `${SITE_URL}/about`,
  CONTACT: `${SITE_URL}/contact`,
  PRIVACY: `${SITE_URL}/privacy-policy`,
  TERMS: `${SITE_URL}/terms-and-conditions`,
  DISCLAIMER: `${SITE_URL}/disclaimer`
};

function nowIST() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}+05:30`;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function oldDate(xml, url, fallback) {
  const match = xml.match(
    new RegExp(`<loc>${escapeRegex(url)}</loc>\\s*<lastmod>(.*?)</lastmod>`, "s")
  );
  return match?.[1] || fallback;
}

function block(url, date, changefreq, priority) {
  return `<url>
  <loc>${url}</loc>
  <lastmod>${date}</lastmod>
  <changefreq>${changefreq}</changefreq>
  <priority>${priority}</priority>
</url>`;
}

function writeResultsSitemap(updatedGames = []) {
  const now = nowIST();
  const oldXml = fs.existsSync(RESULTS_SITEMAP_PATH)
    ? fs.readFileSync(RESULTS_SITEMAP_PATH, "utf8")
    : "";

  const changed = new Set(updatedGames);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Object.entries(RESULT_URLS).map(([gameId, url]) => {
  const date = changed.has(gameId) ? now : oldDate(oldXml, url, "2026-07-09T00:00:00+05:30");
  return block(url, date, "always", "0.90");
}).join("\n")}
</urlset>
`;

  fs.writeFileSync(RESULTS_SITEMAP_PATH, xml, "utf8");
}

function writePagesSitemap(options = {}) {
  const now = nowIST();
  const oldXml = fs.existsSync(PAGES_SITEMAP_PATH)
    ? fs.readFileSync(PAGES_SITEMAP_PATH, "utf8")
    : "";

  const changed = new Set();

  if (options.homeChanged) changed.add("HOME");
  if (options.commonChanged) changed.add("COMMON");

  const pageConfig = [
    ["HOME", "always", "1.00"],
    ["COMMON", "daily", "0.95"],
    ["FORMULA", "monthly", "0.75"],
    ["DREAM", "monthly", "0.75"],
    ["ABOUT", "yearly", "0.30"],
    ["CONTACT", "yearly", "0.30"],
    ["PRIVACY", "yearly", "0.20"],
    ["TERMS", "yearly", "0.20"],
    ["DISCLAIMER", "yearly", "0.20"]
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

${pageConfig.map(([key, freq, priority]) => {
  const url = PAGE_URLS[key];
  const date = changed.has(key) ? now : oldDate(oldXml, url, "2026-07-09T00:00:00+05:30");
  return `  ${block(url, date, freq, priority).replace(/\n/g, "\n  ")}`;
}).join("\n\n")}

</urlset>
`;

  fs.writeFileSync(PAGES_SITEMAP_PATH, xml, "utf8");
}

function updateSitemaps({ updatedGames = [], commonChanged = false } = {}) {
  const validGames = [...new Set(updatedGames)].filter(game => RESULT_URLS[game]);

  if (validGames.length > 0) {
    writeResultsSitemap(validGames);
  }

  if (validGames.length > 0 || commonChanged) {
    writePagesSitemap({
      homeChanged: validGames.length > 0,
      commonChanged
    });
  }

  if (validGames.length > 0 || commonChanged) {
    console.log("Sitemaps updated:", {
      resultPages: validGames,
      homepage: validGames.length > 0,
      commonNumbers: commonChanged
    });
    return true;
  }

  return false;
}

module.exports = {
  updateSitemaps
};