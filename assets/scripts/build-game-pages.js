const fs = require("node:fs");
const path = require("node:path");
const config = require("./game-config.js");

const root = process.cwd();
const templatePath = path.join(root, "assets", "templates", "game-page.html");
const previewDir = path.join(root, "dist-game-preview");
const pilotDir = path.join(root, "dist-game-pilot");
const template = fs.readFileSync(templatePath, "utf8");

const content = {
  SHD:{title:"Shillong Teer Result Today: Live FR SR & Previous 7 Days",description:"Check Shillong Teer result today, current FR SR publication status, previous 7 days, common numbers and recent statistics.",intro:"Check the current Shillong Teer FR and SR, publication status, recent results and history-based statistical references on one page."},
  KH:{title:"Khanapara Teer Result Today: Live FR SR & Previous 7 Days",description:"Check Khanapara Teer result today, current FR SR publication status, previous 7 days, common numbers and recent statistics.",intro:"Check the current Khanapara Teer FR and SR, publication status, recent results and history-based statistical references on one page."},
  JWD:{title:"Juwai Teer Result Today: Live FR SR & Previous 7 Days",description:"Check Juwai Teer result today, current FR SR publication status, previous 7 days, common numbers and recent statistics.",intro:"Check the current Juwai Teer FR and SR, publication status, recent results and history-based statistical references on one page."},
  SHM:{title:"Shillong Morning Teer Result Today: Live FR SR",description:"Check Shillong Morning Teer result today, publication status, previous 7 days, common numbers and recent statistics.",intro:"Check the current Shillong Morning Teer FR and SR, publication status, recent results and history-based statistical references on one page."},
  KHM:{title:"Khanapara Morning Teer Result Today: Live FR SR",description:"Check Khanapara Morning Teer result today, publication status, previous 7 days, common numbers and recent statistics.",intro:"Check the current Khanapara Morning Teer FR and SR, publication status, recent results and history-based statistical references on one page."},
  JWM:{title:"Juwai Morning Teer Result Today: Live FR SR",description:"Check Juwai Morning Teer result today, publication status, previous 7 days, common numbers and recent statistics.",intro:"Check the current Juwai Morning Teer FR and SR, publication status, recent results and history-based statistical references on one page."},
  SHN1:{title:"Shillong Night Teer Result Today: Live FR SR",description:"Check Shillong Night Teer result today, publication status, previous 7 days, common numbers and recent statistics.",intro:"Check the current Shillong Night Teer FR and SR, publication status, recent results and history-based statistical references on one page."},
  SHN2:{title:"Shillong Night Teer 2 Result Today: Live FR SR",description:"Check Shillong Night Teer 2 result today with midnight-safe SR handling, previous 7 days, common numbers and recent statistics.",intro:"Check Shillong Night Teer 2 FR and midnight SR using the correct business date, plus recent results and statistical references."}
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function schemaFor(id, game, copy) {
  const url = config.absoluteUrl(game.canonicalPath);
  const faqs = [
    { q: `When is the ${game.name} result updated?`, a: "The page checks the current polling policy and refreshes more frequently only around the configured FR or SR publication window." },
    { q: "What does XX mean?", a: "XX means that a valid two-digit result has not yet been published for that round." },
    { q: "Are common numbers guaranteed?", a: "No. They are statistical references calculated from recent records and do not guarantee any result." }
  ];
  return JSON.stringify({
    "@context":"https://schema.org",
    "@graph":[
      {"@type":"Organization","@id":"https://teeronline.com/#organization","name":"TeerOnline.com","url":"https://teeronline.com/","logo":{"@type":"ImageObject","url":"https://teeronline.com/assets/img/logo.webp"}},
      {"@type":"WebSite","@id":"https://teeronline.com/#website","url":"https://teeronline.com/","name":"TeerOnline.com","publisher":{"@id":"https://teeronline.com/#organization"}},
      {"@type":"WebPage","@id":`${url}#webpage`,"url":url,"name":copy.title,"description":copy.description,"inLanguage":"en-IN","isPartOf":{"@id":"https://teeronline.com/#website"},"breadcrumb":{"@id":`${url}#breadcrumb`}},
      {"@type":"BreadcrumbList","@id":`${url}#breadcrumb`,"itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://teeronline.com/"},{"@type":"ListItem","position":2,"name":`${game.name} Result Today`,"item":url}]},
      {"@type":"FAQPage","@id":`${url}#faq`,"mainEntity":faqs.map(x=>({"@type":"Question","name":x.q,"acceptedAnswer":{"@type":"Answer","text":x.a}}))},
      {"@type":"ItemList","@id":`${url}#sections`,"name":`${game.name} page sections`,"itemListElement":["Live result","Current publication status","Previous 7 days results","Common numbers","Statistics"].map((name,index)=>({"@type":"ListItem","position":index+1,"name":name,"url":url}))}
    ]
  });
}

function render(id, production = false) {
  const game = config.getGame(id);
  const copy = content[id];
  if (!game || !copy) throw new Error(`Unsupported game ID: ${id}`);
  const replacements = {
    GAME_ID:id,
    GAME_NAME:game.name,
    TITLE:copy.title,
    DESCRIPTION:copy.description,
    ROBOTS:production ? "index,follow,max-image-preview:large" : "noindex,nofollow",
    CANONICAL_URL:config.absoluteUrl(game.canonicalPath),
    H1:`${game.name} Result Today`,
    INTRO:copy.intro,
    SEO_TEXT:`This page is dedicated only to ${game.name}. It displays the latest available FR and SR, publication status, seven recent records and statistics calculated from this game’s own recent history.`
  };
  let html = template.replace("{{{SCHEMA_JSON}}}", schemaFor(id, game, copy));
  html = html.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => escapeHtml(replacements[key] ?? ""));
  return html;
}

function filenameFor(id) {
  const game = config.getGame(id);
  return game.canonicalPath === "/" ? "index.html" : `${game.canonicalPath.slice(1)}.html`;
}

function buildPreview() {
  fs.rmSync(previewDir,{recursive:true,force:true});
  fs.mkdirSync(previewDir,{recursive:true});
  for (const id of config.gameOrder) fs.writeFileSync(path.join(previewDir, filenameFor(id)), render(id, false));
  console.log(`Generated ${config.gameOrder.length} isolated preview pages in dist-game-preview/`);
}

function buildPilot(id) {
  if (id !== "JWD") throw new Error("Stage 5 permits only the JWD pilot.");
  fs.rmSync(pilotDir,{recursive:true,force:true});
  fs.mkdirSync(pilotDir,{recursive:true});
  fs.writeFileSync(path.join(pilotDir, filenameFor(id)), render(id, true));
  console.log(`Generated production pilot for ${id} in dist-game-pilot/`);
}

const pilotIndex = process.argv.indexOf("--pilot");
if (pilotIndex >= 0) buildPilot(String(process.argv[pilotIndex + 1] || "").toUpperCase());
else buildPreview();

module.exports = { render, filenameFor, buildPreview, buildPilot };
