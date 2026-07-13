"use strict";

const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");
const config = require("./game-config.js");

const root = process.cwd();
const sourcePage = path.join(root, "juwai-teer-results.html");
const commonPage = path.join(root, "common-numbers.html");

if (!fs.existsSync(sourcePage)) throw new Error("Missing Juwai unified source page.");
if (!fs.existsSync(commonPage)) throw new Error("Missing common-numbers.html.");

const sourceHtml = fs.readFileSync(sourcePage, "utf8");
const commonHtml = fs.readFileSync(commonPage, "utf8");
const common$ = cheerio.load(commonHtml, { decodeEntities: false });

const outputFiles = {
  SHD: "index.html",
  KH: "khanapara-teer-results.html",
  JWD: "juwai-teer-results.html",
  SHM: "shillong-morning-teer-results.html",
  KHM: "khanapara-morning-teer-results.html",
  JWM: "juwai-morning-teer-results.html",
  SHN1: "shillong-night-teer-results.html",
  SHN2: "shillong-night-teer-2-results.html"
};

function clock(value) {
  const [hourText, minute] = String(value).split(":");
  const hour = Number(hourText);
  const period = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minute} ${period}`;
}

function canonicalPath(gameId) {
  if (gameId === "SHD") return "/";
  return `/${outputFiles[gameId].replace(/\.html$/, "")}`;
}

function buildNavigation($, currentId) {
  const nav = $("nav.nav-links");
  nav.find("a").remove();
  const links = [
    { label: "Home", path: "/" },
    ...config.gameOrder.map(gameId => ({
      label: config.games[gameId].navLabel,
      path: canonicalPath(gameId),
      gameId
    })),
    { label: "Dream Numbers", path: "/dream-numbers" },
    { label: "Teer Formula", path: "/teer-formula" }
  ];
  const toggleHtml = nav.find("button.dark-toggle").first().toString();
  nav.find("button.dark-toggle").remove();
  for (const link of links) {
    const anchor = $("<a></a>").attr("href", link.path).text(link.label);
    if (link.gameId === currentId) anchor.attr("aria-current", "page");
    nav.append(anchor);
  }
  if (toggleHtml) nav.append(toggleHtml);
}

for (const gameId of config.gameOrder) {
  const game = config.games[gameId];
  const prefix = gameId.toLowerCase();
  const canonical = `https://teeronline.com${canonicalPath(gameId)}`;
  const $ = cheerio.load(sourceHtml, { decodeEntities: false });

  $("html").attr("lang", "en-IN");
  $("body").attr("data-game-id", gameId);
  $("title").text(`${game.name} Result Today Live | FR SR, Common Numbers & Statistics`);
  $('meta[name="description"]').attr("content", `Check ${game.name} result today live with FR and SR publication time, previous 7 results, common numbers and complete statistics.`);
  $('link[rel="canonical"]').attr("href", canonical);
  $('meta[property="og:url"]').attr("content", canonical);
  $('meta[property="og:title"]').attr("content", `${game.name} Result Today Live`);
  $('meta[property="og:description"]').attr("content", `Live ${game.name} FR SR result, previous 7 results, common numbers and complete statistics.`);
  $('meta[name="twitter:title"]').attr("content", `${game.name} Result Today Live`);
  $('meta[name="twitter:description"]').attr("content", `Live ${game.name} FR SR result, previous 7 results, common numbers and complete statistics.`);
  $('link[href="./assets/css/jwd-unified-page.css"]').attr("href", "/assets/css/game-unified-page.css");

  const structured = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${game.name} Result Today`,
    url: canonical,
    description: `Live ${game.name} FR SR result with previous results, common numbers and statistics.`
  };
  $('script[type="application/ld+json"]').first().text(JSON.stringify(structured));

  buildNavigation($, gameId);

  $("section.hero h1").html(`<strong>${game.name} Result Today</strong>`);
  $("section.hero p").text(`Live ${game.name} FR and SR result, previous seven results, common numbers and complete statistical analysis on one page.`);
  $("#live_result").attr("aria-label", `${game.name} live result`);
  $("section.game-row").attr("id", `result-${gameId}`);
  $("article.result-card").attr("aria-labelledby", `title-${gameId}`);
  $("h2.card-title").attr("id", `title-${gameId}`).text(`${game.name} Results`);

  const idMap = {
    "jwd-date": `${prefix}-date`,
    "jwd-fr-time": `${prefix}-fr-time`,
    "jwd-sr-time": `${prefix}-sr-time`,
    "jwd-fr": `${prefix}-fr`,
    "jwd-sr": `${prefix}-sr`,
    "jwd-fr-badge": `${prefix}-fr-badge`,
    "jwd-sr-badge": `${prefix}-sr-badge`,
    "jwd-status": `${prefix}-status`,
    "jwd-refresh": `${prefix}-refresh`,
    "jwd-history": `${prefix}-history`,
    "jwd-common-card": `${prefix}-common-card`
  };
  for (const [oldId, newId] of Object.entries(idMap)) $(`#${oldId}`).attr("id", newId);

  $(`#${prefix}-fr-time`).text(`🏹 FR: ${clock(game.rounds.fr)}`);
  $(`#${prefix}-sr-time`).text(`🎯 SR: ${clock(game.rounds.sr)}`);
  $(`#${prefix}-fr-badge`).text(clock(game.rounds.fr));
  $(`#${prefix}-sr-badge`).text(clock(game.rounds.sr));

  $("a.prev-page-link")
    .attr("href", game.previousResultsPath)
    .attr("aria-label", `View full previous results of ${game.name}`);
  $("aside.game-history-card")
    .attr("aria-label", `Previous 7 results of ${game.name}`)
    .find("h3.history-title")
    .text(`📅 Previous 7 Results of ${game.name}`);

  $("#common_numbers").attr("aria-label", `${game.name} common numbers and statistics`);
  const commonCard = common$(`article.game-card[data-game="${gameId}"]`).first();
  if (!commonCard.length) throw new Error(`Missing common-number card for ${gameId}.`);
  $(`#${prefix}-common-card`).html(common$.html(commonCard));

  const support = $("section.supporting-content");
  if (support.length) {
    support.find("h2").first().text(`About ${game.name} Results and Statistics`);
    support.find("p").first().text(`This page combines the current ${game.name} result, the previous seven completed results and the complete common-number and statistics panel. Statistical references are historical information and are not guarantees.`);
    support.find("p").eq(1).html(`<strong>Where can I view older ${game.name} results?</strong><br><a href="${game.previousResultsPath}">Open the unchanged ${game.name} previous-results archive.</a>`);
    support.find("p").eq(2).html(`<strong>How frequently is the live result checked?</strong><br>The page follows the current ${game.name} polling plan and increases checks around the active result window.`);
  }

  $("script[src*='jwd-unified-page'], script[src*='game-unified-page'], script[src*='game-config.js']").remove();
  $("body").append('<script src="/assets/scripts/game-config.js" defer></script><script src="/assets/scripts/game-unified-page.js" defer></script>');

  fs.writeFileSync(path.join(root, outputFiles[gameId]), $.html(), "utf8");
}

fs.rmSync(path.join(root, "shillong-teer-results.html"), { force: true });

console.log(`Generated ${config.gameOrder.length} unified game pages.`);
console.log("SHD generated as index.html; obsolete shillong-teer-results.html removed.");
