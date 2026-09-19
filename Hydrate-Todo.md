# Hydration Reliability — Todo

> **RULE: NO DUPLICATION, NO MISMATCH, 100% RELIABLE.**
> Every SSR element is adopted exactly once or explicitly removed. Every client
> element either adopts or is fresh-appended at a known anchor. Divergence is
> detected at the boundary where it happens, repaired deterministically, and
> reported structurally — never silent, never twinned.

## Status legend

- `[ ]` todo · `[~]` in progress · `[x]` done (unit + `tests/hydration-test.mjs` probe)

---

## Phase A — runtime-only (no compiler change)

### A1. Structured report + strict mode + twin scan `[x]`

Done: `auditHydration` (report), `onHydrationMismatch` hook, `setHydrateStrict`
(strict removes genuine orphans at audit time only), twin heuristic scan, all
miss paths funneled through `reportMiss` (hook always, dev-warn scoped as
before). 7 new `hydrate.test.ts` cases; 52/52 green, router 86/86 green.

**Problem:** `assertFullyHydrated` returns a boolean nobody checks, warns only in
dev, and scans markers — not elements. A missed claim twins (SSR node stays +
fresh node appended) with zero signal in prod.

**Fix (in `packages/runtime/src/hydrate.ts`):**
- New `auditHydration(container)` → `{ ok, unclaimed, twins, sample }`.
  `assertFullyHydrated` becomes a thin wrapper (keeps old signature).
- Twin scan (dev heuristic): adjacent same-tag siblings with identical text
  where exactly one carries `data-vsk-claimed` → reported as `twins`.
- New `onHydrationMismatch` hook + `setHydrateStrict(bool)`. Every miss path
  (tag mismatch, exhausted walker, leftover markers, double-adopt attempt)
  funnels through one `reportMiss(kind, detail)` that: repairs deterministically
  (see A2-policy below), calls the hook, dev-warns. Strict mode additionally
  removes orphan SSR nodes instead of leaving them beside fresh twins.
- Wire the hook + report into the dev Errors panel surface later (panel already
  lists HMR/SSR errors; hydration gets the same treatment).

**Accept:** `hydrate.test.ts` cases (miss calls hook with kind; strict removes
orphan; twins detected on synthetic twin DOM); hydration-test probe asserting
zero twins after full load + SPA navs.

### A2. Mismatch policy: never leave an orphan beside a fresh twin `[x]`

Done with A1: strict-mode repair at audit time only (claim-time removal would
steal elements from later owners). See A1.

**Problem:** `nextElement`/`claimOnly` fall back to `document.createElement`
while the unclaimed SSR element stays — the duplication primitive.

**Fix:** strict repair at **audit time, never claim time**: after a full pass,
any still-unclaimed marker plus its SSR element is a genuine orphan (every
owner had its chance — mid-walk removal would steal elements from later owners,
the `/store/widget` lesson) and strict mode removes both. Non-strict keeps
current adopt behavior but still reports through the hook (prod telemetry
without DOM change).

**Accept:** full pass leaves orphan marker+element → strict audit removes both
and reports `leftover-marker`; non-strict reports without touching DOM.

### A3. Deferred strategies: cancel-on-nav + liveness guards `[x]`

Done: `bumpNavEpoch` (router calls it on both navigate paths, incl.
back/forward which funnel through them); `batchAlive` (isConnected + epoch /
custom `isCurrent`) gates every viewport batch, idle chunk, and interaction
trigger; `hydrateViewport` returns thenable + `cancel()`; idle/interaction take
`{ isCurrent }`. 4 new tests; router suite green (epoch bump is additive).

**Problem:** `hydrateViewport` has no cancel handle; none of the three
strategies check `container.isConnected` or router nav token. Deferred work
firing after an SPA nav hydrates detached DOM (leaked effects, duplicate mounts).

**Fix:**
- `hydrateViewport` returns `{ cancel() }` (disconnect observer, drop held set).
- Every deferred batch starts with: `if (!container.isConnected) return;` plus
  an optional `isCurrent: () => boolean` token the router passes (nav token
  compare). Router cancels outstanding deferred work on navigation.
- `hydrateIdle` chunk loop checks liveness per chunk, not just per run.

**Accept:** navigate away mid-deferral → componentFn never runs for the dead
container; unit test with detached container; browser probe (throttled
viewport strategy + immediate SPA nav → zero pageerrors, zero twins).

### A4. Keyed global adopt + move `[x]`

Done: `claimByKey(key, { relocate: true })` adopts out-of-position keys and
moves them to the cursor (same-parent guard, whole-walk alias retirement);
`reconcileHydrated` restructured to claim-then-anchor (anchors placed after
moves, so moved nodes never escape the region) and always relocates. Divergent
order now preserves node identity instead of content-swapping. 3 new tests +
divergent test updated to identity semantics; 55/55 green.

**Problem:** `claimByKey` is positional-only; SSR↔client reorder renders fresh
items at the region tail while SSR twins rot (canary reports ghosts).

**Fix:** `claimByKey(key, { relocate: true })`: fall back to the global
`peekKey` scan on positional miss, adopt wherever found, `parent.insertBefore`
to correct position. Fresh-at-tail only when the key truly has no SSR node.

**Accept:** SSR order 1-2-3, client order 3-2-1 → same 3 nodes adopted + moved,
zero fresh, zero ghosts; reconcile mutations unchanged.

### A5. SSR text as initial snapshot (no empty windows) `[x]`

