# Vesk — handoff (active session, Sep 15)

## Objective
Make the hydration/SSR CI gates green at HEAD `8bbe77f` ("fixing hydration bugs",
parent `caf8b5f`). Concretely:
1. **Production gate** — `VESK_E2E=1 node tests/production-hydration-test.mjs` (dev servers
   on :3002 dev / :3099 prod, `CHROMIUM_PATH` defaults to
   `/data/data/com.termux/files/usr/bin/chromium-browser`). **Now PASSING 52/52** after the
   per-token slot + settle fix below.
2. **Dev gate** — `BASE=http://localhost:3002 node tests/hydration-test.mjs` (360 tests).
   **Currently 351 passed / 9 failed.** This is the only gate still red.
3. After green: full `node scripts/test.js` suite + `npm run typecheck` + remove temporary
   instrumentation + delete stray probe files + update `TODO.md`. Do **not** commit
   instrumentation/probes into tests.

## What's done and verified green (do not regress)
- **Production handoff fix (the big one).** The async `useFetch` (posts) SSR data never
  reached the client because the fetch promise was torn down by `clearSsrCells` before any
  settle, and its `.then`/`setSsrData` callbacks fired outside AsyncLocalStorage scope after
  the render token was deleted.
  - `packages/runtime/src/resource.ts`: helpers `ssrSlotFor`/`writeSsrSlot`;
    `getSsrData` precedence = sink → `__vsk_ssr_data_<token>` slot → flat `__vsk_ssr_data`;
    `setSsrData(key, value, ownerToken?)` writes sink + flat + slot;
    `clearSsrData` clears flat + current-token slot; `startRequest` server branch captures
    `startToken = g().__vsk_ssr_token` at fetch start and passes it into `setSsrData`.
  - `packages/compiler/src/server-render.ts`: `doRender` reuses an existing
    `__vsk_ssr_token` instead of regenerating (handler sequence is
    `renderPage(page)` → `renderPage(layouts)` → `renderFullPage`, see
    `test-app/.vesk/<out>/functions/index.js` lines 71/82/86); the async branch and the
    stream path now `await settleSsrPromises(renderToken)` (`Promise.allSettled` over
    `__vsk_ssr_promises_<token>`) BEFORE `clearSsrCells`; `clearSsrCells` no longer deletes
    the token; `renderFullPage`/`renderPageStream` merge `{ ...ssrSink.snapshot(), ...slot }`
    (flat-global merge intentionally **dropped** — c78a621-class cross-request leak via
    `__vsk_ssr_data` flat; do not reintroduce), emit data scripts, then in `finally`
    delete token + slot and `pruneSsrDataSlots()` (caps abandoned `__vsk_ssr_data_*` at 40).
    Sync `doRender` stays **synchronous** when no `__vsk_ssr_promises_<token>` exist — 40
    non-awaited `render(` calls in `packages/compiler/src/integration.test.ts` and ~7
    `renderPage(...).body` usages (lines 86,95,102,112,173,494,1535) depend on it.
  - One request = one token = one slot; `renderFullPage` now emits `/ssr-data.js?t=<token>`
    (external script) into a global store `__vsk_ssr_data_store` (cap 100) via
    `storeDataScriptGlobal` in `packages/adapter/src/runtime-bundle.ts` (lines 89-108);
    `/ssr-data.js` route (dev 566/`packages/adapter/src/dev-server.ts`, prod ~315/`
    packages/adapter/src/prod-server.ts`) serves and **deletes** the entry.
- **Tests/probes:**
  - `npx tsx packages/runtime/src/resource.test.ts` — **37/37** (slot/get/set ordering).
  - `npx tsx packages/compiler/src/integration.test.ts` — **128/128**.
  - `npm run typecheck` — clean.
  - `VESK_E2E=1 node tests/production-hydration-test.mjs` — **52/52**: all hydration
    markers claimed, "posts from useFetch SSR rendered: yes", zero page errors; `/`
    (3099) serves `/ssr-data.js?t=…` carrying the full 5-post `__vsk_ssr_data` JSON and
    `<main>` renders all 5 posts server-side.
- **Dev server repairs that took the dev gate from 317/43 → 351/9:**
  - Dev server had **no `/ssr-data.js` route** — SPA fallback served the HTML document as
    the script payload ("Unexpected token '<'" everywhere). The feature (commit `85d8dd6`,
    "fix: serve hydration data as external script (CSP-safe) + async discipline hardening")
    was added to prod-server + runtime stored-procedure but **never dev-server**. Added the
    route in `packages/adapter/src/dev-server.ts` (~566) with `safeJsonForScript` imported
    from `@vesk/compiler/src/server-codegen`.
  - Dev `doBuild()` built without plugins → raw 75-byte `global.css`. Now passes
    `plugins: options?.plugins` (dev-server.ts:434); `scripts/e2e-setup.js:55` passes
    `plugins` to `startDevServer`. Verify: dev css now 40307 bytes; `/ssr-data.js?t=nope` →
    `// no ssr data`.
  - `packages/cli/src/dev-server.ts` is a **separate flavor** (`/_vesk/ssr-data.js?t=`,
    ~line 399 + handler ~1108, `getActiveDevPlugins`). Not the gate path, but check parity
    before touching.

## What's failing — 9 dev failures (`devhyd8.log`)
Section `=== TEST 18: SSR data integrity across all routes ===` in
`tests/hydration-test.mjs` (DATA_ROUTES = {`/`,`/async`,`/posts`} at line 1131;
FULL_ROUTES loop 1161-1186; per-route fresh `browser.newPage()` + `goto` + `networkidle0`
+ `(document.documentElement.outerHTML.match(/ssr-data\.js/g)||[]).length`):
- `✗ /blog/hello-world has 1 ssr-data script ref(s) (expected 0)` (line 206)
- `✗ /comp-test has 1 ssr-data script ref(s) (expected 0)` (line 216)
- `✗ no ssr-data script leaked into non-data routes — /blog/hello-world:1, /comp-test:1`
  (line 264, aggregate)
- Plus 6 earlier failures: `✗ No error loading runtime module` (line 67) and
  `✗ hydrateViewport exported` / `hydrateIdle` / `hydrateOnInteraction` / `collectVskMarkers`
  / `createHydrateWalker` (lines 68-72) — `import('/_vesk/runtime.js')` from `page.evaluate`
  is missing those 5 client-barrel names. **Check whether these are pre-existing / baseline
  parity** (they existed in the very first dev run too) vs a regression from the adapter
  dev `buildRuntimeCode` concatenation failing to re-export them (see
  `packages/adapter/src/client-bundle.ts` `runtimeExportNames` /
  `packages/runtime/src/index-client.ts` client barrel; the legacy concat fallback strips
  `export ... from` lines and re-emits one `export { <names> }` from index-client re-export
  names).

## Debugging evidence trail for the ssr-data leak (device/pinned)
- **Not reproducible in isolation:** direct `curl` (plain or browser headers) and a puppeteer
  fresh-page load of `/blog/hello-world`, `/comp-test` on both 3002 and 3099 → **0 refs**,
  even after first loading `/` `/about` `/blog` in sequence (fresh pages) → 0 refs.
- **Reproducible only when the full suite has run before** (Test 1 … Test 17 warm the
  server: repeated `/` and `/async` full loads, SPA navs across every route via the
  router, back/forward, error-boundary navs, `/broken` error renders, X-Vesk-Data
  data-fetch navs).
- **`[render-trace]`** (added to renderFullPage ~server-render.ts:487-493 and
  renderPageStream ~:652-662, gated on `process.env.VESK_SSR_TRACE`): every data-less route
  renders `keys=∅ slot=∅ sink=∅` — **the merge is clean at render time for the leaking
  routes**. `/async`/`/posts` renders show `keys=posts slot=posts sink=∅` (slot = page's own
  data, correct).
