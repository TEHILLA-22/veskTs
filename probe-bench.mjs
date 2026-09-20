import { scanRoutes } from '@vesk/compiler/src/router';
import { generateClientBundle } from '@vesk/adapter/src/client-bundle';
import { performance } from 'node:perf_hooks';

const appDir = '/workspaces/veskTs/test-app/app';
const cache = { files: new Map() };
const t0 = performance.now();
const routeTree = scanRoutes(appDir);
console.log('scanRoutes:', (performance.now()-t0).toFixed(1), 'ms, routes:', routeTree.length);

let t = performance.now();
const r1 = await generateClientBundle(routeTree, appDir, new Map(), { importRuntime: true, hmr: true, codeSplit: true, cache });
console.log('full warm build:', (performance.now()-t).toFixed(1), 'ms, chunks:', r1.chunks.length, 'cachedHits:', r1.cachedFileHits, 'compiled:', r1.compiledFiles, 'mainFromCache:', r1.mainFromCache);

const pagePath = appDir + '/page.vsk';
t = performance.now();
const r2 = await generateClientBundle(routeTree, appDir, new Map(), { importRuntime: true, hmr: true, codeSplit: true, cache, only: [pagePath], returnEditedSources: true });
console.log('targeted build:', (performance.now()-t).toFixed(1), 'ms, cachedHits:', r2.cachedFileHits, 'compiled:', r2.compiledFiles, 'editedSrc len:', r2.editedSources?.get(pagePath)?.length);

t = performance.now();
const r3 = await generateClientBundle(routeTree, appDir, new Map(), { importRuntime: true, hmr: true, codeSplit: true, cache });
console.log('full warm build 2:', (performance.now()-t).toFixed(1), 'ms, mainFromCache:', r3.mainFromCache);
