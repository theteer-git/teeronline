"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = process.cwd();
let failures = 0;
function check(label, condition) {
  console.log(`${label}: ${condition ? "PASS" : "FAIL"}`);
  if (!condition) failures += 1;
}
const sitemapIndex = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
const build = fs.readFileSync(path.join(root, "assets/scripts/build-pages-split.js"), "utf8");
const htmlFiles = fs.readdirSync(root).filter(name => name.endsWith(".html"));
const html = htmlFiles.map(name => fs.readFileSync(path.join(root, name), "utf8")).join("\n");
const required = [
  "https://teeronline.com/",
  "https://teeronline.com/khanapara-teer-results",
  "https://teeronline.com/juwai-teer-results",
  "https://teeronline.com/shillong-morning-teer-results",
  "https://teeronline.com/khanapara-morning-teer-results",
  "https://teeronline.com/juwai-morning-teer-results",
  "https://teeronline.com/shillong-night-teer-results",
  "https://teeronline.com/shillong-night-teer-2-results"
];
check("Dynamic results sitemap is referenced", sitemapIndex.includes("https://teeronline.com/sitemap-results.xml"));
check("Dynamic pages sitemap is referenced", sitemapIndex.includes("https://teeronline.com/sitemap-pages.xml"));
check("Public HTML includes all canonical result URLs", required.every(url => html.includes(`href="${url.replace("https://teeronline.com", "") || "/"}`) || html.includes(`content="${url}"`) || html.includes(`href="${url}"`)));
check("Public build omits common-numbers.html", !build.includes('copyFile("common-numbers.html")'));
check("Build redirects retired Common Numbers URL", build.includes('"/common-numbers / 301"'));
check("Build redirects obsolete Shillong result URL", build.includes('"/shillong-teer-results / 301"'));
check("Internal links exclude /shillong-teer-results", !/href=["']\/shillong-teer-results(?:["'/?#])/.test(html));
check("Internal links exclude /common-numbers", !/href=["']\/common-numbers(?:\.html)?(?:["'/?#])/.test(html));
if (failures) {
  console.error(`Stage 8 frontend SEO validation: FAIL (${failures})`);
  process.exit(1);
}
console.log("Stage 8 frontend SEO validation: PASS");