- **`[body-trace]`** (dev-server.ts:649-651, logs when a served text/html body contains
  the ref): **zero hits in every suite run** → the served HTML bodies never contain the
  ref. Combined with the above: the ref is NOT produced by the server-side render/merge.
- **`[ssr-data-trace]`** (dev-server.ts:571, logs token + Referer + store payload shape):
  the browser DOES fetch `/ssr-data.js` from the leaked pages — Referer
  `http://localhost:3002/blog/hello-world` (token e.g. `f103b6`) and
  `http://localhost:3002/comp-test` (token `567d94`). Payloads carry `posts` /
  `/api/posts` data even though neither route fetches anything.
- **`[leak-debug]`** (temporary patch in `tests/hydration-test.mjs` 18a, dumps
  `script[src]` list + innerHTML count + `typeof window.__vsk_ssr_data`) for the failing
  routes shows DOM srcs:
  ```
  http://localhost:3002/pwa-init.js
  http://localhost:3002/ssr-data.js?t=f103b6bb7986cc94a1b6738c   (innerCount 1, hasVar=true)
  http://localhost:3002/_vesk/static/client.js
  http://localhost:3002/_vesk/hmr.js
  ```
  So the ref IS in the live DOM (a `<script src>` in `<head>`) of a fresh full page, with a
  token whose global-store entry holds posts. `pwa-init.js` = head-plugin script
  (`<script src="/pwa-init.js" defer>` per `packages/adapter/src/plugin-head.test.ts:51`)
  living in `test-app/.vesk/dev/static/public/pwa-init.js` — verify it is normal/expected.
- **Token lifecycle is central:** `renderFullPage` reuses `__vsk_ssr_token` if present and
  deletes token+slot in `finally`. The store entry referenced by the leaked pages must have
  been created by a render whose ssrData = posts and whose token the later clean render
  re-emitted — i.e. a **stale live `__vsk_ssr_token` (and/or stale slot) surviving from an
  earlier posts render** into a later clean render. Because fresh isolated runs never leak,
  the survivor is produced by an earlier suite request pattern (candidate: aborted render,
  stream render, error-boundary render, or an async `.then` landing after its finally and
  re-creating `__vsk_ssr_data_<token>`).
- Note: earlier runs (devhyd6/7) served leak payloads as found; in devhyd8 those exact
  fetches already show `payload=NONE` (entry consumed by the earlier full load of `/`-family
  before the 18a loop), consistent with token reuse + one-shot delete.

## Instrumentation added this session (remove before finishing)
All gated (`VESK_SSR_TRACE` env) or temporary — safe to strip at cleanup:
- `packages/compiler/src/server-render.ts` — `[render-trace]` blocks after both merges.
- `packages/adapter/src/dev-server.ts` — `[ssr-data-trace]` (incl. referer) in the
  `/ssr-data.js` route; `[body-trace]` in the main HTML-serving block.
- `tests/hydration-test.mjs` — `[leak-debug]` dump in the 18a assert block (REVERT THE TEST:
  it is a tracked repo test; also confirm the `innerCount`/`hasVar` probe is not committing
  anything).
- Also still pending from earlier: remove `_hl`/`__vskHydLog` instrumentation in
  `packages/runtime/src/hydrate.ts` (that file is modified in the working tree).

