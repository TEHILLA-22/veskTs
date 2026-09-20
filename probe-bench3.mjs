import { compileClientBoth } from '@vesk/compiler/src/client-codegen';
import { buildHmrEvalSnippet } from '@vesk/adapter/src/client-bundle';
import { parse } from '@vesk/compiler/src/parser';
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';

const pagePath = '/workspaces/veskTs/test-app/app/page.vsk';
const src = readFileSync(pagePath, 'utf-8');
console.log('file size:', src.length);

let t = performance.now();
const raws = compileClientBoth(src, null, pagePath);
console.log('compileClientBoth:', (performance.now()-t).toFixed(1), 'ms, comp len:', raws.comp.length, 'hyd len:', raws.hyd.length);

t = performance.now();
const snip = buildHmrEvalSnippet(raws.comp);
console.log('buildHmrEvalSnippet:', (performance.now()-t).toFixed(1), 'ms, len:', snip.length);
