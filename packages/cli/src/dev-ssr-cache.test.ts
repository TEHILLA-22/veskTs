/**
 * CLI dev server — SSR page/layout compile cache (`cachedSsrCompile`).
 *
 * Root cause for slow dev responses (vesk-doc case study: 0.5s–10s TTFB):
 * the CLI dev server compiled every page+layout from source on EVERY
 * request via renderPage/renderFullPage without a `cached:` plan. This test
 * pins the fix: one compile per file edit, render-only requests afterwards,
 * with eager + mtime-based invalidation. Covers both body modes — statement
 * mode is first-class.
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, utimesSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cachedSsrCompile, invalidateSsrCompile, type SsrCompileCache } from './dev-server.js';
import { renderPage } from '@vesk/compiler/src/server-render';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (condition) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ ${msg}`); }
}

const EXPR_SRC = `component ExprPage(props: { name: string }) {
  return <h1>Hello {props.name}</h1>
}
`;

const STMT_SRC = `component StmtPage(props: { name: string }) {
  <h1>Hello {props.name}</h1>
}
`;

async function main() {
  console.log('\n=== CLI dev server: SSR compile cache (cachedSsrCompile) ===');

  const proj = mkdtempSync(join(tmpdir(), 'vesk-ssr-cache-'));
  try {
    const exprPath = join(proj, 'expr.vsk');
    const stmtPath = join(proj, 'stmt.vsk');
    writeFileSync(exprPath, EXPR_SRC);
    writeFileSync(stmtPath, STMT_SRC);

    // ---- first compile populates the cache ----
    {
      const cache: SsrCompileCache = new Map();
      const a = cachedSsrCompile(cache, EXPR_SRC, exprPath);
      assert(!!a && !!a.componentMap.get('ExprPage'), 'expression-mode page compiles and populates the cache');
      const b = cachedSsrCompile(cache, EXPR_SRC, exprPath);
      assert(a === b, 'unchanged file returns the identical CompileFileResult (no recompile)');
      assert(cache.size === 1, 'one cache entry per file');
    }

    // ---- statement mode: same contract ----
    {
      const cache: SsrCompileCache = new Map();
      const a = cachedSsrCompile(cache, STMT_SRC, stmtPath);
      assert(!!a && !!a.componentMap.get('StmtPage'), 'statement-mode page compiles and populates the cache');
      const b = cachedSsrCompile(cache, STMT_SRC, stmtPath);
      assert(a === b, 'statement-mode cache hit returns the identical result');
    }

    // ---- cached render is byte-identical to a fresh request-time compile ----
    {
      const cache: SsrCompileCache = new Map();
      const cached = cachedSsrCompile(cache, EXPR_SRC, exprPath);
      const fresh = (await renderPage(EXPR_SRC, 'ExprPage', { name: 'Ada' }, new Map(), { hydrate: true })).body;
      const viaCache = (await renderPage(EXPR_SRC, 'ExprPage', { name: 'Ada' }, new Map(), { hydrate: true, cached })).body;
      assert(fresh === viaCache && fresh.includes('Hello Ada'), 'renderPage with cached: matches a fresh compile render');
      const cachedStmt = cachedSsrCompile(cache, STMT_SRC, stmtPath);
      const viaCacheStmt = (await renderPage(STMT_SRC, 'StmtPage', { name: 'Bob' }, new Map(), { hydrate: true, cached: cachedStmt })).body;
      assert(viaCacheStmt.includes('Hello Bob'), 'statement-mode cached render carries props through');
    }

    // ---- same cached plan reused across "requests" carries no state ----
    {
      const cache: SsrCompileCache = new Map();
      const cached = cachedSsrCompile(cache, EXPR_SRC, exprPath);
      const first = (await renderPage(EXPR_SRC, 'ExprPage', { name: 'Ada' }, new Map(), { hydrate: true, cached })).body;
      const second = (await renderPage(EXPR_SRC, 'ExprPage', { name: 'Grace' }, new Map(), { hydrate: true, cached })).body;
      assert(first.includes('Hello Ada') && second.includes('Hello Grace') && !second.includes('Ada'), 'shared plan renders per-request props with no cross-request leakage');
    }

    // ---- edit invalidates (mtime+size self-check) — next request recompiles ----
    {
      const cache: SsrCompileCache = new Map();
      const before = cachedSsrCompile(cache, EXPR_SRC, exprPath);
      const edited = EXPR_SRC.replace('Hello', 'Howdy');
      writeFileSync(exprPath, edited);
      // Force a distinct mtime so the test is deterministic on any fs.
      const cur = statSync(exprPath);
      utimesSync(exprPath, cur.atime, new Date(cur.mtimeMs + 5000));
      const after = cachedSsrCompile(cache, edited, exprPath);
      assert(after !== before, 'edited file recompiles (mtime+size key busted)');
      const html = (await renderPage(edited, 'ExprPage', { name: 'Ada' }, new Map(), { hydrate: true, cached: after })).body;
      assert(html.includes('Howdy Ada'), 'post-edit render serves the new content, never the stale plan');
    }

    // ---- eager invalidation (watcher path) ----
    {
      const cache: SsrCompileCache = new Map();
      const before = cachedSsrCompile(cache, STMT_SRC, stmtPath);
      invalidateSsrCompile(cache, stmtPath);
      assert(cache.size === 0, 'invalidateSsrCompile drops the entry');
      const after = cachedSsrCompile(cache, STMT_SRC, stmtPath);
      assert(after !== before, 'post-invalidation lookup recompiles');
    }

    // ---- missing file: falls back to request-time compile semantics ----
    {
      const cache: SsrCompileCache = new Map();
      const ghost = join(proj, 'ghost.vsk');
      const compiled = cachedSsrCompile(cache, EXPR_SRC, ghost);
      assert(!!compiled.componentMap.get('ExprPage'), 'missing path still compiles the passed source');
      assert(cache.size === 0, 'fallback compile does not poison the cache');
    }

    // ---- broken source: the error propagates (dev error page, not stale HTML) ----
    {
      const cache: SsrCompileCache = new Map();
      const badPath = join(proj, 'bad.vsk');
      const bad = `component Bad( { return <oops`;
      writeFileSync(badPath, bad);
      let threw = false;
      try { cachedSsrCompile(cache, bad, badPath); } catch { threw = true; }
      assert(threw, 'compile errors throw through so the dev server renders its error page');
      assert(!cache.has(badPath), 'failed compiles are not cached');
    }
  } finally {
    rmSync(proj, { recursive: true, force: true });
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed === 0) { console.log('All tests passed!'); process.exit(0); }
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
