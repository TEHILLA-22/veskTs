import puppeteer from 'puppeteer-core';
const C = process.env.CHROME_PATH || '/home/codespace/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const b = await puppeteer.launch({ executablePath: C, headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const p = await b.newPage();
const logs=[];
p.on('console', m=> logs.push(m.type()+':'+m.text().slice(0,150)));
await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise(r=>setTimeout(r, 3000));
logs.length=0;
const buttons = await p.$$('button');
for (const btn of buttons) {
  const txt = await (await btn.getProperty('textContent')).jsonValue();
  if (txt.trim() === 'about.js') { await btn.click(); break; }
}
await new Promise(r=>setTimeout(r, 800));
console.log('All logs after web click:', logs.join('\n').slice(0,2000));
const fullHtml = await p.evaluate(() => document.body.innerHTML.slice(0,10000));
console.log('Body HTML (first 10000):', fullHtml.slice(0,2000));
await p.screenshot({ path: '/tmp/web-full.png', fullPage: true });
await b.close();
