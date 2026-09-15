import puppeteer from 'puppeteer-core';

const CHROME = '/home/codespace/.cache/puppeteer/chrome/linux-152.0.7977.64/chrome-linux64/chrome';
const BASE = 'http://localhost:3000';
const routes = ['/compiler', '/native', '/features', '/docs', '/showcase', '/docs/getting-started', '/docs/components', '/docs/track-declarations', '/posts', '/blog', '/blog/hello-vesk', '/about', '/contact', '/api-docs', '/statements', '/examples', '/comparison'];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
const bad = [];
page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.request().method()} ${r.url()}`); });
page.on('pageerror', e => console.log('PAGEERROR: ' + e.message.slice(0, 150)));

await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 600));

for (const href of routes) {
  bad.length = 0;
  const sent = await page.evaluate((h) => {
    const a = [...document.querySelectorAll(`a[href="${h}"]`)][0];
    if (!a) return false;
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  }, href);
  await new Promise(r => setTimeout(r, 1800));
  const url = page.url();
  const bodyErr = await page.evaluate(() => document.body.innerText.slice(0, 120));
  const marker = sent ? (url.endsWith(href) ? 'nav-ok' : `url-mismatch(${url})`) : 'no-link';
  const hasBad = bad.length ? bad.map(b => `[${b}]`).join(' ') : '';
  console.log(`${href.padEnd(26)} ${marker.padEnd(14)} ${hasBad} ${bodyErr.replace(/\n/g, ' ').slice(0, 60)}`);
}
await browser.close();