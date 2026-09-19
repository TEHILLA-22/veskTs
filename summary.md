# Vesk — handoff (Sep 19, layout-slot-contract session — PC verification COMPLETE + NEW HYDRATION REGRESSIONS FOUND)

> Slot fix is code-complete, unit-green, AND verified live on test-app. All servers UP.
> Full suite green 2848/2848. Hydration coverage re-added (TEST 24 + TEST 18 portal rows).
> **NEW**: vesk-doc dev server full-reload hydration has regressions on `/compiler`, `/docs`, `/showcase`.

## Final state (this box is a codespace, not the termux device)

- `npm run typecheck` clean. `node scripts/test.js` → **79 files, 2848 passed, 0 failed, exit 0**.
- `tests/hydration-test.mjs` → **434/434** (incl. new TEST 24 + TEST 18 portal entries re-added).
- No termux chromium here — `CHROMIUM_PATH=/tmp/opencode/chrome/chrome-headless-shell/linux-153.0.8010.52/chrome-headless-shell-linux64/chrome-headless-shell` (installed via `npx @puppeteer/browsers install chrome-headless-shell@stable`). production-hydration + code-split E2E pass with it.
- Servers running: `:3000`/`:3100` (test-app), `:4000` (vesk-doc), all 200.
- deps refreshed to fresh `0.2.28-ci.1789845…` tarballs (test-app + vesk-doc). vesk-doc tarballs updated in git; test-app tarballs gitignored.
- `slot-props.test.ts` stale SSR marker assertion fixed (only failure in the first full-suite run).

## Live-verified slot behavior (test-app + clean vesk-doc routes)

- `:4000/_vesk/runtime.js` has `createLayoutSlot`+`takeMarkers`; `:4000/docs` **0 tag-mismatch** (was 63→30x), header after reload + 2 nav clicks, Menu/X exactly-once, 3 copy icons persist, zero console/pageerrors.
- Warm-hit timing ≪ 2000ms (95–392ms) — **no VersionBadge framework fix needed**; badge bakes `v0.2.28` server-side, 0 `[object Promise]`. `VersionBadge.vsk` untouched.
- Portal SSR markers pair LIFO by id (`s3 [s1 [s2 …] s1] s3`); ids are a per-compile counter — new tests assert pairing, never a concrete id.

## NEW: vesk-doc hydration regressions on FULL RELOAD (SSR→hydrate)

Sweep of all vesk-doc routes (full reload + 3.5s settle) on `:4000`:

| route | footers | leftover `vsk:t:`/`vsk:c:` | `[vesk-hydrate]` warns | status |
|---|---|---|---|---|
| `/` `/native` `/features` `/vesk` | 1 | 0 | 0 | ❇ clean |
| `/docs/*` (getting-started, components, pipeline) | 1 | 0 | 0 | ❇ clean |
| `/compiler` | **0 — `<footer>` element vanished** (text floats in `<main>`) | 30 | 0 | ✗ |
| `/showcase` | 1 | 44 | **21 mismatch** | ✗ |
| `/docs` (index) | 1 | **255** | **63 mismatch** | ✗ |

**Critical finding (corrected)**: SPA navigation does NOT fully fix the broken routes — some routes still exhibit issues after SPA nav, and response times are severely degraded (800ms–10s) indicating deeper hydration/re-render problems. The "works after SPA nav" observation was incomplete.

Confirmed on test-app for contrast: dev `:3000` **and** prod `:3100` portal routes are both clean (0 warns, 0 leftover, toggle works). Persistent `if`/`map` comments and `vsk-slot:sN` pairs appear identically on clean test-app too — those are by-design residue, not defects.

### Symptoms match user report

- `/compiler` full reload: entire `<footer>` (links + `compiler v0.2.28` badge) disappears client-side — SSR contains it (1 `<footer>`, 1 `v0.2.28`), hydration drops it, and the `vsk-slot-end:s1` boundary marker is gone with it.
- `/docs` full reload: claim misses `<section>/<p>/<div>/<a>` (63 warns, "257 markers unconsumed skipped"), leaving 255 unclaimed keyed markers in the DOM.
- Earlier docs-probe "PASS" was blind: it only collected console **errors**; mismatches fire as **warnings**.

