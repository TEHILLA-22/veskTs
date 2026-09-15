import { startProdServer } from '@vesk/adapter/src/index';
const S = await startProdServer('/root/vesk/test-app/.vesk/hydration-test', { port: 3099 });
await new Promise(r => setTimeout(r, 600));
const res = await fetch('http://localhost:3099/');
const h = await res.text();
const i = h.indexOf('id="root"');
// find closing of main
const k = h.indexOf('</main>', i);
console.log('LEN: ' + h.length);
console.log(h.slice(i, k + 400));
S.close();
process.exit(0);