## Environment / ops how-to (Termux-proot; no systemd; no `ss`/`lsof`)
```bash
# rebuild all packages after any compiler/runtime/adapter src edit
npx tsx packages/cli/src/build-packages.ts
# launch e2e (prod :3099 + dev :3002) — USE THIS EXACT DETACH, never pkill -f:
#   `pkill -f e2e-setup.js` matches the tool's own command line and self-kills the shell
rm -f /tmp/opencode/e2e-setup.log
setsid nohup env VESK_SSR_TRACE=1 npx tsx scripts/e2e-setup.js > /tmp/opencode/e2e-setup.log 2>&1 < /dev/null &
echo "pid=$!" > /tmp/opencode/e2e.pid      # gives you a clean kill handle
# poll READY in a SHORT separate call (the launch call always pends ~120s cosmetically):
for i in $(seq 1 30); do grep -q E2E_SERVERS_READY /tmp/opencode/e2e-setup.log && break; sleep 5; done
# kill by saved pid when needed:  kill -9 $(cat /tmp/opencode/e2e.pid)
# ports check (ss/lsof unreliable here):
node -e 'const n=require("net");for(const p of [3002,3099]){const s=n.createServer().once("error",e=>console.log(p,"BUSY")).listen(p,()=>{console.log(p,"FREE");s.close()});}'
# run the gates (dev gate takes >120s → timeout 420000):
BASE=http://localhost:3002 node tests/hydration-test.mjs
VESK_E2E=1 node tests/production-hydration-test.mjs
```
- `scripts/e2e-setup.js` is plain JS; launches prod build then `startDevServer` (adapter).
- Test harness: `expect()` only `toBe`/`toEqual` (use `.toBe(undefined)`); `rg` not
  installed (use grep); dev = :3002, prod = :3099.

## Files touched this session (working tree)
- `packages/runtime/src/resource.ts` — slot helpers, sink→slot→flat get, owner-token set,
  startRequest startToken capture, trackSsrPromise.
- `packages/compiler/src/server-render.ts` — settleSsrPromises/pruneSsrDataSlots, token
  reuse, settle-before-clear, slot merges, finally token+slot delete, render-trace.
- `packages/adapter/src/dev-server.ts` — `/ssr-data.js` route, `body-trace`/`ssr-data-trace`,
  doBuild passes plugins.
- `scripts/e2e-setup.js` — passes `plugins` to `startDevServer`.
- `packages/runtime/src/hydrate.ts` — has leftover `_hl`/`__vskHydLog` instrumentation
  (cleanup pending).
- `tests/hydration-test.mjs` — TEMP `[leak-debug]` patch (revert).
- Modified unit tests (keep): `packages/runtime/src/resource.test.ts`,
  `packages/compiler/src/integration.test.ts`.
- Stray untracked probes/artifacts to delete at the end: `_marker-probe.mjs`,
  `tests/.marker-probe.mjs`, `prod-count-probe.mjs`, `prod-dump.mjs`,
  `prod-ssr-probe.mjs`, and review `packages/adapter/src/load-config.ts` /
  `packages/adapter/src/load-config.test.ts` (untracked, dev-server imports
  `@vesk/adapter/src/dev-config` — confirm whether a load-config module is actually
  needed/committed or leftover).
- Logs in `/tmp/opencode/`: `e2e-setup.log`, `devhyd2..devhyd8.log`, `build5..7.log`,
  `prod2.html`, `glob2.css`.

## Suggested next steps (in order)
1. **Kill the token-reuse hypothesis or prove it.** Add one trace inside
   `renderFullPage` (server-render.ts) gated by `VESK_SSR_TRACE`: log the token at entry
   (reused vs freshly generated), slot key count BEFORE merge, and `componentName`; add a
   dev-server log of `url.pathname` for the failing request correlated by time. Then run
   the FULL suite and watch what token the `/blog/hello-world` leak actually reuses and
   where `posts` entered it. (Fastest path now — all plumbing already in place.)
2. If not token reuse: instrument the client side of 18a (page.on('response') payload
   capture was inconclusive server-side) — or bisect the precondition by commenting out
   suite sections before TEST 18 (e.g. skip Test 12/13 SPA data-nav, skip /broken) until
   the leak stops, to identify the triggering section.
3. Independently fix the 6 runtime-export failures (verify `hydrateViewport`,
   `hydrateIdle`, `hydrateOnInteraction`, `collectVskMarkers`, `createHydrateWalker` exist
   in `packages/runtime/src/index-client.ts`; check adapter dev `buildRuntimeCode` export
   list; add missing re-exports) — likely a separate, simpler bug.
4. Re-run gates → expect 360/0 dev + 52/52 prod; then `node scripts/test.js`, typecheck.
5. Cleanup pass (section "Instrumentation added this session"), delete probe files, update
   TODO.md., and commit only if the user asks.