import puppeteer from 'puppeteer-core';

const CHROME = '/home/codespace/.cache/puppeteer/chrome/linux-152.0.7977.64/chrome-linux64/chrome';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent(`<div id="wrap"><a id="l" href="/x">link</a></div>`);
const result = await page.evaluate(() => {
  const out = { mouseenterDoc: 0, mouseenterLink: 0, mouseoverDoc: 0 };
  document.addEventListener('mouseenter', () => out.mouseenterDoc++);
  document.getElementById('l').addEventListener('mouseenter', () => out.mouseenterLink++);
  document.addEventListener('mouseover', () => out.mouseoverDoc++);
  return out;
});
const el = await page.$('#l');
await el.hover();
await new Promise(r => setTimeout(r, 200));
const counts = await page.evaluate(() => {
  const out = {};
  return out;
});
console.log('== after hover on link ==');
console.log(await page.evaluate(() => window.__o || 'no window state'));
await browser.close();