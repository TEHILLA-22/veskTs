import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:3099';
const browser = await puppeteer.launch({ executablePath: '/data/data/com.termux/files/usr/bin/chromium-browser', headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 1000));
const result = await page.evaluate(() => {
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
  while (walker.nextNode()) {
    const c = walker.currentNode;
    out.push({ value: c.nodeValue, parent: c.parentElement ? c.parentElement.tagName.toLowerCase() + (c.parentElement.className ? '.' + String(c.parentElement.className).split(' ').join('.') : '') : 'none', html: c.parentElement ? c.parentElement.outerHTML.slice(0, 220) : '' });
  }
  return out;
});
const leftover = result.filter(c => /vsk/.test(c.value));
console.log('VSK MARKERS LEFT:', leftover.length);
for (const m of leftover) console.log('-', m.value, '@', m.parent, '\n   ', m.html.replace(/\n/g, ' '));
console.log('ALL COMMENT COUNT:', result.length);
await browser.close();
