# Handoff prompt — fix the duplicate-node (dup-render) bug in the vesk tree

> The previous session's core mission (hydration/HMR) is **done and green**: the repo CLI
> serving `vesk-doc` passes the full suite (`node tests/hydration-test.mjs` →
> **360 passed / 0 failed**). The params divergence bug is fixed (root cause: SSR dev-server
> layout render sites dropped `params`; now `{ children: body, params: matched.params }` at
> all dev-server sites). DO NOT regress that.

## The remaining bug you must fix now: duplicate nodes on client render
On every page, the client DOM contains **duplicate identical nodes**. Reproduced against
the live `vesk-doc` app on `:3000` (probe: `dup-probe.mjs` in repo root):

- **22 duplicate identical outerHTML blocks**, including the smoking gun:
  - `2x  <meta charset="utf-8">` and `2x  <meta name="viewport" ...>` — the
    **`<head>` is being rendered twice** (duplicated head content).
  - `2x` duplicate `<path>` chunks, `2x  <div class="mx-auto h-5 w-px ...">`, etc.
- **Duplicate leaf text (dup-render symptom)**, nav labels appearing 2–3× on one page:
  `3x vesk`, `3x Get Started`, `3x Vesk Native`, `2x native`, `2x features`,
  `2x showcase`, `2x source`, `2x web`, `2x Android`, `2x Material 3`, `2x Native APIs`,
  `2x settings`.
- The user's concrete report matches: the **menu in vesk-doc, including the tabs in the
  "write → understand" section below the Hero**, renders duplicates on the client.

## Known mechanism leads (from prior session root-cause, verified)
1. NavLink's client hydrator has a gate `if (__isHydrating) { a = hydrate.nextElement('a') ... }`
   with a `document.querySelector(...)` fallback (`packages/runtime/src/router-components.ts`
   ~:358-370). When the gate is false the anchors stay **plain** (never get
   `data-vsk-claimed`) and their inner `<!--vsk-->` markers are never consumed — leaving
   claimed markers AND the duplicate-looking anchors in the client DOM. **Investigating why
   `__isHydrating` is false during the client layout-chain NavLink claims is the key.**
   See the leftover-marker probes: `ssr-store-widget.html`, and `dup-probe.mjs`.

## Scope (mandatory, from AGENTS.md)
- The fix must support **every `.vsk`, `.ts`, `.js` file anywhere under the project root
  `/root/vesk` — any directory depth, any subdirectory — `excluding node_modules`**.
  Non-default locations: a `.vsk` file imported from a `src/` deep path must hot-reload
  and hydrate markers equally.
- Keep the params fix; the CLI is one esbuild bundle. After any `packages/*/src` edit:
  `npx tsx packages/cli/build.ts` → restart dev server → rerun the suite.
- NEVER use regex for source-text manipulation/analysis in compiler or codegen (AST/tokenizer
  only). The dev-server/utility layer may use light string checks.
- Server lifecycle: kill by port, `setsid` detached relaunch, keep `vesk-doc` on `:3000`.
- Statement mode is first-class — fixes must work in BOTH expression and statement modes.

## Definition of done
`node tests/hydration-test.mjs` shows **360 passed / 0 failed** AND a
`dup-probe.mjs` run shows **zero duplicate identical outerHTML blocks and zero duplicated
leaf text nodes** on `/` and on `/store/widget` (head rendered exactly once, nav labels
each exactly once, all markers claimed, zero pageerrors).

## How to reproduce with the probe
```bash
cd /root/vesk
node dup-probe.mjs   # requires dev server on :3000 (CHROME_PATH + chrome executable)
```
