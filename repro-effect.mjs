import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || '/data/data/com.termux/files/usr/bin/chromium-browser';
const base = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  console.log('=== FULL PAGE LOAD / ===');
  await page.goto(base + '/', { waitUntil: 'networkidle0', timeout: 30000 });
  await sleep(2500);

  // ---- CodeShowcase: if/else target switching + effect logs ----
  const showcase = await page.evaluate(() => {
    const section = document.querySelector('#compiler');
    const buttons = [...section.querySelectorAll('button[type="button"]')].map(b => b.textContent.trim());
    const preCount = section.querySelectorAll('pre').length;
    const shownText = section.querySelector('pre code') ? section.querySelector('pre code').textContent.slice(0, 40) : null;
    // which pre is visible (there should be exactly 1)
    const pres = section.querySelectorAll('pre');
    const visiblePres = [...pres].filter(p => p.offsetParent !== null).length;
    return { buttons, preCount, visiblePres, firstPreSnippet: shownText };
  });
  console.log('CodeShowcase initial:', JSON.stringify(showcase, null, 2));

  // Click "web" tab
  await page.evaluate(() => {
    const section = document.querySelector('#compiler');
    const btn = [...section.querySelectorAll('button[type="button"]')].find(b => b.textContent.trim() === 'about.js');
    if (btn) btn.click();
  });
  await sleep(800);
  const showcaseWeb = await page.evaluate(() => {
    const section = document.querySelector('#compiler');
    const pres = section.querySelectorAll('pre');
    const visible = [...pres].find(p => p.offsetParent !== null);
    return {
      visiblePres: [...pres].filter(p => p.offsetParent !== null).length,
      visibleSnippet: visible ? visible.textContent.slice(0, 40) : null,
      activeButton: [...section.querySelectorAll('button[type="button"]')].find(b => b.getAttribute('aria-pressed') === 'true' || (b.className.includes('bg-foreground') && b.textContent.trim() !== 'ssr.html'))?.textContent.trim() || null,
    };
  });
  console.log('CodeShowcase after click web:', JSON.stringify(showcaseWeb, null, 2));

  // ---- DevExperience: effect increments shown; for loop should grow ----
  const dev = await page.evaluate(() => {
    const section = document.querySelector('#dx');
    const terminal = section.querySelector('.panel-strong');
    const count = terminal.querySelectorAll('div.flex.items-center.gap-1\\.5 ~ div div, .panel-strong .font-mono > div').length;
    const lines = [...terminal.querySelectorAll('div')].filter(d => /^\$ npx|my-app|npm (install|run)|vesk dev/.test(d.textContent.trim())).length;
    // count lines inside terminal body
    const body = section.querySelector('.panel-strong > div:nth-child(2)');
    return { lineCount: body ? body.children.length : -1 };
  });
  console.log('DevExperience initial lineCount:', JSON.stringify(dev, null, 2));

  // wait for effect interval to tick (600ms)
  await sleep(2500);
  const dev2 = await page.evaluate(() => {
    const section = document.querySelector('#dx');
    const body = section.querySelector('.panel-strong > div:nth-child(2)');
    return { lineCount: body ? body.children.length : -1 };
  });
  console.log('DevExperience after 2.5s (effect should have advanced shown):', JSON.stringify(dev2, null, 2));

  console.log('\n--- CodeShowcase/DevExperience console logs ---');
  const interesting = logs.filter(l => l.includes('CodeShowcase'));
  console.log('CodeShowcase logs:', interesting.length ? interesting : '(none!)');
  const essentials = logs.filter(l => l.includes('[error]') || l.includes('[pageerror]'));
  console.log('errors:', essentials.length ? essentials : '(none)');
  console.log('total logs:', logs.length);

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });