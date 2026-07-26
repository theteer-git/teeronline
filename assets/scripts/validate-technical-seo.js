"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = process.cwd();
const origin = "https://teeronline.com";
const excluded = new Set(["pinterest-ac87f.html"]);
const files = fs.readdirSync(root).filter(n => n.endsWith('.html') && !excluded.has(n)).sort();
let failures = 0;
const titles = new Map(), descriptions = new Map();
const decode = s => s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&ndash;/g,'–').replace(/&mdash;/g,'—').replace(/&rsquo;/g,'’');
const pick = (html,re) => { const m=html.match(re); return m ? decode(m[1].trim()) : ''; };
function check(label, ok, details=''){ console.log(`${ok?'PASS':'FAIL'}: ${label}${details?` — ${details}`:''}`); if(!ok) failures++; }
function remember(map,value,file){ if(!value)return; const a=map.get(value)||[]; a.push(file); map.set(value,a); }
for(const file of files){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  const titleMatches=[...html.matchAll(/<title>([\s\S]*?)<\/title>/gi)];
  const title=titleMatches[0]?decode(titleMatches[0][1].trim()):'';
  const descMatches=[...html.matchAll(/<meta\s+content="([^"]*)"\s+name="description"\s*\/>/gi)];
  const description=descMatches[0]?decode(descMatches[0][1].trim()):'';
  const robots=pick(html,/<meta\s+content="([^"]*)"\s+name="robots"\s*\/>/i);
  const canonical=pick(html,/<link\s+href="([^"]*)"\s+rel="canonical"\s*\/>/i);
  const h1Count=(html.match(/<h1\b/gi)||[]).length;
  const is404=file==='404.html';
  check(`${file}: one title`,titleMatches.length===1);
  check(`${file}: useful title length`,title.length>=20&&title.length<=65,`${title.length} chars`);
  check(`${file}: one meta description`,descMatches.length===1);
  check(`${file}: useful description length`,description.length>=70&&description.length<=170,`${description.length} chars`);
  check(`${file}: one H1`,h1Count===1,`${h1Count} found`);
  check(`${file}: robots directive`,is404?/noindex/i.test(robots):/index/i.test(robots)&&!/noindex/i.test(robots));
  check(`${file}: canonical present`,/^https:\/\/teeronline\.com\//.test(canonical));
  if(!is404){ const expected=file==='index.html'?'/':`/${file.replace(/\.html$/,'')}`; check(`${file}: canonical path`,canonical===origin+expected,canonical); }
  const ogTitle=pick(html,/<meta\s+content="([^"]*)"\s+property="og:title"\s*\/>/i);
  const ogDescription=pick(html,/<meta\s+content="([^"]*)"\s+property="og:description"\s*\/>/i);
  const ogUrl=pick(html,/<meta\s+content="([^"]*)"\s+property="og:url"\s*\/>/i);
  if(!is404){ check(`${file}: Open Graph title matches`,ogTitle===title); check(`${file}: Open Graph description matches`,ogDescription===description); check(`${file}: Open Graph URL matches canonical`,ogUrl===canonical); }
  const scripts=[...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  let valid=scripts.length>0; for(const s of scripts){ try{JSON.parse(s[1])}catch{valid=false} }
  check(`${file}: JSON-LD present`,scripts.length>=1); check(`${file}: JSON-LD parses`,valid);
  remember(titles,title,file); remember(descriptions,description,file);
}
for(const [v,owners] of titles) check(`Unique title: ${v}`,owners.length===1,owners.join(', '));
for(const [,owners] of descriptions) check('Unique description',owners.length===1,owners.join(', '));
const redirects=fs.readFileSync(path.join(root,'_redirects'),'utf8');
check('Legacy /results does not point to missing /latest',!/^\/results\s+\/latest\b/m.test(redirects));
check('Legacy Shillong URL redirects to homepage',/^\/shillong-teer-results\s+\/\s+301$/m.test(redirects));
check('Retired common-numbers URL redirects to homepage',/^\/common-numbers\s+\/\s+301$/m.test(redirects));
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
check('Sitemap index references pages sitemap',sitemap.includes(`${origin}/sitemap-pages.xml`));
check('Sitemap index references results sitemap',sitemap.includes(`${origin}/sitemap-results.xml`));
if(failures){ console.error(`Technical SEO validation: FAIL (${failures})`); process.exit(1); }
console.log(`Technical SEO validation: PASS (${files.length} public HTML files checked)`);
