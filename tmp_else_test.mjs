import puppeteer from 'puppeteer-core';
const C = process.env.CHROME_PATH || '/home/codespace/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const b = await puppeteer.launch({ executablePath: C, headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const p = await b.newPage();
const logs=[];
p.on('console', m=> logs.push(m.type()+':'+m.text().slice(0,150)));
await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise(r=>setTimeout(r, 3000));
console.log('Initial CodeShowcase logs:', logs.filter(l=>l.includes('CodeShowcase')||l.includes('claim')).join('\n').slice(0,500));
logs.length=0;
const buttons = await p.$$('button');
for (const btn of buttons) {
  const txt = await (await btn.getProperty('textContent')).jsonValue();
  if (txt.trim() === 'about.js') { await btn.click(); break; }
}
await new Promise(r=>setTimeout(r, 800));
console.log('After web click:', logs.filter(l=>l.includes('CodeShowcase')||l.includes('claim')).join('\n').slice(0,500));
const webContent = await p.evaluate(() => {
  const sec = document.querySelector('#compiler section');
  return sec ? sec.innerHTML.slice(0,500) : 'no section';
});
console.log('Web branch HTML (first 500):', webContent.slice(0,500));
await p.screenshot({ path: '/tmp/web-click.png', fullPage: false });
logs.length=0;
const natButtons = await p.$$('button');
for (const btn of natButtons) {
  const txt = await (await btn.getProperty('textContent')).jsonValue();
  if (txt.trim() === 'About.kt') { await btn.click(); break; }
}
await new Promise(r=>setTimeout(r, 800));
const nativeContent = await p.evaluate(() => {
  const sec = document.querySelector('#compiler section');
  return sec ? sec.innerHTML.slice(0,500) : 'no section';
});
console.log('Native branch HTML (first 500):', nativeContent.slice(0,500));
await b.close();
