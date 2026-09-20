import { parse } from '/workspaces/veskTs/packages/compiler/src/parser.ts';
import { generateIR } from '/workspaces/veskTs/packages/compiler/src/ir-generator.ts';
import { nameAllocFor, emitClientFromIR } from '/workspaces/veskTs/packages/compiler/src/client-codegen.ts';
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';

const src = readFileSync('/workspaces/veskTs/test-app/app/page.vsk', 'utf-8');
const alloc = nameAllocFor('page.vsk');
for (let i=0;i<3;i++){
  const ast = parse(src, { filename: 'page.vsk' });
  const clone = structuredClone(ast);
  const ir = generateIR(ast, src, 'page.vsk');
  const irHyd = generateIR(clone, src, 'page.vsk');
  let t = performance.now();
  const comp = emitClientFromIR(ir, { forceClient: true, nameAllocator: alloc });
  const cm = (performance.now() - t);
  t = performance.now();
  const hyd = emitClientFromIR(irHyd, { forceClient: true, hydrate: true, includeTopLevel: false, nameAllocator: alloc });
  const hm = (performance.now() - t);
  console.log('emit comp', cm.toFixed(1), 'ms (len', comp.length + ')', 'emit hyd', hm.toFixed(1), 'ms (len', hyd.length + ')');
}
