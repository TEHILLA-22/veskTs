import { startProdServer } from '@vesk/adapter/src/index';
import puppeteer from 'puppeteer-core';

const left = await import('path');
const P = left.default || left;
const outDir = P.resolve('/root/vesk/test-app/.vesk/hydration-test');
const PORT = 3099;
const BASE = `http://localhost:${PORT}`;

const httpServer = await startProdServer(outDir, { port: PORT });
await new Promise(r => setTimeout(r, 500));

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  executablePath: process.env.CHROMIUM_PATH || '/data/data/com.termux/files/usr/bin/chromium-browser',
});

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', m => errors.push('[' + m.type() + '] ' + m.text()));
  await page.goto(BASE, { waitUntil: 'networkidle0' });

  const before = await page.evaluate(() => {
    const btn = document.querySelector('button');
    return {
      btnHTML: btn ? btn.outerHTML.slice(0, 120) : null,
      ps: Array.from(document.querySelectorAll('main p')).map(p => p.textContent.trim()),
      bodyHasMarker: document.body.innerHTML.includes('<!--vsk-->'),
      markerCount: (() => {
        const walker = document.createTreeWalker(document.body, 128, { acceptNode(n) { return n.textContent === 'vsk' ? 1 : 2 } });
        let c = 0; while (walker.nextNode()) c++;
        return c;
      })(),
    };
  });
  console.log('BEFORE:', JSON.stringify(before, null, 2));

  await page.click('button');
  await new Promise(r => setTimeout(r, 200));
  const after = await page.evaluate(() => Array.from(document.querySelectorAll('main p')).map(p => p.textContent.trim()));
  console.log('AFTER one click:', JSON.stringify(after));

  console.log('CONSOLE+ERRORS:', JSON.stringify(errors, null, 1));
} finally {
  await browser.close();
  httpServer.close();
}