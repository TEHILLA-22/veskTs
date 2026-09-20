import { scanRoutes } from '@vesk/compiler/src/router';
import { performance } from 'node:perf_hooks';
const appDir = '/workspaces/veskTs/test-app/app';
for (let i=0;i<3;i++) {
  const t0 = performance.now();
  const routeTree = scanRoutes(appDir);
  console.log('scanRoutes:', (performance.now()-t0).toFixed(1), 'ms');
}
