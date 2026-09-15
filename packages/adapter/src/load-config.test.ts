/**
 * loadVeskConfig — transpiles vesk.config.{ts,js}, strips `@vesk/compiler`
 * imports (injecting the CLI's own helpers), and resolves every other bare
 * import (plugin packages) against the project's node_modules. Regression
 * test for the `start` path that previously eval'd raw transpiled output and
 * died on plugin imports: "Cannot use import statement outside a module".
 */
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadVeskConfig } from './load-config.js';

let passed = 0, failed = 0;
function assert(c: boolean, msg: string) { if (c) { passed++; console.log(`  ✓ ${msg}`); } else { failed++; console.log(`  ✗ ${msg}`); } }

function mkProject(dir: string): void {
  mkdirSync(dir, { recursive: true });
  const compDir = join(dir, 'node_modules', '@vesk', 'compiler');
  mkdirSync(compDir, { recursive: true });
  writeFileSync(join(compDir, 'package.json'), JSON.stringify({ name: '@vesk/compiler', version: '1.0.0', main: 'index.js' }));
  writeFileSync(join(compDir, 'index.js'), 'export const defineConfig = c => c');
  const plugDir = join(dir, 'node_modules', 'fake-plugin');
  mkdirSync(plugDir, { recursive: true });
  writeFileSync(join(plugDir, 'package.json'), JSON.stringify({ name: 'fake-plugin', version: '1.0.0', main: 'index.js', type: 'module' }));
  writeFileSync(
    join(plugDir, 'index.js'),
    `export default function fakePlugin(){ return { name: 'fake-plugin', onCSS: () => {} } }\nexport const extra = 'extra-value';`
  );
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'load-config-test', version: '1.0.0', type: 'module' }));
  writeFileSync(join(dir, 'vesk.config.ts'), [
    `import { defineConfig, definePlugin, preset } from '@vesk/compiler'`,
    `import fakePlugin from 'fake-plugin'`,
    `import { extra } from 'fake-plugin'`,
    `const p = definePlugin({ name: 'custom', provides: { x: () => 1 } })`,
    `export default defineConfig({`,
    `  md: { html: 'allowlist', allowTags: ['a'] },`,
    `  security: preset('production', { trustProxy: true }),`,
    `  plugins: [fakePlugin({}), p],`,
    `})`,
    ``,
  ].join('\n'));
}

async function main() {
  console.log('\n=== adapter: loadVeskConfig (transpile + plugin-import injection) ===');

  // regression: vesk.config.ts with non-compiler plugin imports
  try {
    const tmp = mkdtempSync(join(tmpdir(), 'vesk-loadcfg-'));
    const dir = join(tmp, 'proj');
    mkProject(dir);
    const cfg = await loadVeskConfig(dir);
    assert(!!cfg, 'config loaded without module/import error');
    assert(!!cfg.security && cfg.security.trustProxy === true && typeof cfg.security.contentSecurityPolicy === 'string', 'preset() expanded via defineConfig (trustProxy + CSP)');
    assert(!!cfg.md && cfg.md.html === 'allowlist', 'md config read through');
    assert(Array.isArray(cfg.plugins) && cfg.plugins.length === 2, 'injected plugin factory + definePlugin both registered');
    assert(cfg.plugins[0].name === 'fake-plugin' && typeof cfg.plugins[0].onCSS === 'function', 'default-imported plugin factory worked');
    assert(!!cfg.plugins[1].provides && typeof cfg.plugins[1].provides.x === 'function', 'definePlugin passthrough worked');
  } catch (e) {
    failed++;
    console.log(`  ✗ loadVeskConfig threw: ${e instanceof Error ? e.message : e}`);
  }

  // vesk.config.js exporting a function
  try {
    const tmp2 = mkdtempSync(join(tmpdir(), 'vesk-loadcfg2-'));
    const dir2 = join(tmp2, 'proj2');
    mkdirSync(dir2, { recursive: true });
    writeFileSync(join(dir2, 'package.json'), JSON.stringify({ name: 'load-config-test2', version: '1.0.0', type: 'module' }));
    writeFileSync(join(dir2, 'vesk.config.js'), `export default function () { return { security: 'strict' } }`);
    const cfg = await loadVeskConfig(dir2);
    assert(!!cfg && cfg.security && (cfg.security as { xFrameOptions?: unknown }).xFrameOptions === 'DENY', 'vesk.config.js function export normalized by defineConfig');
  } catch (e) {
    failed++;
    console.log(`  ✗ vesk.config.js function export failed: ${e instanceof Error ? e.message : e}`);
  }

  // missing config
  try {
    const cfg = await loadVeskConfig('/nonexistent-dir-xyz');
    assert(cfg === undefined, 'missing config returns undefined');
  } catch (e) {
    failed++;
    console.log(`  ✗ missing config failed: ${(e as Error).message}`);
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();