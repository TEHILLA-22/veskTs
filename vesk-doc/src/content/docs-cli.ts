export type Block =
  | { kind: "h2"; text: string }
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "note"; tone: "info" | "warn"; text: string }
  | { kind: "code"; filename: string; language?: string; code: string }
  | { kind: "tabs"; tabs: { label: string; filename: string; code: string }[] }
  | { kind: "table"; head: string[]; rows: string[][] };

export const pages: { slug: string; title: string; description: string; group: string; blocks: Block[] }[] = [
  {
    slug: "cli",
    title: "CLI Commands",
    description:
      "The full vesk CLI: dev, build, start, typecheck, seo, init — flags, defaults, config loading, dev server behaviors, HMR messages and build output.",
    group: "Tooling",
    blocks: [
      {
        kind: "p",
        text: "The `vesk` CLI is the whole toolchain in one binary: it runs the compiler, drives the adapter, and boots the runtime. You never juggle a bundler and a dev server and a typechecker separately — `vesk dev` compiles on request, `vesk build` emits a deployable `.vesk/` folder, `vesk start` serves it in production mode. Every command except `init` and `--help` operates on the current directory and requires an `app/` directory (except `start`, which requires a previous `vesk build`). Scaffolding is separate: `npx create-vesk@latest <project-name>`.",
      },
      {
        kind: "code",
        filename: "terminal",
        language: "text",
        code: `Vesk CLI — Compiler-First Framework for the Post-VDOM Web

Usage:
  vesk build [--platform <name>] [--seo] [--strict] [--skip-split]  Build app/ for production
  vesk build                       Auto-detect platform from CI env (vercel/netlify/cf/deno/aws/coxmos)
  vesk seo [--strict]           Run SEO analysis on app/
  vesk typecheck [--no-strict]  Typecheck .vsk/.ts files via tsc-in-.vsk (strict by default)
  vesk start [-p 3000]          Start production server
  vesk dev [-p 3000]            Start dev server with HMR
  vesk init                     Create src/global.css (Tailwind entrypoint) if missing
  vesk --help                   Show this help

Scaffolding:  npx create-vesk@latest <project-name>`,
      },
      { kind: "h2", text: "A typical session" },
      {
        kind: "p",
        text: "Here is the whole loop, start to finish, the way it actually runs. Scaffold a project, sit in the dev server for a while, ship it, run it. You don't need to memorize the rest of this page to be productive; the reference tables below are for the moment a flag does something surprising.",
      },
      {
        kind: "code",
        filename: "terminal",
        language: "bash",
        code: `$ npx create-vesk@latest my-store
  scaffolded my-store

$ cd my-store
$ vesk dev
  dev server at http://localhost:3000 (listening on 127.0.0.1)
  /Users/you/my-store
  3 pages: /, /pricing, /blog/[slug]
  1 api route (app/api)
  hmr enabled — edit app/ to hot reload`,
      },
      {
        kind: "p",
        text: "The dev server compiles each route on request, so the moment you hit http://localhost:3000 the HTML is fresh. Now change a component — say the tagline on the home page — and watch the log: the edit is debounced (12 ms), the component is recompiled, and a hot-swap message is pushed over WebSocket instead of a page reload.",
      },
      {
        kind: "code",
        filename: "terminal",
        language: "bash",
        code: `# edit app/index.vsk in your editor…
  rebuilt (app/index.vsk) — 23ms
  dev server at http://localhost:3000 (listening on 127.0.0.1)
  [update] 1 component hot-swapped, no reload — app still open in the browser`,
      },
      {
        kind: "p",
        text: "When you're a full-time builder the loop is: `vesk typecheck` to catch type drift, `vesk seo` to keep the audit green, then `vesk build` and `vesk start` for the production pair. Notice the defaults doing the right thing — strict typing on, loopback bind by default, platform auto-detected from CI.",
      },
      {
        kind: "code",
        filename: "terminal",
        language: "bash",
        code: `$ vesk typecheck
  vesk typecheck: no type errors found (2 warning(s))

$ vesk seo --strict
  vesk seo-audit: 3 pages — 0 errors, 1 warnings [PASS_WARN]

$ vesk build --platform vercel
  vesk build: output → .vesk
  vesk build: ssr  → server/functions/index.js  (/)
  vesk build: ssr  → server/functions/pricing.js  (/pricing)
  vesk build: client → static/client.js  (48213 bytes, tree-shaken)
  vesk build: css  → static/global.css  (19402 bytes)
  vesk build: vercel → .vercel/output (symlink)
  vesk build: done (.vesk)

$ vesk start
  vesk start: serving from .vesk
  vesk production server at http://localhost:3000 (listening on 127.0.0.1)`,
      },
      {
        kind: "note",
        tone: "warn",
        text: "`vesk start` requires a build: running it on a fresh checkout prints `vesk start: no build found at .vesk` and `Run \"vesk build\" first`, then exits with status 1. In CI, always build before you start.",
      },
      { kind: "h2", text: "Commands" },
      {
        kind: "p",
        text: "The complete command surface. Ports and hosts repeat across the server commands, so they're spelled out once here: `-p`/`--port`/`--port=<n>` picks the port (default 3000), `-H`/`--host` the bind address (default 127.0.0.1 — exposing a server on all interfaces is an explicit `--host 0.0.0.0`).",
      },
      {
        kind: "table",
        head: ["Command", "Flags", "Behavior"],
        rows: [
          ["vesk dev", "-p <port> / --port <port> / --port=<port> (default 3000); -H <host> / --host <host> (default 127.0.0.1)", "HMR dev server over app/. Exits with a create-vesk hint when app/ is missing; exits when port is in use."],
          ["vesk build", "--platform <name> --target node|edge --seo --strict --skip-split", "Builds app/ into .vesk/. Platform auto-detected from CI env, defaults to node; --seo runs an SEO audit, --strict makes it fail the build; --skip-split disables route code splitting."],
          ["vesk start", "-p / --port (default 3000); -H / --host (default 127.0.0.1)", "Production server serving the .vesk/ build; exits with \"Run vesk build first\" when no build exists."],
          ["vesk typecheck", "--no-strict", "Typecheck .vsk/.ts/.tsx/.js via tsc-in-.vsk (strict by default), plus structure warnings; exits non-zero on errors."],
          ["vesk seo", "--strict", "Runs the SEO audit over app/ (page.vsk + layout.vsk); exits non-zero with --strict when errors exist."],
          ["vesk init", "—", "Creates src/global.css (Tailwind entrypoint) if missing; no-op (exit 0) if it already exists."],
          ["vesk --help / -h", "—", "Prints usage; exits 0 with --help/-h, 1 when invoked with no arguments."],
        ],
      },
      { kind: "h2", text: "Config loading" },
      {
        kind: "p",
        text: "`loadConfig(projectDir)` runs for `dev` and `build`. Order matters, and it's the same order every time: environment files load first so the config can see them, then the config file is read and transpiled, then normalization and validation turn it into the object the build actually uses.",
      },
      {
        kind: "list",
        items: [
          "`.env` then `.env.local` (project root) load before anything else. Each line is trimmed; blank lines and `#` comments are skipped. Values are unquoted (matching `\"`/`'`), assigned as `KEY=VAL`, and existing `process.env` keys are never overridden.",
          "Config resolution order is `vesk.config.js` first, then `vesk.config.ts`. Missing both → an empty config object.",
          "A `.ts` config is transpiled with TypeScript, its `import { ... } from '@vesk/compiler'` lines stripped, prefixed with `const { defineConfig, definePlugin, preset } = globalThis.__vesk_inject;`, written to `.vesk/config.tmp.js`, and imported. The inject helpers are deleted afterwards; the temp file is left on disk.",
          "The loaded value is passed through `defineConfig` when available — which applies security defaulting (autoEscape, csrf, `xFrameOptions: 'DENY'`, a strict CSP, `redactLogs`, `routeDataCache: 0`) and resolves `security` as a preset string ('strict'/'minimal'/'default') or a function receiving `preset` (which also knows 'production'/'development').",
          "The result is then validated by `validateConfig`, which requires `plugins` to be an array of named plugin objects each exposing at least one recognized hook (onCSS, onFileWatch, onTransformJS, onBuildStart, onBuildEnd, onRequest, onStart, onStop, onHead, onHtml, or provides).",
          "If `security.redactLogs` is enabled, `setRedactLogging(true)` turns on server log redaction.",
        ],
      },
      { kind: "h2", text: "vesk dev" },
      {
        kind: "p",
        text: "`vesk dev` starts a per-request-compile dev server with WebSocket HMR — the compiler runs on demand for the route you're looking at, not eagerly for the whole tree. It binds to `127.0.0.1` by default; exposing it on all interfaces is an explicit opt-in (`--host 0.0.0.0`). NODE_ENV is set to `development` if unset.",
      },
      {
        kind: "list",
        items: [
          "Packages are auto-built at startup via `ensurePackagesBuilt()` (best-effort — failure logs a warning, not an exit). The `@vesk/runtime` package must be resolvable or the server exits.",
          "File watching covers `app/` (routing, pages, layouts, components) and `src/` (CSS). Watched extensions: `.vsk`, `.md`/`.markdown`, `.css`, `.ts`/`.js`/`.tsx` (API routes), and `_events.ts`/`_events.js`. Edits are coalesced through a 12 ms debounce window.",
          "`.vsk` changes hot-swap the compiled component via a `{ type: 'update' }` message when possible; route-tree changes, `_events.*` changes, error recovery, and manual rebuilds fall back to a full `{ type: 'reload' }`.",
          "Serves `/_vesk/client.js` (client bundle), `/_vesk/runtime.js` (tree-shaken runtime), `/_vesk/static/*` (code-split chunks + `global.css`), and `/_vesk/ssr-data.js?t=<token>` (one-shot, token-gated hydration payload).",
          "`app/api` routes (`route.ts`), middleware chains, server actions, and server events (`_events.ts` with onStart/onRequest/onStop) are all live — API and events handlers re-run, not reloaded.",
          "The `/__vesk/*` DevTools panel exposes HMR state, diagnostics, rebuild, and plugin activation through the shared adapter router.",
          "Every served page gets the dev script pair (`/_vesk/client.js` + `/_vesk/hmr.js`) injected before `</body>`.",
          "SIGINT/SIGTERM run `onStop` then exit; an in-use port exits with an EADDRINUSE error.",
        ],
      },
      {
        kind: "h2",
        text: "X-Vesk-Data",
      },
      {
        kind: "p",
        text: "`x-vesk-data: 1` is the data-phase flag the SPA router and prefetchers use to fetch just the route's data, not the document. A request with this header triggers the data phase only: the route is matched and its page/layout chain is rendered, but the response is JSON instead of HTML. Successful responses carry `Cache-Control: no-store`, `Vary: x-vesk-data`, and the security headers.",
      },
      {
        kind: "code",
        filename: "terminal",
        language: "bash",
        code: `curl -H 'x-vesk-data: 1' http://localhost:3000/blog/[slug]

# 200 application/json
{ "path": "/blog/hello", "params": { "slug": "hello" }, "props": { "title": "Hello" }, "head": "<title>Hello</title>" }

# server error during the render → same JSON shape but 500
{ "error": "boom" }`,
      },
      { kind: "h2", text: "HMR WebSocket" },
      {
        kind: "p",
        text: "HMR runs over a same-origin WebSocket at `/_vesk/hmr`. Upgrades are Origin-checked — foreign origins are destroyed on arrival, so a rogue page can't subscribe to your edit stream. The last compile error is replayed to every newly connected client (a refresh otherwise blanks the error overlay), and every broadcast message carries a `nonce` that gates client-side eval, so a hijacked socket can't run arbitrary code in your pages.",
      },
      {
        kind: "table",
        head: ["type", "Payload", "When"],
        rows: [
          ["compiling", "nonce", "Broadcast before a `.vsk` rebuild starts."],
          ["update", "time, components, fnSources, nonce", "Hot swap of a single edited component — the eval-able fnSources replace the component's implementation without a reload."],
          ["reload", "nonce", "Route tree changed, a non-component file changed, recovery from a compile error, events reloaded, or a manual full rebuild."],
          ["error", "file, line, column, message, codeframe, suggestions, tips, nonce", "Compile error in the edited file; the client shows the overlay with a 5-line codeframe."],
          ["css-update", "nonce", "`src/global.css` (or `src/app.css`) changed and recompiled through the active CSS plugins."],
        ],
      },
      { kind: "h2", text: "vesk build" },
      {
        kind: "p",
        text: "`vesk build` emits a production build into `.vesk/` — one SSR function per page, API routes, the tree-shaken client runtime, static assets, and a `config.json` manifest. It requires `app/` (exits with a clear error otherwise) and errors out with `process.exit(1)` on compiler failures. Route code splitting is on by default; `--skip-split` produces a monolithic `static/client.js`.",
      },
      {
        kind: "list",
        items: [
          "Output layout: `server/functions/*.js` (one SSR function per page, each exporting `async function handle(request)`), `server/api/*.js`, optional `server/middleware.js` and `server/events.js`, `server/runtime.js` (shared server runtime bundle), `static/client.js` + code-split chunks + `static/global.css` + `static/public/` (copied from `public/`), `prerendered/` (SSG), and `config.json` (manifest + route/action map).",
          "`--platform <name>`: `node`, `vercel`, `netlify`, `cloudflare`, `deno`, `aws`, `edge`, `coxmos`. Without the flag the platform is auto-detected from CI env (see table below); without any env signal it defaults to `node`, which emits nothing extra.",
          "`--target edge` re-targets a node build to the edge platform (anything other than exactly `edge` → `node`). `--platform edge` works directly too.",
          "ISR: a page may `export const revalidate = <seconds>` and `export const isrTags = [...]`; these land in `config.json` and drive runtime revalidation in `vesk start`.",
          "`--seo` runs the SEO audit after the build; `--strict` turns any audit error into a build failure. sitemap.xml and robots.txt are generated into `static/public/` unless the files already exist there.",
          "Markdown safe-raw-HTML policy from `config.md` is applied at build time; occurrences of raw-HTML passthrough are drained and reported as warnings.",
          "Platform emit: `vercel` → a `.vercel/output` symlink target, others (netlify/cloudflare/deno/aws/coxmos/edge) write their deploy artifact under the project and print `vesk build: <platform> → <path>`.",
        ],
      },
      {
        kind: "table",
        head: ["Platform", "CI env autodetect signal"],
        rows: [
          ["node (default)", "no platform env present"],
          ["vercel", "VERCEL | VERCEL_ENV | NOW_REGION | VERCEL_GIT_COMMIT_SHA"],
          ["netlify", "NETLIFY | NETLIFY_BUILD_CONTEXT | NETLIFY_LOCAL | NETLIFY_EDGE"],
          ["cloudflare", "CF_PAGES | CF_PAGES_BRANCH | CF_PAGES_URL | CLOUDFLARE_WORKERS | WORKERS_NAME"],
          ["deno", "DENO_DEPLOYMENT_ID | DENO_REGION | DENO_DEPLOY_URL"],
          ["aws", "AWS_LAMBDA_FUNCTION_NAME | AWS_LAMBDA_FUNCTION_VERSION | LAMBDA_TASK_ROOT | LAMBDA_RUNTIME_DIR"],
          ["coxmos", "COXMOS | COXMOS_DEPLOYMENT_ID | COXMOS_ENV | VESK_DEPLOY | VESK_PLATFORM=coxmos"],
        ],
      },
      { kind: "h2", text: "vesk start" },
      {
        kind: "p",
        text: "`vesk start` is the production serving command — it takes the `.vesk/` build and serves it with security headers, rate limiting, ISR, and the baked middleware and events. Because it fails closed on a broken config, a bad deploy never silently serves a lax server.",
      },
      {
        kind: "list",
        items: [
          "Serves the `.vesk/` build from `config.json`. Exit with status 1 when no build exists (\"Run \\\"vesk build\\\" first\"). NODE_ENV is set to `production` if unset.",
          "Loads `vesk.config.js`/`vesk.config.ts` again at boot for `security` and `md` settings (falls back to secure defaults with a warning if the config is broken — fail closed).",
          "Serves `static/public/` assets, `/_vesk/static/*` bundles and prerendered HTML, server actions under `/_vesk/action/<id>`, API routes, and SSR routes; ISR routes with `revalidate` are served from cache via the runtime's `pageIsr`.",
          "Runs compiled `server/middleware.js` and `server/events.js` (onStart/onRequest/onStop).",
          "Requests carry security headers; rate limiting from `security.rateLimit` returns 429 with `Retry-After`. Errors render `app/error.vsk` and 404s render `app/not-found.vsk`, with stack traces suppressed in production.",
          "SIGINT/SIGTERM run `onStop` and close gracefully.",
        ],
      },
      { kind: "h2", text: "vesk typecheck" },
      {
        kind: "p",
        text: "`.vsk` is a superset of TypeScript, so `vesk typecheck` runs the tsc-in-.vsk pipeline over the whole project: strict mode is the default, `--no-strict` disables it. `.vsk` files are parsed, converted to TSX, and checked by the TypeScript compiler alongside `.ts`/`.tsx`/`.js` files under `app/`. Exits non-zero if any errors exist; warnings are printed but do not fail.",
      },
      {
        kind: "list",
        items: [
          "A synthetic ambient module injects the JSX intrinsic elements and runtime API typings (track, derived, effect, useFetch, Head, Form/Field validation helpers, redirect/notFound, etc.); `import ... from './x.vsk'` resolves to an on-the-fly generated `.vsk.d.ts` and `.css` imports are shimmed.",
          "Directories `node_modules`, `.vesk`, `.git`, `dist`, `tarballs` and `.next` are skipped, as are generated files (`__vesk_ambient.d.ts`, `__vesk_runtime_override.d.ts`, `*.vsk.d.ts`, `*.vsk.js`).",
          "Structure warnings (not errors): middleware must be `middleware.ts` (`.vsk`/`.js` rejected), and API routes must be `route.ts` (`.vsk`/`.js` rejected).",
          "Unparsable `.vsk` files surface as `vesk-parse` errors (code `vesk-parse`).",
          "Output summary: \"no type errors found (N warning(s))\" on success; errors formatted as `file(line,column): code: message`.",
        ],
      },
      { kind: "h2", text: "vesk seo" },
      {
        kind: "p",
        text: "`vesk seo` audits the app by walking `page.vsk` plus a same-directory `layout.vsk` (layout + page source combined). It prints per-route results and a summary of the form `<pages> pages — <errors> errors, <warnings> warnings [PASS | PASS_WARN | FAIL]`. With `--strict`, any errors cause exit code 1 — the flag to run in CI so a page that loses its `<h1>` stops the deploy.",
      },
      {
        kind: "table",
        head: ["Check", "Severity", "Rule"],
        rows: [
          ["h1", "error / warn", "Each page needs exactly one <h1>; more than one is a warning."],
          ["img alt", "error", "Every <img> must carry an alt attribute."],
          ["Image alt", "error", "Every <Image> component must carry an alt attribute."],
          ["title / Head", "error", "Page must include <title> or <Head>."],
          ["meta description", "warn", "A name=\"description\" meta is recommended."],
          ["Open Graph", "warn", "og:title, og:description, and og:image property metas are recommended."],
          ["lang attribute", "warn", "<html> should carry a lang attribute."],
          ["heading order", "warn", "Headings must not skip levels (h1 → h2 → h3 …)."],
        ],
      },
      { kind: "h2", text: "vesk init" },
      {
        kind: "p",
        text: "`vesk init` is the small bootstrap command: it creates `src/global.css` (the Tailwind entrypoint) when missing and prints `vesk init: created <path>`. If it already exists it prints a skipping message and exits 0 — safe to run on an existing project.",
      },
      {
        kind: "code",
        filename: "src/global.css",
        language: "css",
        code: `@import 'tailwindcss';

@layer base {
\thtml { scroll-behavior: smooth; }
}`,
      },
    ],
  },
];