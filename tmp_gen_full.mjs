import {compileClientBoth} from '/workspaces/veskTs/packages/compiler/dist/client-codegen.js';
import fs from 'fs';
const src=fs.readFileSync('/workspaces/veskTs/vesk-doc/app/components/CodeShowcase.vsk','utf-8');
const out=compileClientBoth(src, null, 'CodeShowcase.vsk');
const hyd = out.hyd;
// Find $n23 definition
const idx = hyd.indexOf('const $n23');
if (idx >= 0) console.log('n23 at', idx, ':', hyd.slice(idx, idx+500));
else {
  const idx2 = hyd.indexOf('$n23');
  console.log('first $n23 at', idx2, ':', hyd.slice(Math.max(0,idx2-200), idx2+500));
}
