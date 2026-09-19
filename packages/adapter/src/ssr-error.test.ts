/**
 * Unit tests for `ssr-error.ts` — the dev-only runtime-error → HMR-payload
 * resolver that unifies SSR 500s and client `ReferenceError`s with HMR error
 * reporting (file + line/column + codeframe + tips, same overlay shape).
 * Plain-script style (exit 1 on failure), no dist needed.
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  extractUndefinedName,
  extractComponentNames,
  extractSourceFrames,
  firstSourceFileFrame,
  findIdentifierUsage,
  candidateFiles,
  displayPath,
  formatErrorLocation,
  resolveRuntimeErrorPayload,
  resolveClientErrorReport,
  renderDevErrorPage,
} from './ssr-error';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string): void {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ ${msg}`); }
}

console.log('\n=== Vesk ssr-error (SSR/HMR error unification) ===');

// --- extractUndefinedName ---
{
  assert(extractUndefinedName('Menu is not defined') === 'Menu', 'bare "X is not defined"');
  assert(extractUndefinedName('ReferenceError: Menu is not defined') === 'Menu', 'ReferenceError-prefixed message');
  assert(extractUndefinedName("Cannot find name 'Menu'.") === 'Menu', 'tsc "Cannot find name" shape');
  assert(extractUndefinedName("Can't find variable: Menu") === 'Menu', 'Safari "Can\'t find variable" shape');
  assert(extractUndefinedName('Cannot read properties of undefined') === null, 'null-deref has no undefined name');
  assert(extractUndefinedName('boom') === null, 'plain message has no undefined name');
  assert(extractUndefinedName('') === null, 'empty message → null');
}

// --- extractComponentNames ---
{
  const stack = [
    'ReferenceError: Menu is not defined',
    '    at $n25 (http://localhost:3200/_vesk/static/page-index.js:833:14)',
    '    at __components.SiteHeader (http://localhost:3200/_vesk/static/page-index.js:854:14)',
    '    at __components.Home [as page] (http://localhost:3200/_vesk/static/page-index.js:1266:39)',
  ].join('\n');
  const names = extractComponentNames(stack);
  assert(names.length === 2 && names[0] === 'SiteHeader' && names[1] === 'Home', 'dot-form components in stack order');
  assert(extractComponentNames('at __components["Foo"] (x.js:1:1)\nat __components["Foo"] (x.js:2:2)').join(',') === 'Foo', 'bracket form dedupes');
  assert(extractComponentNames("at __components['Bar'] (x.js:1:1)").join(',') === 'Bar', 'single-quote bracket form');
  assert(extractComponentNames('no components here').length === 0, 'no markers → []');
}

// --- findIdentifierUsage ---
{
  const src = [
    'import { Link } from "@vesk/runtime";',
    'import Menu from "./menu";',
    '',
    'component SiteHeader() {',
    '  <header><Menu items={items} /></header>',
    '  <footer><SideMenu /></footer>',
    '}',
  ].join('\n');
  const use = findIdentifierUsage(src, 'Menu');
  assert(use !== null && use.line === 5, 'usage found past the import lines (line 5)');
  assert(use !== null && use.column === 12, `usage column points at <Menu (got ${use?.column})`);
  assert(findIdentifierUsage(src, 'SideMenu')?.line === 6, 'SideMenu does not match the Menu scan');
  assert(findIdentifierUsage(src, 'Missing') === null, 'absent identifier → null');
  assert(findIdentifierUsage(src, 'header') !== null, 'plain word match works');
  assert(findIdentifierUsage('import Menu from "x";\n<Menu />', 'Menu')?.line === 2, 'import line skipped, use line returned');
}

// --- fixture project: app page + shared component ---
const tmp = mkdtempSync(join(tmpdir(), 'vesk-ssr-err-'));
const appDir = join(tmp, 'app');
const projRoot = tmp;
mkdirSync(appDir, { recursive: true });
mkdirSync(join(tmp, 'components'), { recursive: true });
const headerSrc = [
  'component SiteHeader() {',
  '  const &[open] = track(false);',
  '  <header>',
  '    <nav><Menu items={items} /></nav>',
  '  </header>',
  '}',
].join('\n');
const pageSrc = [
  'component Home() {',
  '  <main>',
  '    <SiteHeader />',
  '    <h1>hello</h1>',
  '  </main>',
  '}',
].join('\n');
writeFileSync(join(tmp, 'components', 'SiteHeader.vsk'), headerSrc, 'utf-8');
writeFileSync(join(appDir, 'page.vsk'), pageSrc, 'utf-8');
writeFileSync(join(appDir, 'layout.vsk'), 'component Layout() {\n  <html><body>{props.children}</body></html>\n}', 'utf-8');

const userStack = [
  'ReferenceError: Menu is not defined',
  '    at $n25 (http://localhost:3200/_vesk/static/page-index.js:833:14)',
  '    at __components.SiteHeader (http://localhost:3200/_vesk/static/page-index.js:854:14)',
  '    at __components.Home [as page] (http://localhost:3200/_vesk/static/page-index.js:1266:39)',
].join('\n');

const ctx = {
  appDir,
  projectDir: tmp,
  routeFiles: [join(appDir, 'page.vsk'), join(appDir, 'layout.vsk')],
  componentMap: new Map([['SiteHeader', join(tmp, 'components', 'SiteHeader.vsk')]]),
  routeSources: new Map([['Home', join(appDir, 'page.vsk')]]),
};

try {
  // --- displayPath ---
  assert(displayPath(join(appDir, 'page.vsk'), ctx) === 'page.vsk', 'app file → app-relative');
  assert(displayPath(join(tmp, 'components', 'SiteHeader.vsk'), ctx) === 'components/SiteHeader.vsk', 'shared file → project-relative');

  // --- candidateFiles: stack components outrank route files ---
  {
    const cands = candidateFiles('Menu is not defined', userStack, ctx);
    assert(cands[0] === join(tmp, 'components', 'SiteHeader.vsk'), 'SiteHeader (stack-named) leads candidates');
    assert(cands.includes(join(appDir, 'page.vsk')), 'route page included as fallback');
  }

  // --- resolveRuntimeErrorPayload: the user's exact failure ---
  {
    const err = new Error('Menu is not defined');
    err.name = 'ReferenceError';
    err.stack = userStack;
    const p = resolveRuntimeErrorPayload(err, ctx);
    assert(p.file === 'components/SiteHeader.vsk', `payload names the .vsk file (got ${p.file})`);
    assert(p.line === 4, `payload line is the <Menu use site (got ${p.line})`);
    assert(p.column === 11, `payload column points at <Menu (got ${p.column})`);
    assert(!!p.codeframe && p.codeframe.code.some((l) => l.isError && l.text.includes('<Menu')), 'codeframe highlights the <Menu line');
    assert((p.tips || []).join(' ').toLowerCase().includes('undeclared'), 'tips carry the "is not defined" guidance');
    assert(!!p.stack && p.stack.includes('SiteHeader'), 'original stack preserved');
    assert(formatErrorLocation(p) === 'components/SiteHeader.vsk:4:11', 'terminal one-liner');
  }

  // --- resolveRuntimeErrorPayload: error already carrying a location keeps it ---
  {
    const err = new Error('Unexpected token') as Error & { loc: { line: number; column: number } };
    err.loc = { line: 2, column: 1 };
    const p = resolveRuntimeErrorPayload(err, ctx);
    assert(p.line === 2, 'located error keeps its line');
    assert(!!p.codeframe, 'located error gets a codeframe from disk');
  }

  // --- resolveRuntimeErrorPayload: VeskError with .loc + .code keeps the code ---
  {
    const err = Object.assign(new Error('Reactive read outside a tracked scope'), {
      loc: { line: 15, column: 2 },
      code: 'V0412',
    });
    const p = resolveRuntimeErrorPayload(err, ctx);
    assert(p.code === 'V0412', `VeskError code V0412 survives resolution (got ${String(p.code)})`);
    assert(p.line === 15 && p.column === 3, 'located VeskError keeps its line/column');
  }

  // --- resolveRuntimeErrorPayload: non-ReferenceError with component frames names the file ---
  {
    const err = Object.assign(new Error("Cannot read properties of undefined (reading 'x')"), {
      stack: 'TypeError: boom\n    at __components.Home (page-index.js:10:5)',
    });
    const p = resolveRuntimeErrorPayload(err, ctx);
    assert(p.file === 'page.vsk', `typeless error still names the .vsk file (got ${p.file})`);
    assert(p.line === null, 'no identifier → no fabricated line');
  }

  // --- resolveRuntimeErrorPayload: total fallback never throws ---
  {
    const p = resolveRuntimeErrorPayload(new Error('weird'), { appDir });
    assert(typeof p.message === 'string' && p.message.includes('weird'), 'fallback keeps the message');
    assert(Array.isArray(p.tips), 'fallback still carries tips');
  }

  // --- resolveClientErrorReport: compiled coords in, .vsk payload out ---
  {
    const p = resolveClientErrorReport(
      { message: 'Menu is not defined', stack: userStack, filename: 'http://localhost:3200/_vesk/static/page-index.js', line: 833, column: 14 },
      ctx,
    );
    assert(p.file === 'components/SiteHeader.vsk', 'client report resolves to the .vsk file, not the bundle');
    assert(p.line === 4, 'client report resolves to the .vsk line, not bundle line 833');
    assert(!!p.codeframe, 'client report carries a codeframe');
  }

  // --- extractSourceFrames / firstSourceFileFrame (`.ts` imported into `.vsk`) ---
  {
    const tsStack = [
      'ReferenceError: helper is not defined',
      '    at formatPrice (' + join(tmp, 'lib', 'format.ts') + ':2:9)',
      '    at Object.<anonymous> (' + join(tmp, 'lib', 'format.ts') + ':5:1)',
      '    at __components.Home (page-index.js:44:3)',
    ].join('\n');
    const frames = extractSourceFrames(tsStack);
    assert(frames.length === 3, `extractSourceFrames parses all 3 frames (got ${frames.length})`);
    assert(frames[0].path === join(tmp, 'lib', 'format.ts') && frames[0].line === 2 && frames[0].column === 10, 'paren frame path/line/col (1-based col)');
    assert(frames[2].path === 'page-index.js' && frames[2].line === 44, 'bundle frame parsed too');

    const real = firstSourceFileFrame(tsStack, projRoot);
    assert(real === null, 'non-existent .ts path → no real frame');
  }

  // --- a broken `.ts` imported into a `.vsk` resolves to the `.ts` file ---
  {
    mkdirSync(join(tmp, 'lib'), { recursive: true });
    writeFileSync(join(tmp, 'lib', 'format.ts'), [
      'export function formatPrice(n) {',
      '  return `$${helper(n)}`;',
      '}',
      '',
      'formatPrice(1);',
    ].join('\n'), 'utf-8');
    const tsStack = [
      'ReferenceError: helper is not defined',
      '    at formatPrice (' + join(tmp, 'lib', 'format.ts') + ':2:9)',
      '    at Object.<anonymous> (' + join(tmp, 'lib', 'format.ts') + ':5:1)',
      '    at __components.Home (page-index.js:44:3)',
    ].join('\n');
    const src = [
      'import { formatPrice } from "../lib/format.ts";',
      '',
      'component Home() {',
      '  <p>{formatPrice(10)}</p>',
      '}',
    ].join('\n');
    writeFileSync(join(appDir, 'page.vsk'), src, 'utf-8');
    const err = new Error('helper is not defined');
    err.name = 'ReferenceError';
    err.stack = tsStack;
    const p = resolveRuntimeErrorPayload(err, ctx);
    assert(p.file === 'lib/format.ts', `payload names the .ts file, not the bundle (got ${p.file})`);
    assert(p.line === 2, `payload line is the helper call site in format.ts (got ${p.line})`);
    assert(!!p.codeframe && p.codeframe.code.some((l) => l.isError && l.text.includes('helper')), 'codeframe spans the .ts source');
    assert(!!p.stack && p.stack.includes('formatPrice'), 'original .ts stack preserved');
  }

  // --- a VeskError with .code thrown inside .ts keeps the code through the frame path ---
  {
    const tsStack = [
      'RangeError: Max call stack size exceeded',
      '    at formatPrice (' + join(tmp, 'lib', 'format.ts') + ':2:9)',
      '    at __components.Home (page-index.js:44:3)',
    ].join('\n');
    const err = Object.assign(new Error('Max call stack size exceeded'), { name: 'RangeError', stack: tsStack, code: 'V0420' });
    const p = resolveRuntimeErrorPayload(err, ctx);
    assert(p.code === 'V0420', `code from a VeskError in .ts survives the frame-resolution path (got ${String(p.code)})`);
    assert(p.file === 'lib/format.ts', 'frame path still names the .ts file');
  }

  // --- node_modules + dist frames are never treated as source ---
  {
    const depStack = [
      'TypeError: Cannot read properties of undefined',
      '    at shift (' + join(tmp, 'node_modules', 'pkg', 'dist', 'impl.js') + ':3:1)',
      '    at formatPrice (' + join(tmp, 'lib', 'format.ts') + ':2:9)',
      '    at __components.Home (page-index.js:44:3)',
    ].join('\n');
    const real = firstSourceFileFrame(depStack, projRoot);
    assert(real !== null && !real.path.includes('node_modules'), 'node_modules frame skipped, next real frame chosen');
  }

  // --- no real frames (pure bundle coords) → falls through to the .vsk scan ---
  {
    const real = firstSourceFileFrame(userStack, tmp);
    assert(real === null, 'pure bundle coords yield no real source frame');
  }

  // --- renderDevErrorPage ---
  {
    const err = new Error('Menu is not defined');
    err.stack = userStack;
    const p = resolveRuntimeErrorPayload(err, ctx);
    const html = renderDevErrorPage(p, { status: 500, url: '/' });
    assert(html.includes('components/SiteHeader.vsk'), 'page shows the .vsk file');
    assert(html.includes('Menu is not defined'), 'page shows the message');
    assert(html.includes('&lt;Menu'), 'page shows the escaped codeframe line');
    assert(html.includes('TIPS'), 'page shows the tips section');
    assert(html.includes('Stack trace'), 'page shows the stack section');
    assert(html.includes('</body>'), 'page keeps </body> for dev-script injection');
    assert(!html.includes('page-index.js:833') || html.includes('Stack trace'), 'bundle coords only inside the stack detail');
  }

  // --- renderDevErrorPage shows the VeskError code ---
  {
    const err = Object.assign(new Error('Reactive read outside a tracked scope'), {
      loc: { line: 15, column: 2 },
      code: 'V0412',
    });
    const p = resolveRuntimeErrorPayload(err, ctx);
    const html = renderDevErrorPage(p, { status: 500, url: '/page' });
    assert(html.includes('V0412'), `dev error page renders the error code (got ${html.match(/V0\d+/)?.[0] || 'none'})`);
    assert(html.includes('Reactive read outside a tracked scope'), 'dev error page still shows the message');
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\nResults: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);
process.exit(failed > 0 ? 1 : 0);
