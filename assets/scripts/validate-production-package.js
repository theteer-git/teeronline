"use strict";
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const failures=[];
const js=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(file.endsWith('.js'))js.push(file);}}
walk('assets/scripts'); js.push('sw.js');
for(const file of js){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)failures.push(`${file}: syntax error\n${r.stderr}`);}
for(const file of fs.readdirSync('.').filter(f=>f.endsWith('.html'))){const html=fs.readFileSync(file,'utf8');const htmlDocs=(html.match(/<html\b/gi)||[]).length;const canonicals=(html.match(/rel=["']canonical["']/gi)||[]).length;const h1s=(html.match(/<h1\b/gi)||[]).length;if(htmlDocs!==1)failures.push(`${file}: expected one HTML document, found ${htmlDocs}`);if(canonicals>1)failures.push(`${file}: duplicate canonical tags (${canonicals})`);if(h1s>1)failures.push(`${file}: duplicate H1 tags (${h1s})`);}
const sw=fs.readFileSync('sw.js','utf8');
for(const asset of ['/assets/css/game-unified-page.css','/assets/css/task4b-seo.css','/assets/css/task13-homepage.css','/assets/img/logo.webp']){if(!fs.existsSync(asset.slice(1)))failures.push(`sw.js precache asset missing: ${asset}`);}
if(sw.includes('/assets/css/styles.css'))failures.push('sw.js references missing /assets/css/styles.css');
if(!sw.includes('x-teeronline-stale'))failures.push('sw.js lacks last-known-result marker');
if(failures.length){console.error(failures.join('\n'));process.exit(1);}console.log(`Production package validation passed (${js.length} JavaScript files).`);