Done: runtime stashes concatenated direct text as `__vsk_ssrText` on every
claim-strip; hydrate codegen initializes a *sole* reactive dynamic text child
from it (`?? ''` keeps fresh-node behavior). Multi/mixed text keeps the empty
initial (no blob to split). Missed effect → stale visible text, never empty,
never doubled. Codegen tests in both body modes + stash unit tests; 281/281
client-codegen, 57/57 hydrate green.

**Problem:** `stripDirectTextNodes` drops SSR text trusting the client effect to
recreate it; a missed effect = present element with vanished text (empty-h1 class).

**Fix:** preserve the SSR text node value as the binding's initial value; the
first reactive change replaces it. Missed effect degrades to *stale* text
(visible, debuggable), never empty, never doubled.

**Accept:** claim with non-running effect → SSR text intact; effect run →
updated once, single text node.

---

## Phase B — compiler + runtime (marker identity)

### B1. Typed markers `[x]` — extended: ALL markers keyed, no bare markers

Extension: static-subtree markers now `<!--vsk:t:tag-->`, `Link` self-prefix
`<!--vsk:c:Link-->` (was the last bare emitter). Walker asserts `t:` identity
on adopt (`marker-skew` on SSR/parser drift), reports bare adoptions as
`untyped-marker`, audit flags bare leftovers explicitly. Verified live: `/`
serves 47 markers, zero bare. 372/372 hydration suite green on the keyed build. — extended: ALL markers keyed, no bare markers

Extension: static-subtree markers now `<!--vsk:t:tag-->` (was bare); single
bare emission site eliminated. Walker asserts `t:` identity on adopt
(`marker-skew` on SSR/parser drift), reports bare adoptions as
`untyped-marker`, audit flags bare leftovers explicitly. Vacuous-async `it`
harness in cli.test fixed (was passing without awaiting); removed 2 dead
`bin/vesk --ssg` tests (binary/flag don't exist) and corrected SSG marker
assertions to real behavior + dynamic typed case.

Done: component boundaries emit `<!--vsk:c:Name-->` (one site, `--`-guarded
without regex); static-subtree markers stay bare. Walker parses identity
(`isVskMarkerText`/`parseVskMarker`, `vesk-ssr-error` excluded), stores it per
marker, and names it in backoff reports, fallback reports, and audit orphan
lists (live tag included for bare markers). 4 unit tests; 4 server-codegen
assertions updated to typed output + 3 new B1 server tests (both body modes);
browser-test marker regexes widened to `<!--vsk(--|:)`; docs updated.

**Problem:** bare `<!--vsk-->` forces positional claiming; first divergence
cascades page-wide with no identity of what was expected where.

**Fix:** server codegen emits `<!--vsk:Component:slot:seq-->` (component + slot
+ per-parent sequence; exact shape in `server-jsgen.ts`, one place). Walker
parses identity, asserts slot match on claim; mismatch reports
`expected X @ seq N, found Y` at the exact boundary. Old bare markers still
accepted (back-compat: unknown identity = positional as today).

**Accept:** both body modes (statement/expression) emit typed markers;
server-codegen tests lock shape; walker unit tests (slot-mismatch reported,
not cascaded); full hydration suite green.

### B2. Idle single-shot (per-chunk re-invocation removed) `[x]`

Done — stronger than planned: per-chunk full re-invocation is irreparable
without codegen yields (every run twins out-of-chunk content + double-registers
effects), so `hydrateIdle` waits for the first idle window, runs ONCE with a
full walker, asserts, and stops. `chunkSize` reserved for future yield support.
Cancel + liveness (A3) preserved. Tests rewritten to single-shot semantics.

**Problem:** `hydrateIdle` re-invokes the whole `componentFn` per chunk; every
run outside its chunk misses → fresh nodes. Correctness depends on re-run
convergence.

**Fix:** one walker, suspended at chunk boundaries, resumed on next idle
callback. Component renders once; claims stream in over time.

**Accept:** idle-hydrated page: single component invocation, all markers
claimed, zero fresh nodes; existing idle tests updated.

### B3. subWalker ownership transfer `[x]`

Done: child markers spliced out of the parent walk (exactly one owner per
marker); cursor clamped, no `idx += count` drift. 2 transfer tests; nested
suites green.

**Problem:** parent advances cursor by filtered count (`idx += len`) assuming
document order == marker order, while two engines share the same comment
objects.

**Fix:** splice the child's markers out of the parent list — exactly one engine
owns each marker. Cursor arithmetic disappears; `retireDetached` parent sweeps
for this case go away.

**Accept:** nested-layout + out-of-order SSR probes unchanged-or-better;
walker unit tests for transfer (parent done-state consistent after split).

---

## Final regression (all items)

- `node scripts/test.js`: **78 files, 2831 passed, 1 failed** — the single
  failure is `hmr-perf` compile-mean budget (55ms) flipping 53.8/59.8/54.6
  across runs on this box. Proven unrelated: that benchmark compiles normal
  mode (`forceClient`, no `hydrate`), where the A5 filter is now fully gated
  off (zero added work). Environmental noise at the threshold, not a code
  regression.
- `BASE='http://localhost:3100' node tests/hydration-test.mjs`: **372/372**
  with every item live (typed markers, relocate, snapshot init, epoch guards).
- `npm run typecheck`: clean across types/compiler/runtime/adapter/plugin-pwa.

## Verification contract (every item)

1. `npx tsx packages/runtime/src/hydrate.test.ts` green.
2. `npm run typecheck` clean; barrels export new APIs (`index-client.ts`).
3. `BASE='http://localhost:3100' node tests/hydration-test.mjs` green (needs
   test-app dev server + default chromium).
4. New behavior covered in BOTH statement and expression body modes where
   component rendering is affected.
