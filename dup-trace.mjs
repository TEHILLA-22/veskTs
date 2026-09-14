import puppeteer from 'puppeteer-core';
const C = process.env.CHROME_PATH || '/data/data/com.termux/files/usr/bin/chromium-browser';
const BASE = process.env.BASE || 'http://localhost:3000';
const b = await puppeteer.launch({ executablePath: C, headless: true,
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push('page: ' + e.message));
await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise(r => setTimeout(r, 3500));
const A = await p.evaluate(() => {
  const out = {};
  const counts = new Map();
  document.querySelectorAll('*').forEach(el => {
    const k = el.outerHTML;
    counts.set(k, (counts.get(k)||0)+1);
  });
  const dups = [...counts.entries()].filter(([,n]) => n > 1).sort((a,b)=>b[1]-a[1]).slice(0,10);
  out.pair = dups.find(([h,]) => /<a /.test(h) || /Get Started|Vesk Native|understand|write/.test(h));
  // for the first duplicated block, capture WHO its 2 siblings+parent are
  if (out.pair) {
    out.structure = (() => {
      const h = out.pair[0];
      const el = [...document.querySelectorAll('*')].find(e => e.outerHTML === h);
      const parent = el ? el.parentElement : null;
      const res = {
        thisIndex: el ? [...parent.children].indexOf(el) : -1,
        parentTag: parent ? parent.tagName : null,
        parentOuter: parent ? parent.outerHTML.slice(0,300) : null,
        siblings: parent ? [...parent.children].map((c,i) => `${i}:<${c.tagName}${c.id? '#'+c.id : ''}>`).join(' ') : null,
        dupIsDirectSiblingOfTwins: !!parent && [...parent.children].filter(c => c.outerHTML === h).length >= 2,
      };
      return res;
    })();
  }
  out.claimed = {};
  document.querySelectorAll('[data-vsk-claimed], [data-vsk-marker], [data-vsk-hold]').forEach(el => {
    const k = (el.getAttribute('data-vsk-claimed')||el.getAttribute('data-vsk-marker')||el.getAttribute('data-vsk-hold')||'').slice(0,8);
    out.claimed[k] = (out.claimed[k]||0)+1;
  });
  // focus first dup that's a nav label
  const labels = new Map();
  document.querySelectorAll('a').forEach(a => {
    const tx = (a.textContent||'').trim();
    if (tx) labels.set(tx, (labels.get(tx)||0)+1);
  });
  out.anchorTexts = [...labels.entries()].filter(([,n]) => n>1).sort((a,b)=>b[1]-a[1]).slice(0,14);
  const m = new Map();
  document.querySelectorAll('*').forEach(el => { if (!el.children.length) { const tx=(el.textContent||'').trim(); if (tx && tx.length>2) m.set(tx,(m.get(tx)||0)+1); } });
  out.leafTexts = [...m.entries()].filter(([,n]) => n>1).sort((a,b)=>b[1]-a[1]).slice(0,14);
  return out;
});
console.log('=== first duplicate block & its structure:');
if (A.pair) {
  console.log('  N=' + A.pair[1] + '  block: ' + (A.pair[0].replace(/\s+/g,' ').slice(0,120)));
  console.log('  ' + JSON.stringify(A.structure, null, 1));
} else console.log('  (no <a>-bearing duplicate found on /)');
console.log('=== duplicated anchor texts:', (A.anchorTexts||[]).length ? A.anchorTexts.map(([x,n])=>`${n}x ${x.slice(0,40)}`).join(' | ') : '(none)');
console.log('=== dup leaf texts (a 2nd time if still active):');
(A.leafTexts||[]).forEach(l => console.log('  ' + l[0] + '  x' + l[1]));
console.log('=== claimed/marker counts:', JSON.stringify(A.claimed));
console.log('=== pageerrors:', errs.join(' | ') || '(none)');
await b.close();
