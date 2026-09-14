import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || '/data/data/com.termux/files/usr/bin/chromium-browser';
const base = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TERM_LINES = [
  '$ npx create-vesk@latest my-app',
  '$ npx create-vesk-native@latest my-app',
  '    my-app created successfully!',
  '    cd my-app',
  '    npm install',
  '    npm run dev',
  'vesk dev server at http://localhost:3000',
  'vesk dev: rebuilt in 11ms',
  '\u2192 web output in .vesk/',
];

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  console.log('=== 1) FULL PAGE LOAD / (hydration path) ===');
  await page.goto(base + '/', { waitUntil: 'networkidle0', timeout: 30000 });
  await sleep(400);

  // sample DevExperience terminal rows every 300ms for ~2.4s -> shown 0..4 should appear
  const samples = [];
  for (let i = 0; i < 8; i++) {
    const s = await page.evaluate((LINES) => {
      const section = document.querySelector('#dx');
      if (!section) return { found: false, rows: -1 };
      const body = section.querySelector('.panel-strong > div:nth-child(2)');
      const rows = [...body.querySelectorAll('div')].filter(d => LINES.some(l => d.textContent.includes(l)));
      return { found: true, rows: rows.length, texts: rows.map(r => r.textContent.trim().slice(0, 40)) };
    }, TERM_LINES);
    samples.push(s);
    await sleep(300);
  }
  console.log('DevExperience rows over time:', JSON.stringify(samples.map(s => s.rows), null));
  const sample4 = samples[4];
  console.log('sample[4] texts:', JSON.stringify(sample4.texts, null, 2));

  // CodeShowcase stage if/else (x/src: if i < stage => ✓ else ·) and done/… label
  const cs = await page.evaluate(() => {
    const section = document.querySelector('#compiler');
    const bar = section.querySelector('.flex.min-w-0.items-center.gap-3.border-t');
    const marks = [...bar.querySelectorAll('span')].map(s => s.textContent.trim().startsWith('\u2713') ? '\u2713' : s.textContent.trim().startsWith('\u00B7') ? '\u00B7' : s.textContent.trim());
    const endLabel = bar.querySelector('.ml-auto').textContent.trim();
    return { marks: marks.slice(0, 3), endLabel };
  });
  console.log('CodeShowcase stage marks:', JSON.stringify(cs, null, 2));

  // after 2.6s more the stage should advance (interval 1100ms)
  await sleep(2600);
  const cs2 = await page.evaluate(() => {
    const section = document.querySelector('#compiler');
    const bar = section.querySelector('.flex.min-w-0.items-center.gap-3.border-t');
    const marks = [...bar.querySelectorAll('span')].map(s => s.textContent.trim().startsWith('\u2713') ? '\u2713' : s.textContent.trim().startsWith('\u00B7') ? '\u00B7' : s.textContent.trim());
    const endLabel = bar.querySelector('.ml-auto').textContent.trim();
    return { marks: marks.slice(0, 3), endLabel };
  });
  console.log('CodeShowcase stage marks after 2.6s:', JSON.stringify(cs2, null, 2));

  console.log('\n--- hydration claim warnings (full load) ---');
  const warns = logs.filter(l => l.includes('[vesk-hydrate]') || l.includes('hydration'));
  console.log('hydration warn/err lines:', warns.length);
  warns.slice(0, 6).forEach(w => console.log(' ', w));

  // ---- now SPA-navigate to /docs and back, re-measure ----
  console.log('\n=== 2) AFTER SPA NAV (round trip) ===');
  await page.evaluate(() => document.querySelector('header a[href="/docs"]')?.click());
  await sleep(1800);
  await page.goBack({ waitUntil: 'networkidle0' });
  await sleep(400);
  const samples2 = [];
  for (let i = 0; i < 5; i++) {
    const s = await page.evaluate((LINES) => {
      const section = document.querySelector('#dx');
      if (!section) return { found: false, rows: -1 };
      const body = section.querySelector('.panel-strong > div:nth-child(2)');
      const rows = [...body.querySelectorAll('div')].filter(d => LINES.some(l => d.textContent.includes(l)));
      return { rows: rows.length };
    }, TERM_LINES);
    samples2.push(s.rows);
    await sleep(300);
  }
  console.log('DevExperience rows over time after SPA nav:', JSON.stringify(samples2));
  console.log('CodeShowcase logs total:', logs.filter(l => l.includes('[CodeShowcase]')).length);
  console.log('interval/effect errors:', logs.filter(l => l.includes('[error]') || l.includes('Uncaught')).length ? logs.filter(l => l.includes('[error]') || l.includes('Uncaught')) : '(none)');

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });