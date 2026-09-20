import { scanRoutes } from '@vesk/compiler/src/router';
import { generateClientBundle } from '@vesk/adapter/src/client-bundle';
import { performance } from 'node:perf_hooks';
import { writeFileSync, readFileSync } from 'node:fs';

const appDir = '/workspaces/veskTs/test-app/app';
const cache = { files: new Map() };
const routeTree = scanRoutes(appDir);
await generateClientBundle(routeTree, appDir, new Map(), { importRuntime: true, hmr: true, codeSplit: true, cache });

const pagePath = appDir + '/page.vsk';
const orig = readFileSync(pagePath, 'utf-8');

for (let i=0;i<5;i++) {
  writeFileSync(pagePath, orig + '\n// touch ' + i + '\n');
  let t = performance.now();
  const r = await generateClientBundle(routeTree, appDir, new Map(), { importRuntime: true, hmr: true, codeSplit: true, cache, only: [pagePath], returnEditedSources: true });
  console.log('targeted recompile:', (performance.now()-t).toFixed(1), 'ms, compiled:', r.compiledFiles, 'editedSrc len:', r.editedSources?.get(pagePath)?.length);
}
writeFileSync(pagePath, orig);
