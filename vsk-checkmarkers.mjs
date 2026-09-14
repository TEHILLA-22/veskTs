import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
const p = await b.newPage();
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));
const r = await p.evaluate(() => {
  const vsk = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
  let n;
  while ((n = w.nextNode())) if (n.data === 'vsk') vsk.push(n);
  let c = 0;
  const t = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
  while (t.nextNode()) c++;
  return { vskMarkersLeft: vsk.length, commentCount: c };
});
console.log(JSON.stringify(r));
await b.close();
