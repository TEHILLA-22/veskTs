type Block =
	| { kind: "h2"; text: string }
	| { kind: "p"; text: string }
	| { kind: "list"; items: string[] }
	| { kind: "note"; tone: "info" | "warn"; text: string }
	| { kind: "code"; filename: string; language?: string; code: string }
	| { kind: "tabs"; tabs: { label: string; filename: string; code: string }[] }
	| { kind: "table"; head: string[]; rows: string[][] };

export const pages: {
	slug: string;
	title: string;
	description: string;
	group: string;
	blocks: Block[];
}[] = [
	{
		slug: "routing",
		title: "Routing",
		description:
			"Two routing modes — file-based under app/ and manual via createRouter — with dynamic segments and catch-alls, nested layouts, loading/error/not-found/offline pages, Link/NavLink navigation, prefetching, guards, and the low-level router API.",
		group: "Runtime",
		blocks: [
			{
				kind: "p",
				text: "A URL is a promise: when someone types or clicks `/blog/vesk-is-fast`, they mean the article `vesk-is-fast`, inside the blog section, wrapped in whatever chrome the rest of the blog shares. Routing is the code that keeps that promise — it turns an address into a screen, stacks the right layouts around it, loads what that screen needs, and still behaves sanely when the link is stale, the address is a typo, or the network dies mid-navigation. Vesk gives you two ways to build that mapping. **File-based routing** (the default) makes your `app/` directory the route tree, so `app/about/page.vsk` *is* `/about` and you never hand-write a URL map. **Manual routing** declares the same machinery yourself with `createRouter` + `defineRoute`, which you reach for when you need custom URL shapes or want to skip the `app/` scan entirely. Both run on the same matching engine and share navigation, layout chains, prefetching, and offline handling — you only pick where the route tree lives, not how routing behaves.",
			},
			{ kind: "h2", text: "Route conventions" },
			{
				kind: "p",
				text: "The quickest way to think about file-based routing: what you see in `app/` is what your users type. A directory in the tree is a segment of the URL, and a `.vsk` file inside that directory is the component that answers for that segment. The compiler scans `app/` and emits a route tree, so the filesystem is the sitemap — no central route table to keep in sync.",
			},
			{
				kind: "table",
				head: ["app/ file", "URL route"],
				rows: [
					["app/page.vsk", "/"],
					["app/about/page.vsk", "/about"],
					["app/about/layout.vsk", "layout wrapping /about"],
					["app/blog/[slug]/page.vsk", "/blog/:slug"],
					["app/docs/[...rest]/page.vsk", "/docs/:rest (catch-all)"],
					["app/(marketing)/page.vsk", "/ (route group, no URL segment)"],
					["app/_private/page.vsk", "excluded from the router"],
				],
			},
			{
				kind: "list",
				items: [
					"The compiler scans `app/` with `scanRoutes` (in `packages/compiler/src/router.ts`) and emits a route tree: each directory becomes a URL segment, and URL segments match by **position** — `page.vsk` at `app/blog/[slug]/` matches `/blog/anything`, and `layout.vsk` at the same depth wraps it. The matching engine cares where a file sits, not what you name it.",
					"`page.vsk` is the screen itself; `layout.vsk` is the frame around it — the nav, the sidebar, the footer that should survive a route change. A directory that has neither still contributes its path prefix to the routes nested underneath, so deep folders only exist to organize URLs.",
					"A directory name in square brackets — `[slug]` — is a dynamic segment. The matched value (URL-decoded) lands in the route's params, read via `useParams()`. This is how a single file serves an unbounded set of URLs like `/blog/any-post-you-can-type`.",
					"A directory starting with `[...` — `[...rest]` — is a catch-all that absorbs the *rest* of the path after the prefix, also surfaced in `useParams()`. Reach for it when a deep tree of URLs (a help center, a docs hierarchy) should all land on one page.",
					"Groups in parentheses — `(marketing)` — organize routes under a shared layout or loading/error boundary **without** adding a URL segment, so `app/(marketing)/pricing/page.vsk` is served at `/pricing`. You get the folder for structure while the address bar stays clean.",
					"A leading `_` marks a directory as private: it is skipped by the scan entirely and is the home for components, hooks, and non-route files. Use it to keep pieces of the UI out of the URL space, and out of the router's way.",
				],
			},
			{
				kind: "p",
				text: "Unmatched URLs fall to the nearest `not-found.vsk` — the router walks the layout chain up from the deepest matched segment — and `isNotFound` errors render through it. That resolution is per-subtree, which is what makes route groups useful: `(marketing)/not-found.vsk` still catches every URL under its subtree, it just keeps the `/marketing` prefix out of the address bar.",
			},
			{ kind: "h2", text: "Dynamic segments & params" },
			{
				kind: "p",
				text: "Any path segment in brackets (`[slug]`, `[id]`) is a live wildcard: the router substitutes a param for it, you read that param with `useParams()`, and you reference it anywhere in the route's subtree. The param is reactive — when navigation moves between `/[slug]` values, the router updates the current params, so a component that reads `useParams()` inside `effect()` automatically re-renders for the new value. Because values are URL-decoded, `app/blog/[slug]/page.vsk` can handle a slug like `my%20post` and still read it back as `my post` — the browser's encoding is the router's problem, not yours.",
			},
			{
				kind: "tabs",
				tabs: [
					{
						label: "statement mode",
						filename: "app/blog/[slug]/page.vsk",
						code: `component BlogPost() {
	useParams(): { slug: string }
	const &[slug] = track('');
	const p = useParams();
	effect(() => {
		slug = p.slug;
	});
	<p>Reading {slug}</p>
}`,
					},
					{
						label: "expression mode",
						filename: "app/blog/[slug]/page.vsk",
						code: `component BlogPost() {
	const { slug } = useParams();
	return <p>Reading {slug}</p>;
}`,
					},
				],
			},
			{
				kind: "p",
				text: "Catch-all segments behave the same way but collect everything after their prefix. Under `app/docs/[...rest]/page.vsk`, the URL `/docs/guides/routing/advanced` arrives with `useParams().rest === 'guides/routing/advanced'` — the router joins the remaining segments with `/` and URL-decodes each piece. Use this for tree-shaped sections (a help center, a file browser) where the lookup path itself is data: one component renders any depth, because the whole rest of the path is its input.",
			},
			{
				kind: "tabs",
				tabs: [
					{
						label: "statement mode",
						filename: "app/docs/[...rest]/page.vsk",
						code: `component DocTree() {
	useParams(): { rest: string }
	const &[rest] = track('');
	const p = useParams();
	effect(() => {
		rest = p.rest;
	});
	<div>
		<p>You are reading:</p>
		<p>{rest}</p>
	</div>
}`,
					},
					{
						label: "expression mode",
						filename: "app/docs/[...rest]/page.vsk",
						code: `component DocTree() {
	const { rest } = useParams();
	return <p>You are reading: {rest}</p>;
}`,
					},
				],
			},
			{ kind: "h2", text: "Nested layouts" },
			{
				kind: "p",
				text: "In most apps, pages share a frame — a header, a sidebar, a footer — and only the middle changes. Layouts are per-directory frames for exactly that. `app/layout.vsk` wraps every route; `app/dashboard/layout.vsk` wraps only `/dashboard` routes; `app/dashboard/settings/layout.vsk` wraps only `/dashboard/settings`. Files nested inside a directory run inside that directory's layout chain, and the deepest layout renders the page itself. A layout renders its matched page through `{props.children}`, receiving `{ children, params }` from the router. Because each level is just a component wrapping the next, the page chain (and any layouts above it) stays mounted across navigations — scroll state, open menus, and in-flight UI survive a route change.",
			},
			{
				kind: "tabs",
				tabs: [
					{
						label: "statement mode",
						filename: "app/dashboard/layout.vsk",
						code: `component DashboardLayout(props: { children: any }) {
	<aside>Dashboard nav</aside>
	<main>{props.children}</main>
}`,
					},
					{
						label: "expression mode",
						filename: "app/dashboard/layout.vsk",
						code: `component DashboardLayout(props: { children: any }) {
	return (
		<div>
			<aside>Dashboard nav</aside>
			<main>{props.children}</main>
		</div>
	);
}`,
					},
				],
			},
			{
				kind: "p",
				text: "Layouts stack by directory depth, and the router constructs the chain lazily as it resolves a match. A multi-level tree like `app/layout.vsk` → `app/docs/layout.vsk` → `app/docs/[slug]/layout.vsk` means `/docs/quickstart` renders the outer shell, then the docs shell, then the per-slug shell, with the deepest layout rendering the page itself. Each level's params are scoped to its own segment, so a layout at `app/blog/[year]/layout.vsk` can render the year — from its own `[year]` segment — while the page below it reads the slug. That scoping is what keeps an archive page and its article page sharing one shell without either reaching into the other's params.",
			},
			{
				kind: "tabs",
				tabs: [
					{
						label: "statement mode",
						filename: "app/blog/[year]/layout.vsk",
						code: `component YearLayout(props: { children: any }) {
	useParams(): { year: string }
	const p = useParams();
	<header>Posts from {p.year}</header>
	<article>{props.children}</article>
}`,
					},
					{
						label: "expression mode",
						filename: "app/blog/[year]/layout.vsk",
						code: `component YearLayout(props: { children: any }) {
	const { year } = useParams();
	return (
		<div>
			<header>Posts from {year}</header>
			<article>{props.children}</article>
		</div>
	);
}`,
					},
				],
			},
			{
				kind: "note",
				tone: "info",
				text: "File-based layouts render the page chain through `props.children` — the runtime (`renderMatch` in `packages/runtime/src/router.ts`) passes `{ children, params }` down the layout chain. The `Outlet` component exists in the runtime surface but is not what file-based layouts use; the layout system renders `props.children` directly. (When you build routes manually, you opt into `Outlet` instead — see Manual routing below.)",
			},
			{ kind: "h2", text: "Manual routing" },
			{
				kind: "p",
				text: "File conventions are only convenient until your URL shape stops fitting them. Reach for manual routing when you need custom URL patterns, when the app lives outside an `app/` directory, when you're building a test harness or incrementally migrating an existing router, or when you want a pure SPA that never runs the compiler's scan. You declare routes in code and start the router yourself. Manual and file-based share the identical matching engine (static / `:param` / `*` catch-all), layout nesting, `Link`/`NavLink` SPA navigation, `useParams`/`useNavigate`/`useRouter`, guards, `redirect`/`notFound` throws, prefetching, and the `hash`/`offline` options — only the tree construction differs (`app/` scan vs `defineRoute`/`buildRouteTree` or a plain map).",
			},
			{
				kind: "list",
				items: [
					"`createRouter(routes, options)` — array form via `buildRouteTree([defineRoute(path, config), …])` OR map form `Record<string, Function>` (`'/post/:slug': () => '<h1/>'`, `'/files/...rest'` catch-all). Renders into `options.container` (default `#root`). The compiled file-based app is just `createFileRouter(tree, options)` — same engine plus `middleware` + chunk loading (`ensureChunk`).",
					"`defineRoute(path, config)` — one route definition: `{ path, page?, layout?, loading?, error?, notFound?, offline?, network?, children? }`. Returns the node for `buildRouteTree`. `path` is absolute (`'/'`, `'/about/:id'`, `'/docs/*'`).",
					"`buildRouteTree(definitions)` — normalizes `defineRoute` results into a matchable tree (`fullPath`, `segmentCount`, `isDynamic`/`isCatchAll`, `*` → catch-all). Use it when you declare routes as an array.",
					"`matchRoute(tree, pathname)` — pure matcher for testing/tooling: returns `{ matchChain, params }` or `null`. `buildTreeFromMap(map)` is the internal equivalent for the `Record` form.",
					"Layouts in manual mode use the same `{ children, params }` contract as file-based (`{props.children}` renders the inner chain). The `Outlet` placeholder component (`<Outlet/>`) is an alternative imperative target for manual mount points — file-based layouts never use it.",
					"Manual routes are NOT auto-imported: import `createRouter`, `defineRoute`, `buildRouteTree`, `matchRoute` from `@vesk/runtime/router` explicitly. File-based hooks (`Link`, `NavLink`, `useParams`, `redirect`, …) remain auto-imported.",
				],
			},
			{
				kind: "table",
				head: ["Manual config field", "File-based equivalent", "When it renders"],
				rows: [
					["page", "page.vsk", "The route itself (`{ params, ...data }`)"],
					["layout", "layout.vsk", "Wrapper receiving `{ children, params }`, render `{props.children}`"],
					["loading", "loading.vsk", "While SPA navigation to the route is in flight (`{ params }`)"],
					["error", "error.vsk", "When page/layout throws (`{ error, retry, params, statusCode, stack, url, offline, networkState }`)"],
					["notFound", "not-found.vsk", "Unmatched URL or `notFound()` (`{ params, url }`)"],
					["offline / network", "offline.vsk / network.vsk", "Connectivity failure (`{ url, params, retry, online, effectiveType, downlink, rtt, saveData }`)"],
					["children", "subdirectory", "Nested routes under the parent path"],
				],
			},
			{
				kind: "p",
				text: "The config fields map one-to-one onto the reserved files, so a manual route gets the same loading/error/offline behavior a file-based one would — you are just declaring it in code instead of the filesystem. Here is the same dashboard pair from the file-based examples, declared as page and layout values:",
			},
			{
				kind: "tabs",
				tabs: [
					{
						label: "statement mode",
						filename: "app/manual-pages.vsk (used as page/layout values)",
						code: `component ManualLayout(props: { children: any }) {
	<aside>Docs nav</aside>
	<main>{props.children}</main>
}`,

					},
					{
						label: "expression mode",
						filename: "app/manual-pages.vsk (used as page/layout values)",
						code: `component ManualLayout(props: { children: any }) {
	return (
		<div>
			<aside>Docs nav</aside>
			<main>{props.children}</main>
		</div>
	);
}`,
					},
				],
			},
			{
				kind: "tabs",
				tabs: [
					{
						label: "statement mode",
						filename: "app/manual-pages.vsk (used as page/layout values)",
						code: `component ManualPost() {
	useParams(): { slug: string }
	const p = useParams();
	<p>Post {p.slug}</p>
}`,
					},
					{
						label: "expression mode",
						filename: "app/manual-pages.vsk (used as page/layout values)",
						code: `component ManualPost() {
	const { slug } = useParams();
	return <p>Post {slug}</p>;
}`,
					},
				],
			},
			{
				kind: "p",
				text: "The array form is the explicit path: build a tree with `defineRoute` + `buildRouteTree`, pass it to `createRouter`, and start listening. Note the options you get for free — prefetching on, hash mode off, an SSR cache TTL on `routeDataCache` — all tunable per app:",
			},
			{
				kind: "tabs",
				tabs: [
					{
						label: "statement mode",
						filename: "app/client.ts (manual — array form)",
						code: `import { createRouter, buildRouteTree, defineRoute, matchRoute } from '@vesk/runtime/router';
import { ManualLayout, ManualPost } from './manual-pages.vsk';

const routes = buildRouteTree([
	defineRoute('/', { page: () => '<h1>Home</h1>' }),
	defineRoute('/post/:slug', { page: ManualPost, layout: ManualLayout }),
	defineRoute('/files/...rest', { page: () => '<h1>Files</h1>' }),
]);

const router = createRouter(routes, {
	container: document.getElementById('root')!,
	prefetch: true,
	hash: false,
	routeDataCache: 0,
});
router.start();

// pure matcher — no router needed (testing, tooling):
const m = matchRoute(routes, '/post/hello');
console.log(m!.params.slug); // 'hello'`,
					},
					{
						label: "expression mode",
						filename: "app/client.ts (manual — array form)",
						code: `import { createRouter, buildRouteTree, defineRoute, matchRoute } from '@vesk/runtime/router';
import { ManualLayout, ManualPost } from './manual-pages.vsk';

const routes = buildRouteTree([
	defineRoute('/', { page: () => '<h1>Home</h1>' }),
	defineRoute('/post/:slug', { page: ManualPost, layout: ManualLayout }),
	defineRoute('/files/...rest', { page: () => '<h1>Files</h1>' }),
]);

const router = createRouter(routes, {
	container: document.getElementById('root')!,
	prefetch: true,
	hash: false,
	routeDataCache: 0,
});
router.start();

// pure matcher — no router needed (testing, tooling):
const m = matchRoute(routes, '/post/hello');
console.log(m!.params.slug); // 'hello'`,
					},
				],
			},
			{
				kind: "p",
				text: "If your routes are simple enough, skip the tree builder entirely and hand `createRouter` a plain `Record` of path→render function. The router builds the tree internally, and `hash: true` opts into hash mode (`#/path`) when you want history-free navigation that leaves plain `#anchor` links alone:",
			},
			{
				kind: "tabs",
				tabs: [
					{
						label: "statement mode",
						filename: "app/client.ts (manual — map shorthand, no buildRouteTree)",
						code: `import { createRouter, matchRoute } from '@vesk/runtime/router';

// Keys are patterns: ':param' for dynamic, '...name' for catch-all.
// The router builds the tree internally with buildTreeFromMap.
const routes: Record<string, Function> = {
	'/home': () => '<h1>Home</h1>',
	'/post/:slug': () => '<h1>Post</h1>',
	'/files/...rest': () => '<h1>Files</h1>', // catch-all
};

const router = createRouter(routes, {
	container: document.getElementById('root')!,
	hash: true, // route lives in #/path — plain #anchor stays native
});
router.start();

// pure matcher — no router needed (testing, tooling):
const m = matchRoute(router.routeTree, '/post/hello');
console.log(m!.params.slug); // 'hello'`,
					},
					{
						label: "expression mode",
						filename: "app/client.ts (manual — map shorthand, no buildRouteTree)",
						code: `import { createRouter, matchRoute } from '@vesk/runtime/router';

// Keys are patterns: ':param' for dynamic, '...name' for catch-all.
// The router builds the tree internally with buildTreeFromMap.
const routes: Record<string, Function> = {
	'/home': () => '<h1>Home</h1>',
	'/post/:slug': () => '<h1>Post</h1>',
	'/files/...rest': () => '<h1>Files</h1>', // catch-all
};

const router = createRouter(routes, {
	container: document.getElementById('root')!,
	hash: true, // route lives in #/path — plain #anchor stays native
});
router.start();

// pure matcher — no router needed (testing, tooling):
const m = matchRoute(router.routeTree, '/post/hello');
console.log(m!.params.slug); // 'hello'`,
					},
				],
			},
			{
				kind: "list",
				items: [
					"`createRouter(routes, opts)` / `createFileRouter(tree, opts)` — shared options include `container` (default `#root`), `prefetch` (default `true`), `viewport`, `idle`, `interaction` hydrate strategies, scroll/no-scroll behavior, `routeDataCache` (SSR cache TTL), `beforeEach` guards, `hash`, and `offline`.",
				],
			},
			{
				kind: "note",
				tone: "info",
				text: "Manual and file-based can coexist: keep most routes file-based (`createFileRouter` from the generated tree) and mount a manual `createRouter` subtree on a prefix (e.g. `/admin/*`) by giving its catch-all node `layout`/`page` from manual definitions. Shared `useRouter()`/`useNavigate()` work across the boundary; guards and `hash` are per-router.",
			},
			{ kind: "h2", text: "Loading, error, not-found & offline pages" },
			{
				kind: "table",
				head: ["Reserved file", "When it renders", "Props"],
				rows: [
					["loading.vsk", "While an SPA navigation to the route is in flight", "{ params }"],
					["error.vsk", "When the matched page or layout throws", "{ error, retry, params, statusCode, stack, url, offline, networkState }"],
					["not-found.vsk", "Unmatched URL, or `notFound()` thrown", "{ params, url }"],
					["offline.vsk", "Navigation failed because the client lost connectivity", "{ url, params, retry, online, effectiveType, downlink, rtt, saveData }"],
					["network.vsk", "Connectivity-aware UI that live re-renders on online/offline/type changes", "{ url, params, retry, online, effectiveType, downlink, rtt, saveData }"],
				],
			},
			{
				kind: "p",
				text: "Every route in a real app has four states worth designing for: waiting for data, broken, missing, and offline. These five reserved files are where you design for them. Each file sits in the same directory as the routes it covers, and the router resolves to the **nearest** ancestor up the match chain, so a `loading.vsk` under `app/blog/` also covers `app/blog/about/` — put a slow screen's loading state near the screen, not at the root. A `not-found.vsk` catches any URL that never matches a route; `error.vsk` handles anything that throws, from a page to a layout, and keeps the surrounding layout frame mounted so your nav stays usable while the error UI swaps in. Both custom pages receive a `retry()` prop, so a transient failure (a rate limit, a network blip) gets a one-click second chance.",
			},
			{
				kind: "tabs",
				tabs: [
					{
						label: "statement mode",
						filename: "app/not-found.vsk",
						code: `component NotFound(props: { url: string }) {
	<main>
		<h1>404</h1>
		<p>We couldn't find {props.url}.</p>
		<Link href="/">Back to home</Link>
	</main>
}`,
					},
					{
						label: "expression mode",
						filename: "app/not-found.vsk",
						code: `component NotFound(props: { url: string }) {
	return (
		<main>
			<h1>404</h1>
			<p>We couldn't find {props.url}.</p>
			<Link href="/">Back to home</Link>
		</main>
	);
}`,
					},
				],
			},
			{
				kind: "tabs",
				tabs: [
					{
						label: "statement mode",
						filename: "app/error.vsk",
						code: `component ErrorBoundary(props: { error: any; retry: any; params: any }) {
	<main>
		<h1>Something went wrong</h1>
		<p>{props.error.message}</p>
		<button onClick={() => props.retry()}>Retry</button>
	</main>
}`,
					},
					{
						label: "expression mode",
						filename: "app/error.vsk",
						code: `component ErrorBoundary(props: { error: any; retry: any; params: any }) {
	return (
		<main>
			<h1>Something went wrong</h1>
			<p>{props.error.message}</p>
			<button onClick={() => props.retry()}>Retry</button>
		</main>
	);
}`,
					},
				],
			},
			{
				kind: "note",
				tone: "warn",
				text: "The router runs its own connectivity check before falling back: an actual network failure renders `offline.vsk` (or the router's `offline` option), NOT `not-found.vsk`. A page that looks like it should 404 but is really reachable stays a 404; a page that would 404 only because the network died gets the offline UI instead. Getting this wrong is how users end up staring at 'Page not found' while riding the subway.",
			},
			{ kind: "h2", text: "Navigation components" },
			{
				kind: "list",
				items: [
					"`Link` — renders an `<a>` that intercepts clicks for client-side (SPA) navigation, so the app doesn't reload the whole page for every link tap. Meta/ctrl/shift/alt clicks, a non-primary button, `target=\"_blank\"`, and non-route hrefs (`#anchor`, `mailto:`, off-site) fall through to native behavior — middle-click-to-open-in-tab still works, because it should.",
					"`NavLink` — everything `Link` does plus active-state styling, the piece you want in nav bars and sidebar menus: `activeClass` (default `'active'`) is applied and `aria-current=\"page\"` set when the current path exactly equals the href, or is a descendant of it (boundary-aware prefix match, `/docs/x` matches `/docs` but not `/docs2`). Pass `ariaCurrent={false}` to skip `aria-current`.",
					"Plain `<a href=\"...\" no-reload>` — opts an ordinary anchor into SPA navigation with no page reload (the router installs a delegated click listener). `data-no-reload` is equivalent. Handy when the element is styled as something a `Link` would be overkill for.",
				],
			},
			{
				kind: "note",
				tone: "info",
				text: "Prefetching is on by default: `<Link>`/`<NavLink>` hook into a delegated hover listener that calls `router.prefetch(href)` when you point at a link, keeping the matching route data and chunks warm before you click. Turn it off globally with `createFileRouter(tree, { prefetch: false })`, or call `router.prefetch(path)` / `useRouter().prefetch(path)` imperatively.",
			},
			{ kind: "h2", text: "Programmatic navigation & hooks" },
			{
				kind: "p",
				text: "Links cover the case where a human clicks; forms, buttons, and async flows need navigation without an anchor. `useNavigate()` gives you a function that pushes a new entry, replaces the current one, or steps back through history — the same SPA path a `Link` click would take, minus the element:",
			},
			{
				kind: "tabs",
				tabs: [
					{
						label: "statement mode",
						filename: "app/components/Toolbar.vsk",
						code: `component Toolbar() {
	const navigate = useNavigate();
	<div>
		<button onClick={() => navigate('/dashboard')}>Dashboard</button>
		<button onClick={() => navigate('/settings', { replace: true })}>Replace</button>
		<button onClick={() => navigate(-1)}>Back</button>
	</div>
}`,
					},
					{
						label: "expression mode",
						filename: "app/components/Toolbar.vsk",
						code: `component Toolbar() {
	const navigate = useNavigate();
	return (
		<div>
			<button onClick={() => navigate('/dashboard')}>Dashboard</button>
			<button onClick={() => navigate('/settings', { replace: true })}>Replace</button>
			<button onClick={() => navigate(-1)}>Back</button>
		</div>
	);
}`,
					},
				],
			},
			{
				kind: "p",
				text: "To render the address bar itself — say, a status strip that reflects exactly where the app is — the read hooks are your inputs:",
			},
			{
				kind: "tabs",
				tabs: [
					{
						label: "statement mode",
						filename: "app/components/OfflineRetry.vsk",
						code: `component OnlineStatus() {
	const pathname = usePathname();
	const params = useParams();
	const [search, setSearch] = useSearchParams();
	const navigate = useNavigate();
	<div>
		<p>At {pathname} with {JSON.stringify(params)}</p>
		<p>Query: {search.toString()}</p>
	</div>
}`,
					},
					{
						label: "expression mode",
						filename: "app/components/OfflineRetry.vsk",
						code: `component OnlineStatus() {
	const pathname = usePathname();
	const params = useParams();
	const [search, setSearch] = useSearchParams();
	const navigate = useNavigate();
	return (
		<div>
			<p>At {pathname} with {JSON.stringify(params)}</p>
			<p>Query: {search.toString()}</p>
		</div>
	);
}`,
					},
				],
			},
			{
				kind: "p",
				text: "Routing hooks are reactive: `usePathname()`, `useParams()`, and `useNavigate()` all re-run their effect consumers when the route changes, so UI built on them stays in sync without manual wiring. `useNavigate()` accepts a `{ replace, hash, scrollBehavior }` option on navigation; `useParams()` returns the current dynamic segments. Guard against the router not being ready — hooks read from the router context, so call them inside components mounted under the router or guard callback.",
			},
			{ kind: "h2", text: "Redirects & not-found" },
			{
				kind: "p",
				text: "Not every URL you serve is the one you want to show. A page whose data moved (a post re-slugged, a product retired) should bounce the visitor to the right place; a page that was never real should 404 honestly. Vesk models both as thrown errors, so the redirect decision lives right where you discover the problem — in the component or the data loader — and the router handles the mechanics. `redirect(url)` / `notFound()` are throw-with-helpers; the errors they raise (and the ones you can raise directly) travel up through layouts and middleware to the router or server.",
			},
			{
				kind: "list",
				items: [
					"`redirect(url, status = 302)` — throws a `Redirect`; the router catches it and navigates (with the status honored by the server).",
					"`permanentRedirect(url)` — throws a `Redirect` with `status = 308`.",
					"`notFound()` — throws a `NotFoundError`; the router renders the nearest `not-found.vsk`.",
					"`Redirect` / `NotFoundError` can also be thrown directly (`throw new Redirect(url, status)`, `throw new NotFoundError()`), as in the docs app's `app/docs/[slug]/page.vsk`.",
					"Server middleware and API route handlers recognize the thrown `Redirect` (`err.name === 'Redirect'`) and turn it into an HTTP redirect response.",
				],
			},
			{
				kind: "p",
				text: "The typical shape is a guard at the top of the component: if we're not authed, or the slug is gone, leave before rendering a single pixel:",
			},
			{
				kind: "tabs",
				tabs: [
					{
						label: "statement mode",
						filename: "app/redirect/page.vsk",
						code: `component SecretPage() {
	if (!isAuthed()) {
		redirect('/login');
	}
	<p>Welcome back</p>
}`,
					},
					{
						label: "expression mode",
						filename: "app/redirect/page.vsk",
						code: `component SecretPage() {
	if (!isAuthed()) {
		redirect('/login');
	}
	return <p>Welcome back</p>;
}`,
					},
				],
			},
			{
				kind: "tabs",
				tabs: [
					{
						label: "statement mode",
						filename: "app/whats-here/page.vsk",
						code: `component UnknownPage() {
	const &[isGone] = track(false);
	if (isGone) {
		notFound();
	}
	<p>This page might not exist.</p>
}`,
					},
					{
						label: "expression mode",
						filename: "app/whats-here/page.vsk",
						code: `component UnknownPage() {
	const &[isGone] = track(false);
	if (isGone) {
		notFound();
	}
	return <p>This page might not exist.</p>;
}`,
					},
				],
			},
			{ kind: "h2", text: "Router API reference" },
			{
				kind: "table",
				head: ["Function", "Signature", "Description"],
				rows: [
					["usePathname", "() => string", "Current reactive pathname"],
					["useParams", "() => Record<string, string>", "Reactive dynamic params"],
					["useSearchParams", "() => [URLSearchParams, setter]", "Reactive search params + replace-style setter"],
					["useNavigate", "() => (path, opts?) => void", "Programmatic navigation (push, replace, back/forward)"],
					["useRouter", "() => RouterInstance", "The active router (start, navigate, prefetch, guards, state)"],
					["useRouter.start()", "() => void", "Begin listening for navigations"],
					["useRouter.navigate", "(path, { replace }?) => void", "Navigate a path, optionally replacing history"],
					["router.prefetch", "(path) => void", "Warm route data/chunks before navigation"],
					["router.beforeEach", "(guard) => void", "Register a route guard (runs before navigation)"],
					["Link", "<Link href>…</Link>", "SPA anchor with delegated click interception"],
					["NavLink", "<NavLink href activeClass>…</NavLink>", "Link + active-state styling / aria-current"],
					["Outlet", "<Outlet/>", "Placeholder in manual layout chains"],
					["Redirect", "throw new Redirect(url, status)", "Thrown, not rendered"],
					["redirect", "(url, status?) => never", "Throw-with-helpers; catches in router"],
					["permanentRedirect", "(url) => never", "308 variant"],
					["notFound", "() => never", "Throws NotFoundError"],
				],
			},
			{
				kind: "note",
				tone: "warn",
				text: "There is no `<Redirect to=\"...\">` component. `Redirect` is an `Error` subclass that must be *thrown* — creating it as JSX (`<Redirect to=\"/login\" />`) renders nothing and is a bug. Use `redirect(url)` / `permanentRedirect(url)` / `notFound()` helpers, or `throw new Redirect(url, status)` / `throw new NotFoundError()`.",
			},
		],
	},
];