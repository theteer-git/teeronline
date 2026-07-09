const fs = require("fs");

const SITE_URL = "https://teeronline.com";
const SITEMAP_PATH = "sitemap-results.xml";

const RESULT_SITEMAP_MAP = {
  HOME: `${SITE_URL}/`,

  SHD: `${SITE_URL}/shillong-teer-previous-results`,
  KH: `${SITE_URL}/khanapara-teer-previous-results`,
  JWD: `${SITE_URL}/juwai-teer-previous-results`,

  SHM: `${SITE_URL}/shillong-morning-teer-previous-results`,
  KHM: `${SITE_URL}/khanapara-morning-teer-previous-results`,
  JWM: `${SITE_URL}/juwai-morning-teer-previous-results`,

  SHN1: `${SITE_URL}/shillong-night-teer-previous-results`,
  SHN2: `${SITE_URL}/shillong-night-teer-2-previous-results`
};

const ORDER = [
  "HOME",
  "SHD",
  "KH",
  "JWD",
  "SHM",
  "KHM",
  "JWM",
  "SHN1",
  "SHN2"
];

function nowIST() {
  const d = new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata"
    })
  );

  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0") +
    "T" +
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0") +
    ":" +
    String(d.getSeconds()).padStart(2, "0") +
    "+05:30"
  );
}


function oldDate(xml, url) {
  const match = xml.match(
    new RegExp(`<loc>${url}</loc>\\s*<lastmod>(.*?)</lastmod>`, "s")
  );

  return match?.[1] || nowIST();
}


function block(url, date, priority) {
return `<url>
  <loc>${url}</loc>
  <lastmod>${date}</lastmod>
  <changefreq>always</changefreq>
  <priority>${priority}</priority>
</url>`;
}


function updateResultsSitemap(updatedGames) {

  if (!updatedGames.length) return;

  const oldXml = fs.existsSync(SITEMAP_PATH)
    ? fs.readFileSync(SITEMAP_PATH,"utf8")
    : "";

  const now = nowIST();

  const changed = new Set(updatedGames);
  changed.add("HOME");


  const urls = ORDER.map(id => {

    const date = changed.has(id)
      ? now
      : oldDate(oldXml, RESULT_SITEMAP_MAP[id]);

    return block(
      RESULT_SITEMAP_MAP[id],
      date,
      id === "HOME" ? "1.0" : "0.90"
    );

  }).join("\n");


  fs.writeFileSync(
    SITEMAP_PATH,
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
  );


  console.log(
    "Sitemap updated:",
    [...changed].join(", ")
  );
}


module.exports = {
  updateResultsSitemap
};