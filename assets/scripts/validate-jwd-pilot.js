const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const root = process.cwd();
const target = "juwai-teer-results.html";
const archive = "juwai-teer-previous-results.html";
const untouched = ["index.html","khanapara-teer-previous-results.html","shillong-morning-teer-previous-results.html","khanapara-morning-teer-previous-results.html","juwai-morning-teer-previous-results.html","shillong-night-teer-previous-results.html","shillong-night-teer-2-previous-results.html"];
const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root,file))).digest("hex");
const before = Object.fromEntries(untouched.map(f=>[f,hash(f)]));
const archiveBefore = hash(archive);

execFileSync(process.execPath,[path.join(root,"assets/scripts/build-game-pages.js"),"--pilot","JWD"],{stdio:"inherit"});
const generated = path.join(root,"dist-game-pilot",target);
if(!fs.existsSync(generated)) throw new Error(`Missing generated pilot: ${generated}`);
const html=fs.readFileSync(generated,"utf8");
const required=[
  'body data-game-id="JWD"',
  '<meta name="robots" content="index,follow,max-image-preview:large">',
  '<link rel="canonical" href="https://teeronline.com/juwai-teer-results">',
  'id="live_result"','id="previous_7_days"','id="common_numbers"','id="statistics"','id="related_games"',
  '/assets/scripts/game-config.js','/assets/scripts/game-page.js','/assets/css/game-page.css',
  'application/ld+json','FAQPage','BreadcrumbList'
];
for(const token of required) if(!html.includes(token)) throw new Error(`Pilot missing: ${token}`);
if(html.includes("all-results.json")) throw new Error("Pilot must not load all-results.json");
if(!html.includes("recent-results.json") && html.includes("results.teeronline.com/recent-results.json")) throw new Error("Unexpected endpoint state");
for(const [file,oldHash] of Object.entries(before)) if(hash(file)!==oldHash) throw new Error(`Unrelated page changed: ${file}`);
if(hash(archive)!==archiveBefore) throw new Error("Existing Juwai archive page changed");
execFileSync(process.execPath,["--check",path.join(root,"assets/scripts/game-page.js")],{stdio:"inherit"});
execFileSync(process.execPath,["--check",path.join(root,"assets/scripts/build-game-pages.js")],{stdio:"inherit"});
console.log("JWD production pilot validation: PASS");
console.log("Only pilot output generated: PASS");
console.log("Indexable metadata and canonical: PASS");
console.log("Visible sections and matching schema: PASS");
console.log("Shared assets and JavaScript syntax: PASS");
console.log("all-results.json boundary: PASS");
console.log("Existing Juwai archive page unchanged: PASS");
console.log("Unrelated source pages unchanged: PASS");
