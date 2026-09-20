import { parse } from '@vesk/compiler/src/parser';
import { generateIR } from '@vesk/compiler/src/ir-generator';
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';

const src = readFileSync('/workspaces/veskTs/test-app/app/page.vsk', 'utf-8');
for (let i=0;i<3;i++){
  let t = performance.now();
  const ast = parse(src, { filename: 'page.vsk' });
  let tt = performance.now();
  const pms = tt - t;
  t = performance.now();
  const clone = structuredClone(ast);
  const cms = (performance.now() - t);
  t = performance.now();
  const ir = generateIR(ast, src, 'page.vsk');
  const irm = (performance.now() - t);
  t = performance.now();
  const ir2 = generateIR(clone, src, 'page.vsk');
  const ir2m = (performance.now() - t);
  console.log('parse', pms.toFixed(1), 'clone', cms.toFixed(1), 'genIR1', irm.toFixed(1), 'genIR2', ir2m.toFixed(1));
}
