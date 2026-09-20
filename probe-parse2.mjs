import { compileClient } from '@vesk/compiler/src/client-codegen';
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';

const pagePath = '/workspaces/veskTs/test-app/app/page.vsk';
const src = readFileSync(pagePath, 'utf-8');
for (let i=0;i<3;i++){
  let t = performance.now();
  const comp = compileClient(src, null, { forceClient: true, sourcePath: pagePath });
  console.log('compileClient comp:', (performance.now()-t).toFixed(1), 'ms, len:', comp.length);
  t = performance.now();
  const hyd = compileClient(src, null, { hydrate: true, forceClient: true, includeTopLevel: false, sourcePath: pagePath });
  console.log('  hyd:', (performance.now()-t).toFixed(1), 'ms, len:', hyd.length);
}
