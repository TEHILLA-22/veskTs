import puppeteer from 'puppeteer-core';
const CHROME = process.env.CHROME_PATH || '/data/data/com.termux/files/usr/bin/chromium-browser';
const BASE = process.env.BASE || 'http://localhost:3000';
const b = await puppeteer.launch({ executablePath: CHROME, headless: true,
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push('page: ' + e.message));
p.on('console', m => { if (['error','warning'].includes(m.type())) errs.push('console['+m.type()+']: ' + m.text()); });
// use domcontentloaded, NOT networkidle0 (streaming SSR + HMR ws keeps it from settling under Termux chromium)
await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));
const A = await p.evaluate(() => {
  const out = { dups: [], dupCount: 0, texts: [], markers: {} };
  const counts = new Map();
  document.querySelectorAll('*').forEach(el => {
    const k = el.outerHTML;
    counts.set(k, (counts.get(k)||0)+1);
  });
  const dups = [...counts.entries()].filter(([,n]) => n>1).sort((a,b)=>b[1]-a[1]);
  out.dupCount = dups.length;
  out.dups = dups.slice(0,14).map(([h,n]) => `${n}x  ${h.replace(/\s+/g,' ').slice(0,140)}`);
  const t = new Map();
  document.querySelectorAll('body *').forEach(el => {
    const tx = (el.textContent||'').trim();
    if (tx && tx.length > 2 && el.children.length === 0) t.set(tx, (t.get(tx)||0)+1);
  });
  out.texts = [...t.entries()].filter(([,n]) => n>1).sort((a,b)=>b[1]-a[1])
    .slice(0,12).map(([x,n]) => `${n}x  ${x.slice(0,90)}`);
  out.markers = {
    leftover: document.querySelectorAll('*[data-vsk-marker], template, [data-vsk-claimed], [data-vsk-hold], #vsk\\:data').length,
    commentMarkers: (() => { let c=0; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT); let n; while ((n=w.nextNode())) c++; return c; })(),
  };
  out.tabContainer = (() => {
    // find the write→understand tab strip below Hero
    const all = [...document.querySelectorAll('[role="tablist"], [role="tab"], [data-tab], .tab, [class*="tab"]')];
    const counts = {};
    all.forEach(el => { const tx = (el.textContent||'').trim().slice(0,40); counts[tx]=(counts[tx]||0)+1; });
    return counts;
  })();
  return out;
});
console.log('=== duplicate identical outerHTML blocks:');
(A.dups||[]).forEach(l => console.log('  ' + l));
console.log('=== duplicate leaf text nodes (dup-render symptom):');
(A.texts||[]).forEach(l => console.log('  ' + l));
console.log('=== tab-ish elements by label:', JSON.stringify(A.tabContainer||{}, null, 0));
console.log('=== leftover markers:', JSON.stringify(A.markers));
console.log('=== errors:', errs.join(' | ') || '(none)');
await b.close();
