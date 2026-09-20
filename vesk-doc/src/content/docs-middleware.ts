type Block =
  | { kind: "h2"; text: string }
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "note"; tone: "info" | "warn"; text: string }
  | { kind: "code"; filename: string; language?: string; code: string }
  | { kind: "tabs"; tabs: { label: string; filename: string; code: string }[] }
  | { kind: "table"; head: string[]; rows: string[][] };

export const pages: { slug: string; title: string; description: string; group: string; blocks: Block[] }[] = [
  {
    slug: "middleware",
    title: "Middleware",
    description:
      "fn(ctx, next) middleware, the MiddlewareContext, next(rewrite), building responses, and examples for logging, auth, CORS and rewriting.",
    group: "Runtime",
    blocks: [
      {
        kind: "p",
        text:
          "Say you're shipping a membership site: every `/dashboard` request needs to check the session, and every request anywhere should be logged with a timing line. You could copy that check into each page — brittle, and easy to forget on the next route you add. Middleware is the piece of Vesk that runs before a page renders for every request that maps to the directory it lives in, so the check lives in exactly one place. Drop a `middleware.ts` file into any route directory: `app/middleware.ts` runs for the whole app, `app/blog/middleware.ts` additionally runs for `/blog` paths and anything under them.",
      },
      {
        kind: "p",
        text:
          "Directories execute in an onion model: the outermost middleware runs first, calls `next()`, and then the layer just inside it runs — drilling from app-level, through each more-specific directory, into the route handler itself. Whatever each layer does before `await next()` is the pre-request phase; whatever it does after is the post-response phase. When the innermost handler returns, control unwinds back out through the same layers in reverse, so each middleware sees both the request going in and the response coming out. Keep this shape in mind and middleware stays predictable — request transformations flow inward, response refinements flow outward.",
      },
      {
        kind: "code",
        filename: "app/middleware.ts",
        language: "ts",
        code: `import type { MiddlewareContext } from '@vesk/types';

export async function middleware(
  ctx: MiddlewareContext,
  next: (rewrite?: string) => Promise<Response>,
) {
  const start = Date.now();

  const response = await next();

  console.log(
    \`\${ctx.request.method} \${ctx.url.pathname} -> \${response.status} (\${Date.now() - start}ms)\`,
  );

  return response;
}`,
      },
      {
        kind: "p",
        text:
          "The file is plain TypeScript and is loaded as a module, so imports work normally — your middleware can import `@vesk/runtime`, a session library, or config from anywhere else in the project. The loader accepts the middleware as the named export `middleware` or as a `default` export. Middleware must live in a TypeScript file — a `middleware.vsk` is skipped with a structure warning, because middleware is glue code that never renders components and needs no compiler transform.",
      },
      { kind: "h2", text: "MiddlewareContext" },
      {
        kind: "p",
        text:
          "The middleware signature is `fn(ctx, next)` — a single context object plus the chain continuation. There is no response object on the context; short-circuiting and headers are done by returning a `Response` (see below). Keep your reads and writes on the context itself: `ctx.set`/`ctx.get` are the explicit channel for data that flows from one middleware layer to the next and into the page.",
      },
      {
        kind: "table",
        head: ["Member", "Description"],
        rows: [
          ["`request`", "The incoming `Request` (a `VeskRequest` in the dev/prod pipeline) — method, headers, URL, body."],
          ["`params`", "Route parameters for the matched path, as `Record<string, string>`."],
          ["`url`", "The parsed `URL` of the request. Updated to the rewrite target when `next(rewrite)` is called."],
          ["`locals`", "The shared per-request store — seeded from server events and visible to later middleware and the page."],
          ["`cookies`", "Request cookies parsed as `Record<string, string>`."],
          ["`set(key, value)`", "Writes a value into `locals`."],
          ["`get(key)`", "Reads a value from `locals`."],
          ["`[key: string]`", "Any other property access proxies straight to `locals`, so `ctx.user = ...` and `ctx.user` work directly."],
        ],
      },
      {
        kind: "note",
        tone: "warn",
        text:
          "The context has no `next()`, `setHeader()`, `redirect()` or `rewrite()` methods. `next` is the second parameter of the middleware function; headers, redirects and rewrites are expressed through returned `Response` objects (see next section). Reaching for methods that don't exist is the classic middleware foot-gun — the functions are there, just placed where onion chains can actually work with them.",
      },
      {
        kind: "note",
        tone: "warn",
        text:
          "Avoid relying on `ctx.sandboxed` (or any other implied flag you've heard about) to branch behavior — the context's property proxy forwards unknown reads to `locals`, so a flag you assumed was a platform signal is silently `undefined`. If you need a `sandboxed`-style switch, set it yourself with `ctx.set`/`ctx.get`: explicit every time, legible in the chain, and not dependent on memory of the context shape.",
      },
      { kind: "h2", text: "next(), responses and rewriting" },
      {
        kind: "p",
        text:
          "`next()` continues the chain into the following middleware layers, and finally the page render itself — it waits for the handler, so `await next()` resolves only once the page (and every more-specific middleware around it) has finished. That makes the shape of an onion layer constant: everything before `await next()` runs on the way in, everything after runs on the way out, with the rendered `Response` in hand. It returns a `Promise<Response>`, so you can `await next()` and post-process the rendered response, or `const response = await next()` and return it yourself. Unless you return a different `Response`, whatever you `return next()` is the response that reaches the client. HTTP headers are plain `Headers` on that response; to add to them you construct a new `Response` from it or use the fluent `VeskResponse` builders from `@vesk/runtime`.",
      },
      {
        kind: "p",
        text:
          "`next(rewrite)` continues the chain but rewrites the request URL internally: the recorded `rewriteUrl` is passed to the renderer and `ctx.url` becomes the rewrite target — the client keeps the original URL while the page for the rewrite renders. This is useful for canonical hosts, locale prefixes or fallbacks: you can serve the French version of `/about` at `/a-propos` while the address bar and every link stay on the localized path.",
      },
      {
        kind: "code",
        filename: "app/middleware.ts",
        language: "ts",
        code: `import type { MiddlewareContext } from '@vesk/types';

export default async function middleware(
  ctx: MiddlewareContext,
  next: (rewrite?: string) => Promise<Response>,
) {
  if (ctx.url.hostname === 'www.example.com') {
    const canonical = 'https://example.com' + ctx.url.pathname + ctx.url.search;
    return next(canonical);
  }

  return next();
}`,
      },
      {
        kind: "p",
        text:
          "Returning a `Response` — instead of calling `next()` — short-circuits the chain: whatever you return is the final response, and nothing further inward runs. That is your early-exit for auth failures, redirects, and preflights. Returning `next()` (or `await next()`) passes the rest of the chain through. Creating a response is done with the standard `Response` API or the `VeskResponse` helpers from `@vesk/runtime`.",
      },
      { kind: "h2", text: "Response headers, cookies and redirects" },
      {
        kind: "p",
        text:
          "There is no `ctx.setHeader()`. To set headers or cookies on the final page response, wrap the response you get from `await next()` into a new `Response`, or build answers with `VeskResponse.json().setSecurityHeader(...).setCookie(...)` and return them. Because you only have the response after `await next()`, anything you append here is genuinely post-response — it won't be overwritten by a later middleware layer because there are no later layers.",
      },
      {
        kind: "code",
        filename: "app/middleware.ts",
        language: "ts",
        code: `import type { MiddlewareContext } from '@vesk/types';

export async function middleware(ctx: MiddlewareContext, next: () => Promise<Response>) {
  const response = await next();

  const headers = new Headers(response.headers);
  headers.set(
    'X-Request-Id',
    ctx.request.headers.get('x-request-id') || Math.random().toString(36).slice(2),
  );
  headers.append('Set-Cookie', 'visited=1; Path=/; HttpOnly');

  return new Response(response.body, { status: response.status, headers });
}`,
      },
      {
        kind: "p",
        text:
          "To redirect, throw `redirect(url, status)` — still from `@vesk/runtime` — which raises a `Redirect` error the runner turns into a `Location` response. Because it throws, it bypasses whatever comes after it in the chain, so you can place it before the rest of your middleware logic without guarding every branch. `Response.redirect(url, status)` and `VeskResponse.redirect(url)` are drop-in alternatives when you'd rather return than throw.",
      },
      { kind: "h2", text: "Examples" },
      {
        kind: "p",
        text:
          "Auth: read the session from `ctx.cookies`, store the user in `ctx.locals` via `ctx.set`, and `redirect()` guests to the login page. The redirect throws, so nothing below it runs — a guest is sent away before the page ever renders.",
      },
      {
        kind: "code",
        filename: "app/dashboard/middleware.ts",
        language: "ts",
        code: `import type { MiddlewareContext } from '@vesk/types';
import { redirect } from '@vesk/runtime';

export async function middleware(ctx: MiddlewareContext, next: () => Promise<Response>) {
  const token = ctx.cookies.session;

  if (!token) {
    redirect('/login'); // throws -> 302 Location: /login
  }

  ctx.set('user', { name: 'Ada', role: 'admin' });

  return next();
}`,
      },
      {
        kind: "p",
        text:
          "The page reads that user back through `locals()` from `@vesk/runtime`, keeping the pipeline server-side only — it renders once during SSR and never runs on the client, so the account data never crosses the wire. The `ctx.set('user', ...)` call is what makes this safe: the value is written into per-request `locals`, visible to the page's server render, and gone at the end of the request.",
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/dashboard/page.vsk",
            code: `import { locals } from '@vesk/runtime';

component UserBanner() {
  const user = locals().user;

  <p>Signed in as {user.name}</p>
}

export default component Page() {
  <section>
    <UserBanner />
    <h1>Dashboard</h1>
  </section>
}`,
          },
          {
            label: "expression mode",
            filename: "app/dashboard/page.vsk",
            code: `import { locals } from '@vesk/runtime';

component UserBanner() {
  const user = locals().user;

  return <p>Signed in as {user.name}</p>;
}

export default component Page() {
  return (
    <section>
      <UserBanner />
      <h1>Dashboard</h1>
    </section>
  );
}`,
          },
        ],
      },
      {
        kind: "p",
        text:
          "CORS: the `cors()` helper from `@vesk/runtime` returns a small middleware that answers `OPTIONS` preflights with a 204 and exposes `applyCors(response)` to stamp the CORS headers onto the rendered response. The two-step flow matters: the preflight has to be answered without ever touching the route, while the real request still needs the headers added after the page renders.",
      },
      {
        kind: "code",
        filename: "app/middleware.ts",
        language: "ts",
        code: `import type { MiddlewareContext } from '@vesk/types';
import { cors } from '@vesk/runtime';

const handle = cors({
  origin: 'https://app.example.com',
  methods: 'GET, POST, OPTIONS',
  allowedHeaders: 'Content-Type, Authorization',
  credentials: true,
});

export async function middleware(ctx: MiddlewareContext, next: () => Promise<Response>) {
  const preflight = handle(ctx.request);
  if (preflight instanceof Response) {
    return preflight;
  }

  const response = await next();
  return handle.applyCors(response);
}`,
      },
    ],
  },
];