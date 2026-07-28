const fs=require('fs');
const path=require('path');
const pages=[
 ['dream-numbers.html','/dream-numbers','Teer Dream Numbers'],
 ['teer-formula.html','/teer-formula','Teer Formula'],
 ['about.html','/about','About TeerOnline'],
 ['contact.html','/contact','Contact TeerOnline'],
 ['privacy-policy.html','/privacy-policy','Privacy Policy'],
 ['terms-and-conditions.html','/terms-and-conditions','Terms and Conditions'],
 ['disclaimer.html','/disclaimer','Disclaimer'],
 ['404.html','/404','Page Not Found']
];
let failed=0;
function pass(ok,msg){console.log(`${ok?'PASS':'FAIL'}: ${msg}`);if(!ok)failed++;}
for(const [file,route,label] of pages){
 const html=fs.readFileSync(path.join(process.cwd(),file),'utf8');
 pass(/<title>[^<]{15,70}<\/title>/i.test(html),`${label} has a focused title`);
 const desc=(html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)||[])[1]||'';
 pass(desc.length>=70&&desc.length<=170,`${label} description length is useful — ${desc.length}`);
 pass(html.includes(`https://teeronline.com${route}`),`${label} uses extension-free canonical/schema URL`);
 pass(/task13e-support/.test(html),`${label} contains its unique support/trust section`);
 pass(/application\/ld\+json/.test(html),`${label} contains JSON-LD`);
 pass(!/<meta[^>]+name=["']keywords["']/i.test(html),`${label} has no obsolete meta keywords`);
}
const nf=fs.readFileSync('404.html','utf8');
pass(/name=["']robots["'][^>]+noindex,follow|content=["']noindex,follow["'][^>]+name=["']robots/i.test(nf),'404 is noindex,follow');
const dream=fs.readFileSync('dream-numbers.html','utf8');
pass(/cannot guarantee|not as verified forecasts/i.test(dream),'Dream Numbers clearly rejects guaranteed prediction claims');
const formula=fs.readFileSync('teer-formula.html','utf8');
pass(/do not prove|cannot predict|does not guarantee/i.test(formula),'Formula guide clearly separates calculation from prediction');
const pkg=require(path.join(process.cwd(),'package.json'));
pass(pkg.scripts&&pkg.scripts['gate:task13:batch-e']==='node assets/scripts/validate-task13-batch-e.js','Batch E command is registered');
if(failed){console.error(`TASK 13 BATCH E: FAIL (${failed})`);process.exit(1)}
console.log(JSON.stringify({task:13,batch:'E',supportingPages:8,legalPages:3,referenceGuides:2,notFoundNoindex:true,backendAffected:false},null,2));
console.log('TASK 13 BATCH E: PASS');
