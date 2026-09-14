# Vesk — handoff (this session)

## Mission for the receiving session
1. **Fix the duplicate-node (= dup-render) hydration bug** using the handoff prompt
   written at **`/root/vesk/duplicate_node.md`** (probe + ground truth inside).
   Repro fixture: the nav/menu — including the "write → understand" tab row below the
   Hero — in the `vesk-doc` case-study app on `localhost:3000`. Client-probe evidence
   (`dup-probe.mjs`, run this session): **22 duplicate identical outerHTML blocks**,
   e.g. `8x <span class="text-muted-foreground"> ○ </span>`,
   `4x ...transition-colors group-hover:text-accent"> → </span>`, and leaf text nodes
   duplicated on `/` (`3x "Get Started"`, `3x "Vesk Native"`, `2x "features"`,
   `2x "showcase"`, ...). Root-cause lead: the NavLink client hydrator gate
   `if (__isHydrating) { a = hydrate.nextElement('a') ... }` in
   `packages/runtime/src/router-components.ts` — when the gate is false the fallback
   `document.querySelector(...)` leaves the inline `<!--vsk-->` markers unclaimed
   **and** re-creates/duplicates claimed node subtrees.
2. **Scope rule (AGENTS.md):** the fix + compiler/runtime must support **every
   `.vsk` / `.ts` / `.js` file anywhere under the project root `/root/vesk`, any
   directory depth (deep /root/vesk/vesk-doc-nested/…, /root/vesk/scripts/…, etc.)
   excluding `node_modules`, excluding nothing else.** Imports must resolve hot even
   from deep non-default locations, and hydration markers must be claimed for them
   identically to first-party routes.
3. Do the work, rebuild, restart, then prove: `node tests/hydration-test.mjs`
   **360 passed / 0 failed** and a re-run of `dup-probe.mjs` shows **0** duplicate
   identical outerHTML blocks on `/` and on `/store/widget`.

## Verified state right now (do not regress)
- `node tests/hydration-test.mjs` → **360 passed / 0 failed** (fresh run against the
  repo CLI on :3000, params fix bundled and live — `/store/widget` h1 = "Item: widget").
- The params-divergence fix is in at all three dev-server render sites
  (`packages/cli/src/dev-server.ts` — 1321/1362/1402 each pass `{ children: body, params: matched.params }`; grep `params }` → dev-server:6, action-handler:1) and the
  action-handler render site. **Do not remove.**
- Dev server is detached-running on :3000 (repo `packages/cli/build.ts` → CLI rebuild →
  `setsid` relaunch → networkidle0 suite green). HMR client bundle served by the repo

CLI.

## Environment how-to (Termux; no systemd)
```bash
cd /root/vesk
npx tsx packages/cli/build.ts            # rebuild CLI (any packages/cli/src edit requires this)
# kill stale :3000 by port, then detached-relaunch:
ss -ltnp | grep ':3000'                  # get old pid
kill <pid>; sleep 1
cd /root/vesk/vesk-doc
setsid node ../packages/cli/dist/cli.js dev > /tmp/veskdoc-dev.log 2>&1 < /dev/null &
for i in $(seq 1 30); do curl -sf -o /dev/null -m 2 localhost:3000 && break; sleep 1; done
CHROME_PATH=/data/data/com.termux/files/usr/bin/chromium-browser node ../dup-probe.mjs
node ../tests/hydration-test.mjs
```
Note: chromium-browser binary path for CHROME_PATH (not the stale /workspaces/... default);
puppeteer resolves from /root/vesk/node_modules.

## Artifacts
- `dup-probe.mjs` — duplicate-node/dub-render scout (drives real chromium, prints
  duplicate outerHTML blocks + duplicated leaf text counts + remaining hydration markers).
- `scripts/dup-fix-prompt.md` → archive of the same handoff (kept for reference); the
  canonical new file is `duplicate_node.md`.
- `/tmp/veskdoc-dev.log` — dev server log.
- Git is corrupted (`bad object HEAD`) — do not rely on `git diff/stash`; verify by
  grep + live probe (as above), and use the plain rebuild-restart loop.
