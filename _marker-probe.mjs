import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE || 'http://localhost:3099';
const PATH = process.env.PPATH || '/';
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/data/data/com.termux/files/usr/bin/chromium-browser';

const browser = await puppeteer.launch({
  executablePath: CHROMIUM_PATH,
  headless: 'shell',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
const errors = [];
const warns = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 300));
  else if (m.type() === 'warning') warns.push(m.text().slice(0, 400));
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));
page.on('requestfailed', (r) => errors.push('REQFAIL: ' + r.url().slice(0, 200)));

await page.goto(BASE + PATH, { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise((r) => setTimeout(r, 800));

const result = await page.evaluate(() => {
  const root = document.getElementById('root');
  const html = root ? root.innerHTML : document.body.innerHTML;
  const plain = [...html.matchAll(/<!--vsk-->/g)].map((m) => m.index);
  const claimed = [...html.matchAll(/<!--vsk:d[^>]*-->/g)].map((m) => m.index);
  const ctx = plain.map((idx) => {
    const s = Math.max(0, idx - 120);
    const e = Math.min(html.length, idx + 120);
    return html.slice(s, e).replace(/[\t\n\r]+/g, ' ');
  });
  return { plain: plain.length, claimed: claimed.length, ctx };
});

console.log('PATH:', PATH, '| plain markers remaining:', result.plain, '| claimed:', result.claimed);
result.ctx.forEach((c, i) => console.log(`\n[${i}] ${c}`));
const hydlog = await page.evaluate(() => window.__vskHydLog || []);
console.log('\nHYDROLOG lines:', hydlog.length);
hydlog.forEach((l, i) => console.log(String(i).padStart(3), l));
console.log('\nconsole errors:', errors.length);
errors.forEach((e) => console.log(' -', e));
console.log('\nconsole warnings:', warns.length);
warns.forEach((w) => console.log(' -', w.slice(0, 250).replace(/[\n\t]+/g, ' ')));

await browser.close();