import puppeteer from 'puppeteer-core';
const C = process.env.CHROME_PATH || '/home/codespace/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const b = await puppeteer.launch({ executablePath: C, headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const p = await b.newPage();
const logs=[];
p.on('console', m=> logs.push(m.type()+':'+m.text().slice(0,150)));
await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise(r=>setTimeout(r, 3000));
// Examine the DOM around the if/else chain markers
const markerInfo = await p.evaluate(() => {
  // Find the section and look at comment nodes
  const section = document.querySelector('#compiler');
  if (!section) return { error: 'no section' };
  const comments = [];
  const walk = document.createTreeWalker(section, 8); // Comment node filter
  let n;
  while (n = walk.nextNode()) {
    const next = n.nextSibling;
    const info = {
      text: n.textContent,
      nextTag: next?.tagName || 'none',
      nextText: next?.textContent?.slice(0, 30) || 'none',
      nextClass: next?.getAttribute?.('class')?.slice(0, 30) || 'none',
    };
    comments.push(info);
  }
  return { comments, preCount: section.querySelectorAll('pre').length };
});
console.log(JSON.stringify(markerInfo, null, 2).slice(0,3000));
await b.close();