## Root cause investigation (in progress)

Reading `packages/runtime/src/hydrate.ts` (claim walker, typed markers `vsk:t:`/`vsk:c:`, `takeMarkers`, `reportMiss`) and `packages/compiler/src/server-jsgen.ts` (SSR marker emission, SlotNode, mapRegion keyed markers). Broken pages share repeated map-generated `<Link>` cards (`vsk:c:Link` typed markers) — claim appears to exhaust markers early, leaving tail unconsumed. `/compiler` also loses `slot-end` marker silently.

**Performance**: Severely degraded response times (800ms–10s) on broken routes after SPA nav, suggesting excessive re-renders or blocked event loop from leftover marker processing.

**Attempted fix**: Modified `packages/compiler/src/client-codegen.ts` `emitStatic` to retrieve pure static children from `__vsk_ssrEls` instead of calling `nextElement` (since SSR emits no marker for static children of dynamic parents). Client-codegen tests pass (281/281). However, dev server cache not fully cleared — fix not yet live on `:4001`.

Next: fully clear vesk-doc cache (`.vesk`, `node_modules/.cache`, browser), rebuild, restart, verify fix works on full reload. Then investigate why SPA nav doesn't fully resolve the issue and causes severe slowdowns (possible runaway effect re-registration from unclaimed markers).

## Next Move (this session continues)

1. Finish reading `hydrate.ts` claim path + `server-jsgen.ts` SSR emission.
2. Build minimal jsdom repro with exact `/compiler` SSR HTML.
3. Implement fix(es) in `hydrate.ts` / `layout.ts` / `server-jsgen.ts`.
4. Add regression coverage to `tests/hydration-test.mjs` (vesk-doc full-reload routes with footer/badge/icon assertions).
5. Verify live on `:4000` sweep → all green, then full suite `node scripts/test.js` → 2848/0.

## Relevant Files

- `/workspaces/veskTs/packages/runtime/src/hydrate.ts` — claim walker, typed markers (`vsk:t:`, `vsk:c:`), `reportMiss`, `devWarn`, `runInHydrateBlock`, `createHydrateWalker`, `insertDetachedSlotContent`.
- `/workspaces/veskTs/packages/runtime/src/layout.ts` — `createLayoutSlot`, `findSlotRange`, `takeMarkers`, `trackSlotContent`, `auditLayoutSlots`; slot boundary comments `<!--vsk-slot:sN-->`/`<!--vsk-slot-end:sN-->`.
- `/workspaces/veskTs/packages/compiler/src/server-jsgen.ts` — SSR marker emission for SlotNode, components, text, keyed maps; `nextVskId()` counter.
- `/workspaces/veskTs/tests/hydration-test.mjs` — TEST 24 layout-slot integrity; needs vesk-doc full-reload regression rows.
- `/workspaces/veskTs/vesk-doc/app/compiler/page.vsk`, `/docs/page.vsk`, `/showcase/page.vsk` — broken pages (repeated map + Link cards).
- `/tmp/opencode/sweep.mjs` — route sweep probe (run with `CHROMIUM_PATH=… node /tmp/opencode/sweep.mjs`).
- `/tmp/opencode/repro-icons.mjs` — icon/toggle/footer probe.
- `/tmp/opencode/client.js` — dev client bundle for `:4000`.

## Traps (learned this session)

1. Served `/_vesk/runtime.js` is a TREE-SHAKEN bundle built from the app's `node_modules` dist — `src`/`packages/dist` edits are invisible until `refresh-testapp-deps` + server restart. Always verify via `curl :PORT/_vesk/runtime.js | grep takeMarkers`.
2. `node scripts/refresh-testapp-deps.mjs <app>` hangs on `npm install` (>300s). Run with tool timeout `420000`.
3. Hydration mismatches fire as console **warnings** (`[vesk-hydrate]`), not errors — probes must capture `console.warn` to see them.
4. `vsk-slot:sN` / `if`/`map` boundary comments persisting in hydrated DOM is **by design** — present on clean test-app too. Only `vsk:t:`/`vsk:c:` (keyed) leftovers indicate real claim failures.
5. Dev server `:4000` serves single `client.js` (no code-split chunks) — so timing is NOT the cause; it's pure claim logic.