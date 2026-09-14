import puppeteer from 'puppeteer-core';
const CHROME = process.env.CHROME_PATH || '/data/data/com.termux/files/usr/bin/chromium-browser';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(page, label) {
  const info = await page.evaluate(() => {
    const header = document.querySelector('header');
    if (!header) return { err: 'no header' };
    const btn = header.querySelector('button[aria-label]');
    const navs = header.querySelectorAll('nav');
    const svgInBtn = btn ? btn.querySelectorAll('svg').length : -1;
    const btnLabels = [...header.querySelectorAll('button')].map(b => ({ aria: b.getAttribute('aria-label'), svgs: b.querySelectorAll('svg').length }));
    // count sister header copies (whole page headers)
    const headers = [...document.querySelectorAll('header')].length;
    return { headers, navs: navs.length, btnAria: btn?.getAttribute('aria-label'), svgInBtn, btnLabels };
  });
  console.log(label, JSON.stringify(info));
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  const logs = [];
  page.on('console', (m) => { if (m.text().includes('[vesk-hydrate]')) logs.push(m.text().split('\n')[0]); });

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 30000 });
  await sleep(500);
  await probe(page, 'full-load header:');

  await page.evaluate(() => document.querySelector('nav a[href="/docs"]')?.click());
  await sleep(1500);
  await probe(page, 'after nav to /docs header:');
  await page.goBack({ waitUntil: 'networkidle0' });
  await sleep(800);
  await probe(page, 'after back home header:');

  console.log('hydration warn count:', logs.length);
  const counts = {};
  for (const l of logs) counts[l] = (counts[l] || 0) + 1;
  Object.entries(counts).slice(0, 10).forEach(([l, c]) => console.log(c, 'x', l));

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });