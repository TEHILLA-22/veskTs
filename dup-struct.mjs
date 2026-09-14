import puppeteer from 'puppeteer-core';
const C = process.env.CHROME_PATH || '/data/data/com.termux/files/usr/bin/chromium-browser';
const BASE = process.env.BASE || 'http://localhost:3000';
const b = await puppeteer.launch({ executablePath: C, headless: true,
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const p = await b.newPage();
await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));
const A = await p.evaluate(() => {
  const navs = document.querySelectorAll('nav');
  const out = { navCount: navs.length, navDepths: [], lists: [], dups: [] };
  navs.forEach((nav, i) => {
    let d = 0, n = nav; while (n.parentElement) { d++; n = n.parentElement; }
    out.navDepths.push(`nav#${i} depth=${d}  ${nav.className.slice(0,60)}`);
    const uls = nav.querySelectorAll('ul');
    out.lists.push(`nav#${i}: ${uls.length} ul, ${nav.querySelectorAll('li').length} li, ${nav.querySelectorAll('a').length} a`);
  });
  // per-leaf-text duplication inside navs
  const t = new Map();
  navs.forEach(nav => nav.querySelectorAll('a, li, span').forEach(el => {
    const tx = (el.textContent||'').trim();
    if (tx && tx.length > 2 && el.children.length === 0) t.set(tx, (t.get(tx)||0)+1);
  }));
  out.navTexts = [...t.entries()].filter(([,n]) => n > 1).sort((a,b)=>b[1]-a[1])
    .slice(0,16).map(([x,n]) => `${n}x  ${x.slice(0,70)}`);
  // where do nav links sit relative to main content (dup-render = links after main?)
  out.afterMain = [];
  const main = document.querySelector('main, #root > *');
  [...document.querySelectorAll('nav')].forEach(nav => {
    if (main && nav.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING) {
      out.afterMain.push('nav AFTER first main-ish node');
    }
  });
  // total leaf text node count inside body (each-leaf count → dup if navs repeat whole subtrees)
  const seen = new Map();
  document.querySelectorAll('body *').forEach(el => {
    if (el.children.length === 0) { const tx=(el.textContent||'').trim(); if (tx && tx.length>2) seen.set(tx,(seen.get(tx)||0)+1); }
  });
  out.bodyTexts = [...seen.entries()].filter(([,n]) => n > 1).sort((a,b)=>b[1]-a[1]).slice(0,20)
    .map(([x,n]) => `${n}x  ${x.slice(0,70)}`);
  return out;
});
console.log('nav count in client DOM:', A.navCount);
A.navDepths.forEach(l => console.log('  ' + l));
A.lists.forEach(l => console.log('  ' + l));
console.log('nav-internal duplicated leaf texts:');
(A.navTexts||[]).forEach(l => console.log('  ' + l));
console.log('nav-after-main (whole-subtree dup order):', A.afterMain.join(', ') || '(none)');
console.log('=== BODY duplicated leaf texts (whole page):');
(A.bodyTexts||[]).forEach(l => console.log('  ' + l));
await b.close();
