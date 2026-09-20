import { compileClientBoth } from '@vesk/compiler/src/client-codegen';
import { buildHmrEvalSnippet } from '@vesk/adapter/src/client-bundle';
import { performance } from 'node:perf_hooks';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const appDir = '/workspaces/veskTs/test-app/app';
const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) { if (e.startsWith('_') || e === 'node_modules') continue; walk(p); }
    else if (e.endsWith('.vsk')) files.push(p);
  }
})(appDir);
console.log('total vsk:', files.length);
const rows = [];
for (const f of files) {
  const src = readFileSync(f, 'utf-8');
  let t = performance.now();
  const r = compileClientBoth(src, null, f);
  const c = (performance.now() - t);
  t = performance.now();
  const s = buildHmrEvalSnippet(r.comp);
  const sn = (performance.now() - t);
  rows.push({ f: f.slice(appDir.length + 1), size: src.length, compile: c, snippet: sn, hyd: r.hyd.length });
}
rows.sort((a,b) => b.compile - a.compile);
console.log('top 10 by compile ms:');
for (const r of rows.slice(0,10)) console.log(r.f, 'src', r.size, 'compile', r.compile.toFixed(1), 'snippet', r.snippet.toFixed(1));
const avg = rows.reduce((a,r)=>a+r.compile,0)/rows.length;
const med = rows.map(r=>r.compile).sort((a,b)=>a-b)[Math.floor(rows.length/2)];
const p90 = rows.map(r=>r.compile).sort((a,b)=>a-b)[Math.floor(rows.length*0.9)];
console.log('compile avg', avg.toFixed(1), 'median', med.toFixed(1), 'p90', p90.toFixed(1));
const slowfiles = rows.filter(r=>r.compile>55);
console.log('files with compile>55ms:', slowfiles.length, slowfiles.map(r=>r.f).join(', '));
