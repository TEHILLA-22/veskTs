export type Block =
  | { kind: "h2"; text: string }
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "note"; tone: "info" | "warn"; text: string }
  | { kind: "code"; filename: string; language?: string; code: string }
  | { kind: "tabs"; tabs: { label: string; filename: string; code: string }[] }
  | { kind: "table"; head: string[]; rows: string[][] };

export type DocPage = {
  slug: string;
  title: string;
  description: string;
  group: string;
  blocks: Block[];
};

export const pages: DocPage[] = [
  {
    slug: "server-apis",
    title: "Server APIs",
    description:
      "Request context (useParams/useRequest/useBody), cookies(), headers(), locals(), VeskRequest / VeskResponse / ServerResponse, CORS, webhooks, hooks, validation, signed cookies and server events.",
    group: "Runtime",
    blocks: [
      {
        kind: "p",
        text: "Most of a Vesk app never touches the request directly — you write components, they render, the browser gets HTML. But the moment you add a login flow, a checkout, a webhook endpoint, or an API route, you need to read what the browser actually sent and answer with something other than HTML. That is what `@vesk/runtime/server` is for. Everything on this page lives there and is used in API routes (`app/api/**/route.ts`), middleware, server components and the `app/_events.ts` lifecycle file.",
      },
      {
        kind: "note",
        tone: "info",
        text: "The request-context helpers — `useParams`, `useRequest`, `useBody`, `cookies()`, `headers()`, `locals()` — read from an ambient per-request store (`globalThis.__vesk_request`) that the dev server, the adapter and the API-route runner populate before your code runs. Only `useParams` is auto-imported inside component bodies; the other helpers and the response classes must be imported explicitly from `@vesk/runtime/server`.",
      },
      { kind: "h2", text: "Reading the request" },
      {
        kind: "p",
        text: "While a request is being handled, Vesk keeps a small context object in the ambient store. In API routes it is `{ headers, url, method, cookies, locals, _request, params }`; in SSR renders the adapter seeds a `VeskRequest.from(request, { params, locals })` instance. The helpers below read from whichever object is live, so the same call works in a component, a middleware and a route handler — you never have to thread the request through your call stack by hand.",
      },
      {
        kind: "list",
        items: [
          "`useParams(): Record<string, string>` — route parameters. For `/blog/42/hello` it returns `{ id: '42', slug: 'hello' }`. Auto-imported in component bodies.",
          "`useRequest(): RequestContext | null` — the live request context, or `null` outside a request. Carries `url`, `method`, `params`, `cookies`, `locals` and the underlying `_request`.",
          "`useBody(): Promise<unknown>` — the parsed request body: JSON for `content-type: application/json`, an object for `x-www-form-urlencoded`, otherwise text (with a JSON.parse fallback). Cached per request; returns `null` when there is no underlying request and throws if called outside a request context.",
          "`cookies(): CookieStore` — the current request's cookies, read by name or by iterating the jar.",
          "`headers()` — the normalized header store: `get(name)` and `has(name)` are case-insensitive, `entries()` yields `[name, value]` pairs, and direct reads like `headers().accept` or `headers()['accept-language']` work too. Multi-valued headers come back joined with `', '`.",
          "`locals(): Record<string, unknown>` — per-request data shared between middleware, handlers and renders (empty object outside a request).",
          "`serverLocals(): Record<string, unknown>` — the process/isolate-wide store shared across every request; what `onStart` seeds here shows up in each request's `locals()`.",
        ],
      },
      { kind: "h2", text: "Reading params and headers in a component" },
      {
        kind: "p",
        text: "Say a component needs to tailor itself to the URL — an item page that greets the user in their preferred language. `useParams()` gives you the route segments (the same values the router matched), and `headers()` lets you peek at request metadata like `Accept-Language` so the server-rendered HTML is already right, no client round trip needed. Every body mode works the same way.",
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/ParamsPage.vsk",
            code: `import { headers } from '@vesk/runtime/server';

component ParamsPage() {
  const params = useParams();
  const lang = headers().get('accept-language');
  <div class="p-4">
    <h1>Item {params.id}</h1>
    <p>Preferred language: {lang ?? 'none'}</p>
  </div>
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/ParamsPage.vsk",
            code: `import { headers } from '@vesk/runtime/server';

component ParamsPage() {
  const params = useParams();
  const lang = headers().get('accept-language');
  return (
    <div class="p-4">
      <h1>Item {params.id}</h1>
      <p>Preferred language: {lang ?? 'none'}</p>
    </div>
  );
}`,
          },
        ],
      },
      { kind: "h2", text: "cookies()" },
      {
        kind: "p",
        text: "Cookies are how the server remembers things a request can't carry — a session id, a theme, an A/B bucket. `cookies()` returns the current request's cookie jar: a Proxy over `Record<string, string>` that also exposes a few helper methods, so any cookie can be read directly by property name (`jar.session`). On the client it falls back to `document.cookie`. Reading is the request side; writing is the response side — you set cookies with `VeskResponse.setCookie()` (or the `setSignedCookie` helper below), never by mutating the jar.",
      },
      {
        kind: "list",
        items: [
          "`get(name)` → `string | undefined`",
          "`getAll()` → `{ name, value }[]`",
          "`toString()` → `name=value; name=value`",
        ],
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/Dashboard.vsk",
            code: `import { cookies } from '@vesk/runtime/server';

component Dashboard() {
  const jar = cookies();
  const session = jar.get('session');
  <div>
    <h1>Dashboard</h1>
    {session ? <p>Signed in with session {session}</p> : <p>No session cookie</p>}
  </div>
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/Dashboard.vsk",
            code: `import { cookies } from '@vesk/runtime/server';

component Dashboard() {
  const jar = cookies();
  const session = jar.get('session');
  const count = jar.getAll().length;
  return (
    <div>
      <h1>Dashboard</h1>
      <p>{count} cookie(s) present</p>
      {session ? <p>Signed in with session {session}</p> : <p>No session cookie</p>}
    </div>
  );
}`,
          },
        ],
      },
      { kind: "h2", text: "headers()" },
      {
        kind: "p",
        text: "When you need to branch on user-agent, honor a caching header, or inspect the origin of a request, `headers()` is the low-friction accessor. It normalizes header names to lowercase and supports both method and property access — `headers().get('accept')` and `headers()['accept']` are equivalent. Values from multi-valued headers are joined with `', '`, and reads are case-insensitive so you never have to guess the casing a proxy or platform sent.",
      },
      {
        kind: "list",
        items: [
          "`get(name)` → `string | null` (case-insensitive)",
          "`has(name)` → `boolean` (case-insensitive)",
          "`entries()` → `MapIterator` of `[name, value]` pairs",
          "Direct reads: `headers().accept`, `headers()['accept-language']`, …",
        ],
      },
      { kind: "h2", text: "locals()" },
      {
        kind: "p",
        text: "`locals()` is the scratch space for one request: middleware fills it with the user or the tenant, API routes read it, the final render consumes it. It is pre-seeded from the server-wide context, so anything your app set at boot in `onStart` (a database handle, a feature flag set) is already on every request's `locals()` before any middleware runs. That turns boot-time setup into something every handler can reach without importing globals.",
      },
      {
        kind: "code",
        filename: "app/middleware.ts",
        code: `import type { MiddlewareContext } from '@vesk/compiler';

export async function middleware(ctx: MiddlewareContext, next: () => Promise<void>) {
  ctx.set('user', { id: 1, name: 'Alice' });
  const startTime = Date.now();
  await next();
  console.log('took', Date.now() - startTime, 'ms');
}`,
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/ProfileBanner.vsk",
            code: `import { locals } from '@vesk/runtime/server';

component ProfileBanner() {
  const name = locals().name;
  <div>
    {name && <p>Welcome back, {name}</p>}
    {!name && <p>Welcome, guest</p>}
  </div>
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/ProfileBanner.vsk",
            code: `import { locals } from '@vesk/runtime/server';

component ProfileBanner() {
  const name = locals().name;
  return (
    <div>
      {name && <p>Welcome back, {name}</p>}
      {!name && <p>Welcome, guest</p>}
    </div>
  );
}`,
          },
        ],
      },
      { kind: "h2", text: "useRequest() and useBody()" },
      {
        kind: "p",
        text: "`useRequest()` hands you the raw context — the whole picture of the current request in one object, useful when you need several fields at once or want to inspect what's live. `useBody()` parses the body by `content-type` — `application/json` → object, `x-www-form-urlencoded` → object, anything else → text — and caches the result per request, so calling it twice never re-reads the stream. Both are for server-side code (components, API routes, actions).",
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/RequestInfo.vsk",
            code: `import { useRequest } from '@vesk/runtime/server';

component RequestInfo() {
  const req = useRequest();
  const url = req?.url;
  <div>
    {url && <p>Requested: {url}</p>}
    {!url && <p>Rendered without a live request</p>}
  </div>
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/RequestInfo.vsk",
            code: `import { useRequest } from '@vesk/runtime/server';

component RequestInfo() {
  const req = useRequest();
  const url = req?.url;
  return (
    <div>
      {url && <p>Requested: {url}</p>}
      {!url && <p>Rendered without a live request</p>}
    </div>
  );
}`,
          },
        ],
      },
      { kind: "h2", text: "Full API route handler" },
      {
        kind: "p",
        text: "A typical route handler pulls in almost every helper at once: params tell you which resource, cookies tell you who's asking, `useBody()` gives you the payload, and `VeskResponse` lets you answer fluently — status, JSON, and a cookie in one expression. API routes are plain TypeScript files under `app/api` exporting handlers named after HTTP methods, so this is all running next to the request objects Node or your platform handed you.",
      },
      {
        kind: "code",
        filename: "app/api/posts/[id]/comments/route.ts",
        code: `import {
  VeskResponse,
  cookies,
  headers,
  locals,
  useBody,
  useParams,
  useRequest,
} from '@vesk/runtime/server';

export interface Comment {
  author: string;
  text: string;
}

export async function POST() {
  const params = useParams();
  const jar = cookies();
  const accept = headers().get('accept');
  const userId = locals().userId;
  const body = (await useBody()) as Comment;
  const req = useRequest();

  return VeskResponse.json(
    {
      ok: true,
      postId: params.id,
      text: body.text,
      userId: userId ?? null,
      session: jar.get('session') ?? null,
      accept,
      url: req?.url,
    },
    { status: 201 },
  ).setCookie('draft-saved', '1', { maxAge: 86400 });
}`,
      },
      { kind: "h2", text: "Building responses" },
      {
        kind: "p",
        text: "Two response classes ship in `@vesk/runtime/server`. `ServerResponse` covers the routing primitives — the three ways a handler can hand off: redirect, rewrite, or fall through. `VeskResponse` extends it with a fluent builder for JSON, HTML, cookies, caching and security headers. Both extend the standard `Response`, so anything that expects a `Response` (middleware `next()`, the adapter, your tests) keeps working.",
      },
      {
        kind: "code",
        filename: "app/api/flow/route.ts",
        code: `import { ServerResponse } from '@vesk/runtime/server';

export async function GET() {
  return ServerResponse.redirect('/login', 307);
}

export async function POST() {
  // Keep the request going, but render another route
  return ServerResponse.rewrite('/api/internal');
}

export async function PUT() {
  // No match here — fall through to the next handler
  return ServerResponse.next();
}`,
      },
      {
        kind: "list",
        items: [
          "`ServerResponse.json(body, init?)` — JSON body + `Content-Type: application/json`.",
          "`ServerResponse.redirect(url, status = 307)` — `Location` header.",
          "`ServerResponse.rewrite(url)` — sets `x-vesk-rewrite`; the runtime re-dispatches the request.",
          "`ServerResponse.next()` — sets `x-vesk-next`; falls through to the next matching handler.",
        ],
      },
      { kind: "h2", text: "VeskResponse (fluent)" },
      {
        kind: "p",
        text: "`VeskResponse` is where you compose a real answer: JSON body, status, a security header, a cookie, a CORS policy — chained in one statement instead of five. It is a Proxy over a `ServerResponse` subclass, so it can be called with or without `new`; every chainable method returns the same instance, and `build()` (or the `text()`/`json()` readers) flushes the queued security headers and cookies into real header values before the response leaves the handler.",
      },
      {
        kind: "code",
        filename: "app/api/hello/route.ts",
        code: `import { VeskRequest, VeskResponse } from '@vesk/runtime/server';

export async function GET(req: VeskRequest) {
  return VeskResponse.json({ message: 'Hello from Vesk!' })
    .setStatus(201)
    .setCookie('session', 'abc123', { httpOnly: true, secure: true, path: '/', maxAge: 3600 })
    .setCsp("default-src 'self'")
    .cors({ origin: 'https://example.com', methods: 'GET,POST' });
}

export async function POST(req: VeskRequest) {
  const body = await req.json();
  return VeskResponse.json({ received: body, ok: true }, { status: 201 })
    .setCookie('posted', 'true');
}`,
      },
      {
        kind: "table",
        head: ["Member", "Effect"],
        rows: [
          ["`static json(body, init?)`", "JSON response with `Content-Type: application/json`."],
          ["`static redirect(url, status = 307)`", "Response with a `Location` header."],
          ["`static rewrite(url)`", "Sets `x-vesk-rewrite` for internal re-dispatch."],
          ["`static next()`", "Sets `x-vesk-next` to fall through to the next handler."],
          ["`static html(html, init?)`", "Response with `Content-Type: text/html; charset=utf-8`."],
          ["`static stream(readable, init?)`", "Chunked response over a `ReadableStream` body (SSE, file streams)."],
          ["`setStatus(code)`", "Final status; the `status` getter returns it even if the initial `ResponseInit` differs."],
          ["`setCookie(name, value, opts?)`", "Queues a `Set-Cookie` header. `HttpOnly` and `Secure` are on by default, `SameSite=Lax`, `Path=/`. Options: `httpOnly`, `secure`, `sameSite` (`'Lax' | 'Strict' | 'None'`), `maxAge`, `path`, `domain`."],
          ["`clearCookie(name, opts?)`", "Queues an expiring (`Max-Age=0`) cookie. Options: `path`, `domain`."],
          ["`setCsp(policy | false)`", "Sets `Content-Security-Policy` with a raw CSP string; `false` removes it."],
          ["`setSecurityHeader(name, value | false)`", "Sets an arbitrary security header; `false` removes it."],
          ["`cache(ttlSeconds)`", "`Cache-Control: public, max-age=<ttl>, s-maxage=<ttl>`."],
          ["`noCache()`", "`no-store, no-cache, must-revalidate, proxy-revalidate` + `Pragma: no-cache` + `Expires: 0`."],
          ["`cors(opts?)`", "Sets `Access-Control-*` headers: `origin`, `methods`, `headers`, `credentials` (credentials default true)."],
          ["`build()`", "Flushes security headers and queued cookies into the response headers and returns the instance."],
          ["`text()` / `json()`", "Flush security headers, then read the body as text / JSON."],
          ["`status` (getter)", "The `setStatus` status if set, otherwise the underlying `Response.status`."],
        ],
      },
      { kind: "h2", text: "VeskRequest" },
      {
        kind: "p",
        text: "`VeskRequest` is the incoming half: it extends `ServerRequest` (which extends the standard `Request` and adds `cookies`, `params` and `locals` stores) and layers on request metadata accessors plus security setters. Construct it directly, or wrap an inbound platform `Request` with `VeskRequest.from()` to seed `params`/`locals` for renders — the adapter lives on this path, so the metadata below is exactly what your route handlers and components can rely on.",
      },
      {
        kind: "table",
        head: ["Member", "What it exposes"],
        rows: [
          ["`url`, `method`, `headers()`", "Inherited from `Request`."],
          ["`query`", "`Record<string, string>` of parsed search params (cached)."],
          ["`parsedUrl`", "Cached `URL` instance."],
          ["`host`", "Host header honoring `x-forwarded-host` when trust proxy is enabled; falls back to the parsed URL host."],
          ["`hostname`", "Host without the port."],
          ["`origin`", "`protocol://host` — base for resolving relative URLs."],
          ["`protocol`", "`http`/`https`, honoring `x-forwarded-proto` when trust proxy is enabled."],
          ["`ip`", "First `x-forwarded-for` entry / `x-real-ip` when trust proxy is enabled, else `'unknown'`."],
          ["`body`", "Lazy `Promise<unknown>` — parsed JSON, form data, or text (JSON.parse fallback)."],
          ["`cookies`", "`CookieStore` with `get`, `getAll`, `toString` and direct reads."],
          ["`params` / `locals`", "Settable `Record<string, string>` / `Record<string, unknown>` stores."],
          ["`set(key, value)` / `get(key)`", "Locals map accessors so `VeskRequest` doubles as the middleware context."],
          ["`resolveUrl(url)`", "Resolves a possibly-relative URL against `origin`. Used by SSR fetches so `/api/...` works during render."],
          ["`static from(request, { params?, locals? })`", "Wraps a platform `Request` (same method + headers, cookies parsed) with seeded params/locals."],
          ["`setCsp(policy | false)`", "Records a CSP override applied to the response via `applyRequestSecurity`."],
          ["`setCsrf(enable)`", "Records the CSRF flag override."],
          ["`setRateLimit({ windowMs?, max? } | false)`", "Records a rate-limit override applied to the request when the response is built."],
          ["`setSecurityHeader(name, value | false)`", "Records a custom header override."],
          ["`setTrustProxy(enable | string)`", "Enables trusting `x-forwarded-*` headers for `ip`, `protocol` and `host`."],
          ["`getSecurityOverrides()`", "Returns the recorded `_security` overrides object."],
        ],
      },
      {
        kind: "code",
        filename: "app/api/request/route.ts",
        code: `import { VeskRequest, VeskResponse } from '@vesk/runtime/server';

export async function GET(req: VeskRequest) {
  return VeskResponse.json({
    url: req.url,
    method: req.method,
    pathname: req.parsedUrl.pathname,
    query: req.query,
    host: req.host,
    hostname: req.hostname,
    origin: req.origin,
    protocol: req.protocol,
    ip: req.ip,
    absolute: req.resolveUrl('/api/self'),
  });
}`,
      },
      { kind: "h2", text: "Security helpers" },
      {
        kind: "p",
        text: "Two helpers make per-route hardening routine. `withValidation(request, schema, { jsonOnly? })` parses the body (JSON, form data, or text) and runs `schema.safeParse(data)` — on failure it returns a tidy `ServerResponse.json` 400 with `{ error, issues: [{ path, message }] }`, on success it returns `result.data`. `applyRequestSecurity(request, response)` pushes the CSP / custom-header / rate-limit overrides recorded on a `VeskRequest` onto the response, so a busy endpoint can opt into a stricter posture without global config changes.",
      },
      {
        kind: "code",
        filename: "app/api/signup/route.ts",
        code: `import { withValidation } from '@vesk/runtime/server';

const schema = {
  safeParse: (data: unknown) => {
    const d = data as { email?: string };
    return d.email?.includes('@')
      ? { success: true as const, data: d }
      : { success: false as const, error: { issues: [{ path: ['email'], message: 'Invalid email' }] } };
  },
};

export async function POST(request: Request) {
  const result = await withValidation(request, schema);
  if (result instanceof Response) return result;
  return Response.json({ ok: true, email: (result as { email?: string }).email });
}`,
      },
      {
        kind: "code",
        filename: "app/api/secure/route.ts",
        code: `import { applyRequestSecurity, VeskRequest, VeskResponse } from '@vesk/runtime/server';

export async function GET(req: VeskRequest) {
  req.setCsp("default-src 'self'");
  req.setRateLimit({ windowMs: 60_000, max: 100 });
  req.setSecurityHeader('X-Custom', 'yes');
  const res = VeskResponse.json({ ok: true });
  applyRequestSecurity(req, res);
  return res;
}

// Wrapping a platform Request with seeded params/locals
export async function wrap(platformRequest: Request, db: unknown) {
  const vreq = VeskRequest.from(platformRequest, {
    params: { id: '42' },
    locals: { db },
  });
  vreq.setTrustProxy(true);
  vreq.setCsrf(true);
  // Per-route rate limit: at most 100 requests per 60s window for this handler
  vreq.setRateLimit({ windowMs: 60_000, max: 100 });
  return vreq.getSecurityOverrides();
}`,
      },
      { kind: "h2", text: "Signed cookies" },
      {
        kind: "p",
        text: "A plain cookie is just a string — anyone can forge `session=alice` if they know the format. Signed cookies give you tamper evidence: Vesk signs cookies with HMAC-SHA256 (Web Crypto, using a per-host secret) producing `value.base64url-signature` over the `name=value` payload. Tampered cookies unsign to `null`, which is exactly what you want when the alternative is trusting attacker input in an auth check. All four helpers are async; the built runtime bundles what they need.",
      },
      {
        kind: "list",
        items: [
          "`signCookie(name, value, host?)` → `Promise<string>` — signed `value.signature`.",
          "`unsignCookie(name, signedValue, host?)` → `Promise<string | null>` — the value, or `null` when the signature is invalid.",
          "`setSignedCookie(name, value, options?, host?)` → `Promise<string>` — a ready-to-use `Set-Cookie` string (signed value + `HttpOnly`, `Secure`, `SameSite`, `Path`, `Max-Age`, `Domain`).",
          "`readSignedCookie(name, cookieString, host?)` → `Promise<string | null>` — parses a `Cookie`/`Set-Cookie` string and unsigns one entry.",
        ],
      },
      {
        kind: "code",
        filename: "app/api/session/route.ts",
        code: `import {
  readSignedCookie,
  setSignedCookie,
  signCookie,
  unsignCookie,
} from '@vesk/runtime/server';

export async function GET() {
  const signed = await signCookie('session', 'user-42', 'example.com');
  const value = await unsignCookie('session', signed, 'example.com');
  return Response.json({ signed, value });
}

export async function POST(request: Request) {
  const cookie = await setSignedCookie('token', 'abc', { httpOnly: true, maxAge: 3600 }, 'example.com');
  const token = await readSignedCookie('token', request.headers.get('cookie') ?? '', 'example.com');
  return Response.json({ cookie, token });
}`,
      },
      { kind: "h2", text: "CORS" },
      {
        kind: "p",
        text: "If an API route is called from a browser on a different origin, CORS isn't optional — the browser simply blocks the cross-origin read unless you answer the preflight. `cors(options)` returns a middleware function you can call straight from an `OPTIONS` handler: a preflight gets a `204` with the `Access-Control-*` headers, and any other request records those headers as `_pending` so `applyCors(response)` can stamp them onto the final response. For most apps one shared config plus `applyCors` on each answer is all the wiring you need.",
      },
      {
        kind: "list",
        items: [
          "`origin` — default `'*'`.",
          "`methods` — default `'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS'`.",
          "`allowedHeaders` — default `'Content-Type, Authorization'`.",
          "`credentials` — default `true` (adds `Access-Control-Allow-Credentials: true`).",
          "`maxAge` — default `86400`.",
          "`exposeHeaders` — optional `string[]`.",
        ],
      },
      {
        kind: "code",
        filename: "app/api/cors/route.ts",
        code: `import { cors, VeskResponse } from '@vesk/runtime/server';

const api = cors({
  origin: 'https://app.example.com',
  methods: 'GET,POST,PUT,DELETE,OPTIONS',
  credentials: true,
});

export async function OPTIONS(request: Request) {
  return api(request);
}

export async function GET(request: Request) {
  const res = VeskResponse.json({ ok: true });
  return api.applyCors(res);
}`,
      },
      { kind: "h2", text: "Webhooks" },
      {
        kind: "p",
        text: "A webhook is a third party calling your server — Stripe, GitHub, a payment gateway. Because you didn't initiate the request, the only thing proving it's real is a signature the sender computed over the body with a shared secret. `webhook({ secret, handler, headerName?, signaturePrefix? })` returns a request handler that verifies a SHA-256 HMAC signature before running your `handler(event, request)`. The verifier needs Web Crypto, the signature is compared in constant time (length, then char-by-char, so timing can't leak the key), and a missing or invalid signature responds `401` with `{ error }` instead of touching your handler. `event` is the parsed JSON body (the raw body text when it isn't JSON), and `handler` must return a `Response`.",
      },
      {
        kind: "list",
        items: [
          "`secret` — required; used as the HMAC key.",
          "`handler(event, request)` — `event` is the parsed JSON body (raw body text when it isn't JSON).",
          "`headerName` — default `'x-webhook-signature'`.",
          "`signaturePrefix` — default `'sha256='`.",
        ],
      },
      {
        kind: "code",
        filename: "app/api/hooks/route.ts",
        code: `import { webhook } from '@vesk/runtime/server';

export const POST = webhook({
  secret: process.env.WEBHOOK_SECRET!,
  headerName: 'x-webhook-signature',
  signaturePrefix: 'sha256=',
  handler(event, request) {
    return Response.json({ received: event });
  },
});`,
      },
      { kind: "h2", text: "Hooks (defineHook / removeHook / runHooks)" },
      {
        kind: "p",
        text: "When several routes share a gate — the same role check, the same audit log — you can write it once as a hook instead of copying the guard into every handler. `defineHook(name, fn)` registers a hook in a process-wide registry; `removeHook(name, fn)` unregisters it; `runHooks(name, ...args)` runs registered hooks serially and short-circuits with the first `Response` a hook returns (otherwise `undefined`). The API-route runner already invokes live `beforeRequest` / `afterRequest` / `onError` hooks, and the same primitives work for your own middleware-style logic.",
      },
      {
        kind: "code",
        filename: "app/lib/hooks.ts",
        code: `import { defineHook, removeHook, runHooks } from '@vesk/runtime/server';

interface HookCtx {
  params: Record<string, string>;
  locals: Record<string, unknown>;
}

export function protect(roles: string[]) {
  const fn = async (_request: Request, ctx: HookCtx) => {
    const user = ctx.locals.user as { role?: string } | undefined;
    if (!user || !roles.includes(user.role ?? '')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  };
  defineHook('beforeRequest', fn);
  return () => removeHook('beforeRequest', fn);
}

// Register once at boot
const dispose = protect(['admin']);

// runHooks short-circuits: the first hook that returns a Response wins
export async function GET() {
  const blocked = await runHooks('beforeRequest', new Request('/api/secure'), {
    params: {},
    locals: { user: { id: 1, role: 'viewer' } },
  });
  if (blocked) return blocked;
  dispose();
  return Response.json({ ok: true });
}`,
      },
      { kind: "h2", text: "Server events (app/_events.ts)" },
      {
        kind: "p",
        text: "Every long-running process needs a moment to open connections and a moment to close them. `app/_events.ts` (or `.js`) is the private convention file for those lifecycle handlers. The `_` prefix means it is never routed — it can't become a URL, it is pure lifecycle. `onStart` boots once, `onRequest` runs for every request, `onStop` cleans up on shutdown. Values `set()` in `onStart` land in the server-wide context (`serverLocals()` / `getServerContext`) and are pre-seeded into every request's `locals()`, which is how a database handle opened once becomes visible to every handler without a global.",
      },
      {
        kind: "list",
        items: [
          "`onStart(ctx)` — once at server boot (lazily once per isolate on serverless/edge targets).",
          "`onRequest(ctx)` — every app request, with a request-scoped context.",
          "`onStop(ctx)` — graceful shutdown on Node servers (also dev HMR reload).",
        ],
      },
      {
        kind: "code",
        filename: "app/_events.ts",
        code: `import type { ServerEventContext } from '@vesk/types';

declare function createDb(): Promise<{ close(): Promise<void> }>;

export async function onStart(ctx: ServerEventContext) {
  await ctx.set('db', await createDb());
  ctx.set('bootedAt', Date.now());
}

export async function onRequest(ctx: ServerEventContext) {
  const hits = (ctx.get('hits') as number) || 0;
  ctx.set('hits', hits + 1);
}

export async function onStop(ctx: ServerEventContext) {
  const db = ctx.get('db') as { close(): Promise<void> } | undefined;
  await db?.close();
}`,
      },
      {
        kind: "p",
        text: "`ctx.set`/`ctx.get` mirror the explicit server-wide context functions from `@vesk/runtime/server`, which are the same store the events file writes to:",
      },
      {
        kind: "list",
        items: [
          "`serverLocals(): Record<string, unknown>` — the process/isolate-wide store shared across every request.",
          "`getServerContext(key)` — read one value (`undefined` when unset).",
          "`setServerContext(key, value)` — write one value, visible to every subsequent request.",
          "`clearServerContext()` — wipe the entire store.",
        ],
      },
      {
        kind: "table",
        head: ["Field", "Type", "Meaning"],
        rows: [
          ["`server`", "`unknown`", "The running Node `http.Server`; `null` on serverless/edge targets and at build time."],
          ["`port`", "`number`", "The port the server listens on (`0` when no persistent server exists)."],
          ["`host`", "`string`", "The host address the server binds."],
          ["`request`", "`Request`", "The current `Request` (present in `onRequest`)."],
          ["`params`", "`Record<string, string>`", "Current route params."],
          ["`url`", "`URL`", "Parsed request URL."],
          ["`locals`", "`Record<string, unknown>`", "Per-request locals."],
          ["`cookies`", "`Record<string, string>`", "The request's cookies."],
          ["`serverLocals`", "`Record<string, unknown>`", "The process-wide store shared across every request."],
          ["`set(key, value)`", "method", "Writes to `serverLocals` (visible after the current request)."],
          ["`get(key)`", "method", "Reads from `serverLocals`."],
        ],
      },
      {
        kind: "note",
        tone: "warn",
        text: "`useBody()` throws when called outside a request context, and `useRequest()` returns `null` there. `getServerContext(key)` returns `undefined` for unset keys. The signed-cookie helpers throw if `@vesk/compiler` isn't available. The webhook handler you pass must return a `Response`.",
      },
    ],
  },
];

// Convenience alias matching the existing docs.ts export name
export const docPages = pages;