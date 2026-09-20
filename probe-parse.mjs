import { parse } from '@vesk/compiler/src/parser';
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';

const pagePath = '/workspaces/veskTs/test-app/app/page.vsk';
const src = readFileSync(pagePath, 'utf-8');
for (let i=0;i<3;i++){
  let t = performance.now();
  const ast = parse(src, { filename: pagePath });
  console.log('parse:', (performance.now()-t).toFixed(1), 'ms, body:', ast.body.length);
}
