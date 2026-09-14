import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || '/data/data/com.termux/files/usr/bin/chromium-browser';
const base = 'http://localhost:3000';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    dumpio: false,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  async function nav(path, title) {
    console.log(`\n=== ${title}: ${path} ===`);
    await page.goto(base + path, { waitUntil: 'networkidle0', timeout: 30000 }).catch(e => console.log('goto err', e.message));
    await sleep(1500);
    const result = await page.evaluate(() => {
      const btn = document.querySelector('header button[type="button"]');
      return {
        btnExists: !!btn,
        btnAriaBefore: btn ? btn.getAttribute('aria-label') : null,
        btnIconBefore: btn ? btn.innerHTML.slice(0, 60) : null,
        mobileNavBefore: !!document.querySelector('header nav.border-t'),
        xIcons: document.querySelectorAll('header button svg').length,
      };
    });
    console.log('before click:', JSON.stringify(result, null, 2));

    // click the toggle button
    await page.evaluate(() => {
      const btn = document.querySelector('header button[type="button"]');
      btn && btn.click();
    });
    await sleep(600);

    const after = await page.evaluate(() => {
      const btn = document.querySelector('header button[type="button"]');
      return {
        btnAriaAfter: btn ? btn.getAttribute('aria-label') : null,
        mobileNavAfter: !!document.querySelector('header nav.border-t'),
        mobileNavLinks: document.querySelectorAll('header nav.border-t a').length,
        btnIconAfter: btn ? btn.innerHTML.slice(0, 60) : null,
      };
    });
    console.log('after click:', JSON.stringify(after, null, 2));

    // click again to close
    await page.evaluate(() => {
      const btn = document.querySelector('header button[type="button"]');
      btn && btn.click();
    });
    await sleep(600);
    const closed = await page.evaluate(() => ({
      mobileNavClosed: !document.querySelector('header nav.border-t'),
      btnIconClosed: (document.querySelector('header button[type="button"]') || {}).innerHTML ? document.querySelector('header button[type="button"]').innerHTML.slice(0, 60) : null,
    }));
    console.log('after close:', JSON.stringify(closed, null, 2));
    return { result, after, closed };
  }

  await nav('/', 'FULL PAGE LOAD');

  // Now SPA-navigate away and back? Actually test navigating to another page then back.
  console.log('\n=== SPA CHECK (click a desktop nav link after SPA nav back) ===');
  // go to /docs via Link
  await page.evaluate(() => {
    const link = [...document.querySelectorAll('a[href="/docs"]')].find(a => a.offsetParent !== null);
    if (link) link.click();
  });
  await sleep(1800);
  console.log('navigated to /docs; url =', await page.url());
  await page.goBack();
  await sleep(1800);
  console.log('back at root; url =', await page.url());

  const afterNav = await page.evaluate(() => {
    const btn = document.querySelector('header button[type="button"]');
    if (!btn) return { btnExists: false };
    btn.click();
    // synchronous snapshot of what clicking does
    return { btnExists: true };
  });
  await sleep(600);
  const spAafter = await page.evaluate(() => ({
    mobileNavAfterSpa: !!document.querySelector('header nav.border-t'),
  }));
  console.log('After SPA nav + click — mobile nav open:', JSON.stringify(spAafter, null, 2));

  // dump console
  console.log('\n--- console log (last 25) ---');
  logs.slice(-25).forEach(l => console.log(l));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });