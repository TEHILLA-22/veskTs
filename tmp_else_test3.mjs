import puppeteer from 'puppeteer-core';
const C = process.env.CHROME_PATH || '/home/codespace/.cache/puppeteer/chrome/linux-152.0.7977.54/chrome-linux64/chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const b = await puppeteer.launch({ executablePath: C, headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const p = await b.newPage();
await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise(r=>setTimeout(r, 3000));
const info = await p.evaluate(() => {
  const sec = document.querySelector('#compiler');
  if (!sec) return { error: 'no #compiler' };
  const pres = [...sec.querySelectorAll('pre')].map(pr => pr.textContent.slice(0,40));
  const buttons = [...sec.querySelectorAll('button')].map(b => b.textContent.trim());
  return { 
    id: sec.id, 
    className: sec.className,
    buttons, 
    preCount: [...sec.querySelectorAll('pre')].length,
    preContents: pres,
    childCount: sec.children.length,
    innerHTML: sec.innerHTML.slice(0,1000)
  };
});
console.log(JSON.stringify(info, null, 2).slice(0,2000));
await b.close();
