import puppeteer from 'puppeteer-core';
const CHROME = process.env.CHROME_PATH || '/data/data/com.termux/files/usr/bin/chromium-browser';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 120)}`));

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // capture SSR html already present (before JS effects settle? hard w/ domcontentloaded)
  await sleep(1200);
  const btn = await page.evaluate(() => {
    const b = document.querySelector('header button[aria-label]');
    return {
      aria: b.getAttribute('aria-label'),
      html: b.outerHTML.slice(0, 1200),
    };
  });
  console.log('=== button after hydration ===');
  console.log(btn.aria);
  console.log(btn.html);

  // check for data-vsk-claimed markers and duplicate tree copies
  const markers = await page.evaluate(() => ({
    claimed: document.querySelectorAll('[data-vsk-claimed]').length,
    claimMissedSentinel: document.querySelectorAll('[data-vsk-walker-newly]').length,
    styleSpans: document.querySelectorAll('span[style*="display:contents"]').length,
  }));
  console.log('=== markers ===', JSON.stringify(markers));

  // now click toggle and observe
  await page.evaluate(() => document.querySelector('header button[aria-label]').click());
  await sleep(400);
  const afterClick = await page.evaluate(() => {
    const b = document.querySelector('header button[aria-label]');
    return {
      aria: b.getAttribute('aria-label'),
      svgs: b.querySelectorAll('svg').length,
      cls: b.querySelector('svg') ? b.querySelector('svg').getAttribute('class') : null,
      html: b.outerHTML.slice(0, 400),
    };
  });
  console.log('=== after toggle click ===', JSON.stringify(afterClick));

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });