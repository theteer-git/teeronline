'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const files = fs.readdirSync(ROOT).filter((name) => name.endsWith('.html'));
const issues = [];

for (const file of files) {
  if (file === 'pinterest-ac87f.html') continue;
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let count = 0;
  while ((match = re.exec(html))) {
    count += 1;
    let data;
    try {
      data = JSON.parse(match[1].trim());
    } catch (error) {
      issues.push(`${file} block ${count}: invalid JSON (${error.message})`);
      continue;
    }
    const nodes = data['@graph'] ? data['@graph'] : [data];
    for (const node of nodes) {
      const type = node['@type'];
      if (type === 'Article' && node.breadcrumb) {
        issues.push(`${file}: Article must not use breadcrumb (schema.org Article has no breadcrumb property)`);
      }
      if (type === 'Article' && String(node['@id'] || '').endsWith('#webpage')) {
        issues.push(`${file}: Article must not use a #webpage @id`);
      }
    }
  }
  if (!count) issues.push(`${file}: missing JSON-LD`);
}

const formula = fs.readFileSync(path.join(ROOT, 'teer-formula.html'), 'utf8');
if (!/"@type": "WebPage"/.test(formula) || /"@type": "Article"/.test(formula)) {
  issues.push('teer-formula.html graph page type must remain WebPage, not Article');
}

if (issues.length) {
  console.error('JSON-LD schema validation: FAIL');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('JSON-LD schema validation: PASS');
  console.log(`HTML files checked: ${files.length - 1}`);
  console.log('Article/breadcrumb isolation: PASS');
  console.log('teer-formula WebPage type: PASS');
}
