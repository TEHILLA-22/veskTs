# Vesk — handoff (Sep 19, layout-slot-contract session)

> PC-continue brief. All servers DOWN at handoff (`000` on `:3000/:3100/:4000`).
> Slot fix is code-complete + unit-green but NOT yet verified live.

## State

- Accidental revert wiped tracked slot work; re-applied from scratch. Untracked
  files survived: `test-app/app/portal/`, `packages/runtime/src/layout.ts`,
  `packages/runtime/src/layout.test.ts`.
- `tests/hydration-test.mjs` TEST 24 (portal) + TEST 18 portal routes were lost
  in the revert — NOT re-added (servers down, can't verify). Spec in "Next" §6.
- `test-app/app/layout.vsk` Portal nav link + `test-app/llms.txt` portal rows
  re-added (route-inventory rule).
- `VersionBadge.vsk` is original (`timeout:10000, retry:1`, direct await).
  Do NOT edit it — framework fix must make the original fast + non-fatal.

## What changed (this commit)

- `packages/compiler/src/server-jsgen.ts`: `SlotNode` emits
  `<!--vsk-slot:sN-->` … `<!--vsk-slot-end:sN-->` (`nextVskId`, exact-id pairing).
- `packages/compiler/src/client-codegen.ts`: hydrate `SlotNode` emits
  `createLayoutSlot(walker, parent)` + `props.children(__slot.walker)` +
  `__slot.track(promise)`; `createLayoutSlot` added to hydrate runtime names.
- `packages/runtime/src/layout.ts` (new): `findSlotRange` (subtree
  TreeWalker, nesting-depth-aware open/close pairing, exact-id match),
  `createLayoutSlot` (`takeMarkers` transfer + scoped walker + async anchor),
  `trackSlotContent` (insert before slot-end; drop if detached),
  `auditLayoutSlots` (balance + leftover-in-slot). Depth-0 markers only —
  nested interiors stay with inner scope.
- `packages/runtime/src/hydrate.ts`: `HydrateWalker.takeMarkers` (decl +
  `WalkerEngine` impl + child-walker stub), `reportHydrationIssue`.
- `packages/runtime/src/index-client.ts`: export layout contract fns + types,
  `reportHydrationIssue`.
- `packages/runtime/src/router.ts`: `auditLayoutSlots` after
  `renderLayoutChain(0)(walker)` (full strategy only, never throws).
- Tests: `layout.test.ts` (new, 12), client-codegen slot tests rewritten to
  boundary-walker contract (both modes), server-codegen slot test asserts
  paired boundaries without pinning `sN`.
- Fixture: `test-app/app/portal/` (async layout/page/footer+badge, nested
  `guides/`), root nav + `llms.txt` rows.
- `vesk-doc` repinned to `0.2.27-ci.1789840853735` tarballs (old `0.2.25` set
  deleted). test-app pins untouched (refresh aborted).

## Verified green

- `layout.test.ts` 12/12, `hydrate.test.ts` 68/68, `router.test.ts` 86/86,
  `client-codegen.test.ts` 281/281, `server-codegen.test.ts` 165/165.
- `npm run typecheck`: NOT confirmed (output cut) — re-run on PC.
- Live probes: NOT re-run (servers down). Last known: `:3000/portal` +
  `:3100/portal` clean (`foot 1 / all 2 / vsk 0`); `:4000/docs` had
  `63→30x tag-mismatch (257 markers unconsumed skipped <!--vsk:t:h2-->)`.

## Traps (learned hard)

1. Served `/_vesk/runtime.js` is a TREE-SHAKEN bundle built from the app's
   `node_modules` dist — `src`/`packages/dist` edits are invisible until
   `refresh-testapp-deps` + server restart. Always verify via
   `curl :PORT/_vesk/runtime.js | grep takeMarkers`.
2. `node scripts/refresh-testapp-deps.mjs <app>` hangs on `npm install`
   (>300s). Run with tool timeout `420000`.
3. `pkill`/`pgrep` often hang 10–120s. Kill by explicit PID, restart with
   `setsid nohup npx vesk dev -p PORT` from the APP dir (repo root →
   `no app/ directory`), cold start 60–90s.
4. Only `/data/data/com.termux/files/usr/bin/chromium-browser` works;
   `/usr/bin/chromium` is dead. Hydration tests need `CHROMIUM_PATH` + test-app
   dev on `:3000`.
5. `npm run dev -p 3000` does NOT forward `-p` (`test-app/package.json`
   `dev: "vesk dev"`). Use `npm run dev -- -p PORT` or `npx vesk dev -p PORT`.

## Next (PC order)

1. `npm run typecheck` (repo root).
2. `node scripts/refresh-testapp-deps.mjs test-app`, then `... vesk-doc`
   (each ~2–5 min, timeout 420000).
3. Restart `:3000` (test-app), `:3100` (test-app), `:4000` (vesk-doc) from app
   dirs; wait ~90s; `curl` each `/` → 200.
4. `curl :4000/_vesk/runtime.js | grep -c takeMarkers` → expect ≥2; probe
   `:4000/docs` → expect 0 `tag-mismatch`, header visible after reload + 2
   nav clicks, Menu/X + copy icons persist, no `Maximum update depth`.
5. Warm-hit `curl` timing per route (cold compile ~4–9s is normal in dev;
   judge the SECOND hit vs 2000ms). If `VersionBadge` registry fetch still
   blocks every SSR: framework fix WITHOUT touching `VersionBadge.vsk` —
   candidates: honor `staleTime` server-side across dev SSR requests
   (`packages/runtime/src/resource.ts:479` cache is client-only), and/or
   isolate async-child throw so `Footer` can't 500 the page.
6. Re-add lost browser coverage to `tests/hydration-test.mjs`: TEST 18 add
   `/portal`, `/portal/guides` to `FULL_ROUTES` + `DATA_ROUTES` + `SPA_TEXT`
   (`'Portal posts'`, `'Guides layout'`) + 18d `['/portal',1]` +
   `['/portal/guides',1]`; new TEST 24 layout-slot integrity — 24a SSR
   `vsk-slot:<id>` open/close pairing via `fetch`; 24b full load single
   `portal-nav`/`portal-main`/`portal-footer`, order nav<main<footer, columns
   exactly once, author 1x, badge 1x, zero `vsk` markers; 24c mobile-menu
   toggle exactly-once; 24d SPA `/portal`→`/portal/guides` single nested
   chrome; 24e hard reload on guides; 24f SPA back. Then
   `CHROMIUM_PATH=… node tests/hydration-test.mjs`.
7. Full suite only at the end (`node scripts/test.js` builds first — not for
   iteration).

## Left untracked intentionally

- `emr/` (other scratch app), `tmp/repro-*.ts` (scratch) — not ours, do not commit.

---

# Vesk — handoff (active session, Sep 16)

## Objective

Make wrapper-free hydration work on full refresh / SPA navigation, and fix hydration regression that caused `HierarchyRequestError` from Lucide icons and stray `Link` fallback rewiring. Verify `effect()` works in both expression and statement mode and pass the hydration gate `tests/hydration-test.mjs`.

## What's working and verified

**SSR is correct.**
- `/` returns HTTP 200, **0 × `[object Promise]`**, **3 × `v0.2.25`** baked into
  server HTML (hero label, pipeline spot, footer).
- `/docs/components` returns HTTP 200, **0 × `[object Promise]`**, **1 × `v0.2.25`**
  baked (footer only).

**Client hydration is clean — no appendChild errors.**
- The original client bug (`Failed to execute 'appendChild' on 'Node': parameter 1 is
  not of type 'Node'`) is fixed. Probe (monkeypatched `appendChild`/`insertBefore`)
  shows zero `BAD-APPEND`/`BAD-INSERT` console errors, zero pageerrors, on both `/`
  and `/docs/components`.
- `BADGE: 3` on `/`, `BADGE: 1` on `/docs/components` — badge text is live in DOM.

**Badge content is correct on the client (second spot + footer).**
- Pipeline spot (`<span class="flex items-center gap-1.5">`): caret dot then badge,
  correct order, no spacing issue.
- Footer (`compiler <VersionBadge />`): "compiler v0.2.25" — correct.

## What's NOT working — the hero label ordering bug

The hero label renders as `v0.2.25compiler-first framework · ` on the client — the badge
comes **before** the label text, missing the "· " separator visually (though the text
node technically contains it, it follows the badge in DOM order).

**SSR HTML (correct order):**
```
<span class="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
    compiler-first framework · 
    <!--vsk-->
    <span style="display:contents">
        <!--vsk-->
        <span>v0.2.25</span>
    </span>
</span>
```
(Text node first, then badge wrapper — verified via `curl` + `grep`.)

**Client post-hydration DOM (WRONG order):**
```
<span class="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground" data-vsk-claimed>
    <span style="display:contents" data-vsk-claimed>
        <span data-vsk-claimed>v0.2.25</span>
    </span>                                ← badge FIRST
    compiler-first framework ·            ← text SECOND (single node, no duplicates)
</span>
```
(Verified via puppeteer `evaluate` dumping `childNodes` of the label span.)

**Generated hydrate code for this label** (`page-index-new.js:57614-57626`):
```js
// claim the label span
const $n5 = __hydrate.nextElement("span");
$n5.setAttribute("class", "font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground");

// text node — FRESH, not claimed in place
const $n6 = document.createTextNode("compiler-first framework \xB7 ");
if ($n6.parentNode !== $n5) {
  if (!$n5 || $n6.parentNode == null || !$n5.contains($n6)) $n5.appendChild($n6);
}

// badge — awaited, claimed in place via subWalker
const $n7 = await __hydrators["VersionBadge"]({}, __registry, __hydrate.subWalker(__hydrate.nextElement()));
if ($n7.parentNode !== $n5) {
  if (!$n5 || $n7.parentNode == null || !$n5.contains($n7)) $n5.appendChild($n7);
}
```

**Hydration claim path for VersionBadge** (`page-index-new.js:57392-57421`):
```js
__hydrators["VersionBadge"] = async (props, __registry, __hydrate) => {
  const $root = __hydrate.root;                      // claimed span wrapper
  let __pendingChild = null;
  const latest = await useFetch.json(/* ... */);      // AWAIT — fetches client-side
  const $n0 = __hydrate.nextElement("span");          // claims inner <span>v0.2.25</span>
  const $n1 = document.createTextNode("v");
  // ... claim/append text nodes into $n0 ...
  if ($n0.parentNode !== $root) { $root.appendChild($n0); }
  return __pendingChild || $root;
};
```

**Hypothesis:** During the async `await useFetch.json(...)` in the badge hydrate fn,
the subWalker is suspended. After the await, `nextElement("span")` either claims a
different span (because the walker cursor wasn't positioned correctly across the await)
or the `display:contents` wrapper gets repositioned during the claim. The label's
text node is created fresh and appended at END — if the badge wrapper was already
claimed/repositioned first (or moved during the async gap), the append ends up
badge-before-text. The `<!--vsk-->` comment markers (SSR claim anchors) are all gone
from the post-hydration DOM, meaning the entire label's children were rebuilt or
reclaimed, not left in place.

**Second pipeline spot is correct** — same badge code but inside
`<span class="flex items-center gap-1.5">` where the text before it is just the
`<span class="size-1.5 bg-accent caret"></span>` dot, which is an ELEMENT (claimed by
`nextElement`), not a text node (created fresh via `createTextNode`). This suggests the
ordering bug specifically affects mixed text-node + async-component children where the
text is recreated (not claimed in place).

**Key probe files** (all in `/tmp/opencode/scroll-test/`):
- `probe-badappend.mjs` — monkeypatches `appendChild`/`insertBefore`, catches non-Node
  values, logs BAD-APPEND/BAD-INSERT + `console.error` + pageerror. Clean now.
- `probe-label.mjs` — dumps label span's `childNodes` types and text for the badge area.
- `probe-dom.mjs` — finds all elements whose `textContent` includes `v0.2.25`.

Run with: `node /tmp/opencode/scroll-test/probe-*.mjs http://localhost:3000/`
Requires: `ln -s /root/vesk/node_modules /tmp/opencode/scroll-test/node_modules`
(all symlinks already exist).

---

## display:contents wrapper — what it is, why NOT to strip it

Every component boundary in SSR emits `<!--vsk--><span style="display:contents">`
(`server-jsgen.ts:42`, `HYDRATE_COMPONENT_WRAPPER`). This is the hydration walker's
claim anchor — it tells the runtime "the next element is a component root; claim it
here." Removing it globally would break hydration for every component child
(`server-codegen.test.ts:1436-1491` has multiple tests asserting the wrapper exists;
`hydrate.ts:300` depends on the marker+wrapper pattern). The wrapper itself is
`display:contents` — it takes no layout space — so the visual issue is the claim-ORDER
bug, not the wrapper itself.

**User request:** "get rid of display content here" — this can only be done safely
by fixing the underlying claim-order bug (badge lands before text), or by removing the
wrapper per-component (not currently possible without a framework option). Do not strip
`HYDRATE_COMPONENT_WRAPPER` without fixing hydration claiming first.

---

## Async parent rule — confirmed, Layout DOES need async

**The rule (user-stated):** to render an async component, the parent must be async.
This propagates up the entire tree.

**Why this is necessary:**
- *Server:* `server-jsgen.ts:431-448` — `componentCallToJS` only awaits a child
  call (`awaitKw = 'await '`) when `isAsync` is true for the *parent* (not the
  child). If the parent is sync, it pushes the child's Promise directly into
  `__out` → `[object Promise]`.
- *Client (after our fix):* `client-codegen.ts:647` — now `awaitKw = ctx.isAsyncScope
  ? 'await ' : ''` (parent-driven). If the parent is sync, it calls the async child
  without await → `appendChild(Promise)` → "parameter 1 is not of type Node".
- *Same-file guard:* `ir-generator.ts:1224-1233` — throws `asyncChildInSyncParent`
  for same-file violations, but does NOT catch cross-file imported async children.

**Verified component chain in vesk-doc:**
```
VersionBadge  (async — await useFetch)
  ↑ called by
Footer        (async — direct child of VersionBadge)
  ↑ called by
Layout        (async — renders <Footer />, line 21)
DocsLayout    (async — renders <Footer />, line 27)
Home          (async — renders <Hero />, which renders VersionBadge)
Hero          (async — renders <VersionBadge />, lines 14 + 61)
```

Layout `async` is REQUIRED because it calls Footer. docs/layout `async` is required
for the same reason. De-async-ing any ancestor reintroduces `[object Promise]` on
SSR and appendChild errors on client. This is by design, not over-engineering.

---

## The compiler fix — client-codegen parent-driven await

**File changed:** `packages/compiler/src/client-codegen.ts:647`

**Before (broken for cross-file):**
```ts
const awaitKw = ctx.asyncComps.has(node.componentName) ? 'await ' : '';
```
Only awaits a child if its name is in the per-file `asyncComps` set (computed from
`computeAsyncComponents` which only sees same-file declared-async components).
Cross-file imported async children (VersionBadge from Hero) were NOT awaited →
Promise appended.

**After (mirrors server semantics):**
```ts
const awaitKw = ctx.isAsyncScope ? 'await ' : '';
```
Awaits every child whenever the *parent's* scope is async (`ctx.isAsyncScope` is set
at `client-codegen.ts:1528` from `comp.isAsync || asyncComps.has(comp.name)`). This
matches the server emission (`server-jsgen.ts:431-448` where `awaitKw = isAsync`).

**Tests added:** `packages/compiler/src/client-codegen.test.ts` — two new tests in
the `Async Components` describe block:
- `[normal] async parent awaits every child, even one whose own file is not compiled here`
- `[hydrate] async parent awaits imported child in hydrate mode`

Both prove the parent-driven property: a SYNC child called from an async parent
generates `await __components["SyncChild"]` (previously would NOT have been awaited).

**Rebuild required after compiler source edits:** `npx tsx packages/cli/src/build-packages.ts`

**Test result:** 247 passed, 0 failed.

---

## useFetch API review

### Surface

```ts
useFetch<T>(urlOrFn: string | (() => Promise<T>), options?): Resource<T>
useFetch.json<T>(url, options?): Resource<T>
useFetch.text<T>(url, options?): Resource<T>
useFetch.arrayBuffer<T>(url, options?): Resource<T>
useFetch.stream(urlOrFn, options?): Resource<string>
```

`Resource<T>` extends `PromiseLike<T>` with `.loading`, `.error`, `.data`, `.refresh()`,
`.abort()`, `._state` (internal `Tracked`).

### How it works

- `key` option (or URL string as default key) — deduplicates across instances on the
  same page (same key = same in-flight fetch).
- On the server: `useFetch` starts the request, SSR data is written to a per-request
  sink/slot (`setSsrData`), then `resolveSsrResources()` snapshots it into a
  `__vsk_ssr_data` script tag. On the client, `getSsrData(key)` hydrates the Resource
  immediately without re-fetching.
- `into?: Tracked<T>` — streams the result into a tracked cell; useful for streaming
  (`useFetch.stream`) or reactive bindings without `await`.
- `staleTime`, `retry`, `retryDelay`, `timeout`, `enabled`, `dedupe` — standard
  fetch-resource options.
- `Resource<T>` is `PromiseLike` (has `.then`) — `await useFetch.json(...)` returns the
  resolved data directly (the `toData()` accessor unwraps the internal state).

### User-friendliness assessment

**Easy parts:**
- `await useFetch.json<T>(url)` is straightforward and familiar (mirrors SWR/TanStack
  Query mental model).
- `key` deduplication is automatic and sensible.
- `staleTime` + `retry` + `timeout` are well-known options.
- `.loading` / `.error` / `.data` on the accessor are intuitive for loading states.

**Confusing/complex parts:**
- **PromiseLike vs Promise:** `Resource<T>` is NOT a true `Promise` — it's
  `PromiseLike` (has `.then` but no `.catch`/`.finally`). `await resource` works but
  `resource.catch(...)` doesn't compile. Surprising if you expect Promise behavior.
- **`into` cell pattern:** requires understanding of the reactivity system (`const
  &[x] = track('')` + `into: x`) — not discoverable without reading runtime internals.
- **SSR hydration implicitness:** the data handoff happens behind the scenes via
  `globalThis.__vsk_ssr_data`. If the key changes or the fetch runs in a different
  scope, the handoff silently fails and the client re-fetches. No warning.
- **`useFetch` vs `useFetch.json`:** `useFetch` accepts a URL string *or* a fetcher
  function. The string form auto-creates a fetcher (via `createFetcher`), but if you
  pass a function, you lose `timeout`/`retry`/`dedupe` behavior unless you implement
  them yourself. The relationship between `useFetch(url)` vs `useFetch(() =>
  fetch(url).then(r => r.json()))` is not obvious.
- **`enabled: false`** — sets data to `undefined` without any indication. Unlike TanStack
  Query's `enabled`, there's no `fetchNextPage` or retry-on-enable. The user must call
  `.refresh()` manually.
- **Streaming (`useFetch.stream`):** re-evaluates the URL function per fetch; `into` is
  progressive; `onChunk` gives raw chunks. Powerful but the `urlOrFn` + `into` + `onChunk`
  triad requires reading runtime source to understand. No JSDoc explaining when `urlOrFn`
  is re-evaluated vs cached.

### JSDoc quality

- `Resource<T>` interface: **no JSDoc** on `.loading`, `.error`, `.data`, `.refresh()`,
  `.abort()`.
- `UseFetchOptions<T>`: only `into` has a JSDoc comment (`/** Target tracked cell — ...`).
  All other options (`key`, `staleTime`, `keepPreviousData`, `retry`, `retryDelay`,
  `timeout`, `enabled`, `dedupe`) have **zero documentation**.
- `useFetch` function: **no JSDoc** at all. No description of `key` deduplication, no
  note about the server/client handoff, no note about `PromiseLike` vs `Promise`.
- `useFetch.stream`: has a 5-line JSDoc (the best in the file) explaining `into`,
  `onChunk`, and re-evaluation semantics.
- `HttpError` / `TimeoutError`: no JSDoc (trivial classes, acceptable).
- `createResource`: no JSDoc (internal, acceptable if `useFetch` is the public API).

**Bottom line:** the API surface is clean and intuitive for the happy path
(`await useFetch.json(url)`). The confusing parts are: (1) `PromiseLike` vs `Promise`
gotcha, (2) no JSDoc on `UseFetchOptions` fields or `useFetch` itself, (3) the
`into` streaming pattern requires reactivity knowledge, (4) the server/client
handoff is implicit and undocumented.

---

## Repo state — uncommitted changes (to commit on `bug` branch)

```
 M packages/compiler/src/client-codegen.ts        ← parent-driven await fix
 M packages/compiler/src/client-codegen.test.ts   ← 2 new async tests
 M vesk-doc/app/components/Footer.vsk             ← import + async
 M vesk-doc/app/components/Hero.vsk               ← import + async
 M vesk-doc/app/docs/layout.vsk                   ← async + render Footer
 M vesk-doc/app/layout.vsk                        ← async
 M vesk-doc/app/page.vsk                          ← async (no useFetch)
 M vesk-doc/package.json                          ← refreshed tarball pins
 M vesk-doc/package-lock.json
 D vesk-doc/tarballs/*-0.2.24-ci.1789529935608.*  ← old tarballs
?? vesk-doc/app/components/VersionBadge.vsk       ← NEW component (live from npm)
?? vesk-doc/tarballs/*-0.2.24-ci.1789536357382.*  ← fresh tarballs (fixed CLI)
```

## Environment & commands

**Dev server (running now):**
- PID: found via `ps aux | grep "vesk dev" | grep -v grep`
- CWD: `/root/vesk/vesk-doc`
- Log: `/tmp/opencode/vesk-dev.log`
- Restart: `cd /root/vesk/vesk-doc && setsid node node_modules/.bin/vesk dev > /tmp/opencode/vesk-dev.log 2>&1 < /dev/null &`
  (must use `setsid` — without it, the tool's timeout kills the background process)

**Refresh vesk-doc deps after compiler/runtime source changes:**
```bash
npx tsx packages/cli/src/build-packages.ts           # rebuild dist/
node scripts/refresh-testapp-deps.mjs vesk-doc        # repack tarballs + npm install
# then restart dev server
```
Current tarball pins: `0.2.24-ci.1789536357382` (vesk-doc refreshed; test-app NOT
refreshed — its pins are still the older `1789529935608` set).

**Compiler tests:**
```bash
npx tsx packages/compiler/src/client-codegen.test.ts   # 247 passed, 0 failed
npx tsx packages/compiler/src/server-codegen.test.ts
npx tsx packages/compiler/src/integration.test.ts
npx tsc --noEmit -p packages/compiler/tsconfig.json     # typecheck
```

**Runtime tests (per runtime AGENTS.md):**
```bash
cd packages/runtime && npx tsx src/track.test.ts
cd packages/runtime && npx tsx src/resource.test.ts
cd packages/runtime && npm run build && npm run typecheck
```

**Production hydration gate:**
```bash
VESK_E2E=1 node tests/production-hydration-test.mjs
```
Needs test-app on `:3002` (dev) / `:3009` (prod) + `CHROMIUM_PATH` env.
Currently test-app deps NOT refreshed — cannot run this gate without refreshing.

**Chromium:** `/data/data/com.termux/files/usr/bin/chromium-browser` (termux)

**Probes:** `/tmp/opencode/scroll-test/` — all need
`ln -s /root/vesk/node_modules /tmp/opencode/scroll-test/node_modules` (already exists).

---

## Next steps

### 1. Fix the hero label ordering bug (the remaining blocker)

The label badge renders before the text on the client after hydration. Debug path:

**A. Verify SSR HTML matches expectation.**
Already confirmed: text first, badge second. SSR is correct.

**B. Trace the walker position across the `await` in the badge hydrate fn.**
The badge hydrate fn (`__hydrators["VersionBadge"]`) does `await useFetch.json(...)`
BEFORE calling `nextElement("span")`. The subWalker created by the parent
(`__hydrate.subWalker(__hydrate.nextElement())`) should hold its cursor, but the
`await` may cause the walker to be recreated or repositioned. Instrument the runtime
`hydrate.ts` `nextElement()` / `subWalker()` to log the current walker position and
the element being claimed.

**C. Test with a sync badge (remove `await useFetch`).**
Temporarily make VersionBadge sync (no useFetch, just `<span>v0.2.25</span>`) to
confirm the ordering is correct when there's no async gap. If order is correct →
the bug is specifically about async claim ordering in subWalker across await.

**D. Check if `__hydrate.root` is the right element.**
In `__hydrators["VersionBadge"]`: `const $root = __hydrate.root` — what is this?
It's the walker's root for the subWalker. If the subWalker was created from the
label's position, `$root` should be the `<span style="display:contents">` wrapper
that SSR emitted for the VersionBadge component boundary. If `$root` is somehow
the label span itself, the claim logic would reparent nodes incorrectly.

**E. Look at `hydrate.ts` subWalker implementation.**
`packages/runtime/src/hydrate.ts` — find `subWalker` and trace how the cursor is
preserved/split. The test at `hydrate.test.ts:343-420` tests `display:contents`
wrapper claiming — read it for expected behavior.

**F. Compare the generated hydrate code for the FOOTER badge (which works) vs
the HERO badge (which doesn't).**
Footer badge (`page-index-new.js:62023`): `await __hydrators["VersionBadge"]({}, ...)`.
Hero badge (`page-index-new.js:57620`): same call. But the PARENT context differs:
Footer wraps badge in `<span>compiler <VersionBadge /></span>` (text THEN badge
element, adjacent siblings). Hero wraps badge in
`<span>compiler-first framework · <VersionBadge /></span>` (text then badge, with a
`<!--vsk-->` comment marker in SSR between them). The comment marker may be the
claim-positioning key — check if `nextElement` skips comments or if `<!--vsk-->`
between text and element affects cursor state.

### 2. Consider simplifying the async chain

If the label ordering bug is deep in the hydration walker, a quick workaround:
make VersionBadge NOT `async`, remove `await useFetch`, and fetch the version via a
simple `useFetch` (ssrAwait mode) + render via `into: versionCell` where
`const &[version] = track('')`. This makes the component sync on the client (no async
claim ordering), while the server still bakes the data. The cost: the component body
becomes reactive-imperative instead of declarative. Evaluate whether this tradeoff is
acceptable.

### 3. Run the full verification suite

After the label-order fix:
1. `npx tsx packages/compiler/src/client-codegen.test.ts` — 247+ passed
2. Probe: `node /tmp/opencode/scroll-test/probe-badappend.mjs http://localhost:3000/`
   — zero errors, BADGE: 3, label text reads `compiler-first framework · v0.2.25`
3. `node /tmp/opencode/scroll-test/probe-label.mjs` — label `childNodes` order is
   [TEXT:"compiler-first framework · ", EL:badge-wrapper]
4. Refresh test-app deps + run production hydration gate (per AGENTS.md requirement
   for reactivity/hydration changes)
5. Commit to `bug` branch with message describing the label-order fix

### 4. JSDoc for useFetch (nice-to-have)

Add JSDoc to `packages/runtime/src/resource.ts`:
- `UseFetchOptions<T>` fields: document `key`, `staleTime`, `keepPreviousData`,
  `retry`, `retryDelay`, `timeout`, `enabled`, `dedupe`
- `useFetch` function: describe the two forms (URL string vs fetcher function),
  key deduplication, server/client handoff, PromiseLike behavior
- `Resource<T>` interface: document `.loading`, `.error`, `.data`, `.refresh()`,
  `.abort()`

---

## Prior session context (carried forward)

- Scroll-on-refresh fix committed+pushed (`e68cd03` → origin/main, repo
  `github.com/emeraldlinks/veskTs`).
- `.vsk` is a superset of TypeScript; `useFetch` is auto-imported (compiler
  auto-importable list).
- `scripts/AGENTS.md` / `packages/runtime/AGENTS.md` / `packages/compiler/AGENTS.md`
  all extend root `AGENTS.md` — read both when touching those areas.
- TODO.md is the living task tracker — current focus: "hydrate-mode loop claiming,
  async page 500" (the label-order bug may be related to hydrate-mode loop claiming).
