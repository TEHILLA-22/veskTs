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

export const docGroups = [
  "Introduction",
  "Language",
  "Compiler",
  "Runtime",
  "Native",
  "Tooling",
] as const;

import { pages as dataFetchingPages } from "./docs-data-fetching";
import { pages as middlewarePages } from "./docs-middleware";
import { pages as routingPages } from "./docs-routing";
import { pages as serverApisPages } from "./docs-server-apis";
import { pages as configPluginPages } from "./docs-config-plugin";
import { pages as apiRoutesPages } from "./docs-api-routes";
import { pages as cliPages } from "./docs-cli";
import { pages as nativePages } from "./docs-native";
import { pages as nativeGettingStartedPages } from "./docs-native-getting-started";
import { pages as nativeRoutingPages } from "./docs-native-routing";
import { pages as nativeConfigPages } from "./docs-native-config";
import { pages as nativeApisPages } from "./docs-native-apis";
import { pages as nativeCommandsPages } from "./docs-native-commands";
import { pages as nativeLibrariesPages } from "./docs-native-libraries";
import { pages as nativeDevPages } from "./docs-native-dev";
import { pages as nativeBundlingPages } from "./docs-native-bundling";
import { pages as nativeComponentsPages } from "./docs-native-components";
import { pages as nativeMotionPages } from "./docs-native-motion";
import { pages as nativeWebApisPages } from "./docs-native-web-apis";
import { pages as nativeCompilerPages } from "./docs-native-compiler";

const basePages: DocPage[] = [
  {
    slug: "getting-started",
    title: "Getting Started",
    description:
      "What Vesk is, what .vsk files look like, how to scaffold a project, and the commands that drive the compiler.",
    group: "Introduction",
    blocks: [
      {
        kind: "p",
        text: "Say you're starting a new app and you want the good parts of a framework — routing, SSR, reactivity, SEO — without piling a mystery runtime between your code and the DOM. Vesk's answer is to push that work into the compiler. You write one component model in .vsk files (a TypeScript superset), and the compiler emits the output per target: server-rendered HTML plus direct-DOM client code for the web, Kotlin for native. No diffing runtime ships to your users — the DOM update code is generated for you at build time.",
      },
      {
        kind: "p",
        text: "The compiler is an explicit four-stage pipeline, not a hidden evaluator: source is preprocessed, parsed, lowered to an intermediate representation, then codegen'd to platform code. When output behaves a certain way, you can trace it back to the IR that produced it.",
      },
      { kind: "h2", text: "Create a project" },
      {
        kind: "code",
        filename: "terminal",
        code: `npx create-vesk@latest my-app
cd my-app
npm install
npm run dev`,
      },
      {
        kind: "p",
        text: "create-vesk scaffolds a working app — routes, layout, middleware, API routes, a Tailwind entry — so the first thing you see is a running page, not an empty folder. The package scripts are thin wrappers around the Vesk CLI. In dev the server prints its address on startup and reports each rebuild as you save a file:",
      },
      {
        kind: "code",
        filename: "terminal",
        code: `vesk dev server at http://localhost:3000 (listening on localhost)
vesk dev: rebuilt in 11ms`,
      },
      {
        kind: "note",
        tone: "info",
        text: "Dev is incremental by design: the server watches app/ and public/, recompiles only the affected route on change, serves /api/* routes and middleware, and pushes HMR updates over a WebSocket. Editing a component re-renders it in place without a full page reload or lost client state.",
      },
      { kind: "h2", text: "Project layout" },
      {
        kind: "code",
        filename: "my-app/",
        code: `app/
  layout.vsk              # root layout — wraps every route via {props.children}
  page.vsk                # /
  about/page.vsk          # /about
  blog/page.vsk           # /blog
  blog/[slug]/page.vsk    # /blog/:slug
  posts/page.vsk          # data-fetching example (useFetch + tracked cell)
  statements/page.vsk     # statement-mode example
  not-found.vsk           # rendered when a route throws NotFoundError
  error.vsk               # route error boundary
  middleware.ts           # app middleware (onion model)
  api/posts/route.ts      # GET /api/posts
  api/hello/route.ts      # GET /api/hello
src/global.css            # Tailwind entrypoint
public/                   # static assets
vesk.config.ts
package.json`,
      },
      {
        kind: "p",
        text: "Two files carry most of the early work. app/layout.vsk is the root layout: whatever you put in it wraps every route via {props.children}, which is where the site chrome — navigation, a footer — lives. app/blog/[slug]/page.vsk is one route per blog post; the file path maps to a dynamic segment, so the URL /blog/hello-world finds this file with props: { slug: 'hello-world' }.",
      },
      { kind: "h2", text: "CLI commands" },
      {
        kind: "table",
        head: ["Command", "What it does"],
        rows: [
          ["vesk dev [-p <port>]", "HMR dev server on app/ (default port 3000)"],
          ["vesk build [--platform <name>]", "Production build into .vesk/ (platform auto-detected, defaults to node)"],
          ["vesk start [-p <port>]", "Production server serving the .vesk/ build (default port 3000)"],
          ["vesk typecheck", "Typechecks .vsk/.ts in app/ via tsc-in-.vsk (strict by default)"],
          ["vesk seo [--strict]", "Runs the SEO audit against app/"],
          ["vesk init", "Creates src/global.css (Tailwind entrypoint) if missing"],
        ],
      },
      { kind: "h2", text: "Type safety" },
      {
        kind: "p",
        text: "Every .vsk file is a superset of TypeScript: all TS constructs parse, survive codegen, and round-trip through vskToTsx for tsc. That buys real checks at the component boundary — props are typed inputs, and the compiler treats them like the parameters of an exported function. `vesk typecheck` runs that same tsc-in-.vsk pipeline, strict by default, so a failing check means the same thing it would in a plain tsc run.",
      },
    ],
  },
  {
    slug: "components",
    title: "Component Declarations",
    description:
      "The component keyword, typed params, generics, async and island modifiers, and the two body modes.",
    group: "Language",
    blocks: [
      {
        kind: "p",
        text: "Say you're writing your first piece of markup — a greeting, a page, a header. `component` is the keyword you reach for: it's the unit of markup, state, and effects. Declare one, and the compiler generates two programs from that single body: server code that renders HTML (SSR) and client code that hydrates it and keeps the tracked values in sync with the DOM afterward.",
      },
      { kind: "h2", text: "Syntax" },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/Greeting.vsk",
            code: `component App {
  <div>Hello World</div>
}

component Greeting(props: { name: string }) {
  <div>Hello, {props.name}!</div>
}

export default async component Page(props: { id: string }) {
  const res = await fetch(\`/api/items/\${props.id}\`);
  const item = await res.json();
  <p>{item.title}</p>
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/Greeting.vsk",
            code: `component App {
  return <div>Hello World</div>;
}

component Greeting(props: { name: string }) {
  return <div>Hello, {props.name}!</div>;
}

export default async component Page(props: { id: string }) {
  const res = await fetch(\`/api/items/\${props.id}\`);
  const item = await res.json();
  return <p>{item.title}</p>;
}`,
          },
        ],
      },
      {
        kind: "list",
        items: [
          "`component` is a reserved keyword — using it as an identifier raises a compiler error, so there is never ambiguity about which positions are declarations.",
          "Params are optional and fully TypeScript-typed; `component Name { }` is the same as `component Name() { }`, and props arrive as a typed object you can annotate inline or via an interface.",
          "Generic type parameters are supported: `component List<T>(props: { items: T[] }) { ... }` — handy when a component should stay reusable across element types.",
          "`async` may appear directly before `component` or after `export`: `export default async component X() { ... }`. This is how you write server components that fetch before rendering, as the `Page` example above does.",
          "`client` (the island modifier) may appear after the closing paren or after `component` — both parse to the same `client: true` flag, so pick whichever reads better in context.",
        ],
      },
      { kind: "h2", text: "Body modes" },
      {
        kind: "p",
        text: "A component body is either expression mode — it ends with `return <jsx>;` — or statement mode, where markup and control flow appear directly as statements (bare JSX, `if`, `for`, `switch`, `try`, guard-clause early returns). Both modes lower to the same IR nodes, so every feature works in both; the choice is about how the body reads, not what it can do.",
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/Counter.vsk",
            code: `component Counter(props: { initial: number }) {
  const &[count] = track(props.initial);
  <button onClick={() => count++}>Count: {count}</button>
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/Counter.vsk",
            code: `component Counter(props: { initial: number }) {
  const &[count] = track(props.initial);
  return <button onClick={() => count++}>Count: {count}</button>;
}`,
          },
        ],
      },
      {
        kind: "p",
        text: "Same component, two spellings — the only difference is the `return`. The tracked cell, the click handler, the interpolation: identical in both, because both compile through the same IR.",
      },
      {
        kind: "note",
        tone: "info",
        text: "The parser emits a `ComponentDeclaration` node with id, params, body, async, client and optional typeParameters fields — the AST shape the IR generator consumes. Because the modifier is a flag on that node, the two spellings of `client` behave identically.",
      },
    ],
  },
  {
    slug: "track-declarations",
    title: "Track Declarations",
    description:
      "The &[] sugar for creating reactive cells: auto-tracked bindings, raw-cell bindings, and how the compiler rewrites reads and writes.",
    group: "Language",
    blocks: [
      {
        kind: "p",
        text: "Say you have a value the DOM has to react to — a count, a price, a filter string. You want to declare \"this is a reactive cell\" in one line and let the compiler route every read and write through the runtime, so you never type get()/set() by hand. That's the `&[]` track-declaration: it creates a cell and binds names to it in a single statement.",
      },
      { kind: "h2", text: "Syntax" },
      {
        kind: "code",
        filename: "app/components/Counter.vsk",
        code: `const &[count] = track(0);           // count is the auto-tracked reactive value
const &[items] = track<string[]>([]);  // generic cells type normally
const &[total, rawTotal] = track(0);   // rawTotal is the raw Tracked<number> cell`,
      },
      {
        kind: "list",
        items: [
          "The first name is the reactive value. Reads inside effects or component bodies subscribe to it; writes schedule an update automatically.",
          "The optional second name is the raw cell object, used with `untrack()`, `peek()` or when passing the cell around instead of its current value.",
          "Each `&[]` creates exactly one cell of its own; there is no multi-cell shorthand.",
          "`&[]` can only appear at the top level of a component body, or inside a `block()`/`effect()`/`root()` call.",
        ],
      },
      { kind: "h2", text: "How the compiler rewrites it" },
      {
        kind: "table",
        head: ["User code", "Compiled output"],
        rows: [
          ["count", "get(count)"],
          ["count = 5", "set(count, 5)"],
          ["count++", "set(count, get(count) + 1)"],
          ["count + 1", "get(count) + 1"],
        ],
      },
      {
        kind: "p",
        text: "Every `count` in your code is rewritten to a `get()` or `set()` call during compilation — you write the cell name, the runtime does the tracking. The `&[]` binding atom is parsed with `lazy: true` and becomes a `TrackDecl` IR node, which is how the server and client codegen can treat it uniformly even though they emit very different code.",
      },
      { kind: "h2", text: "Derived cells" },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/Price.vsk",
            code: `component Price(props: { qty: number, unit: number }) {
  const &[total] = derived(() => props.qty * props.unit);
  <p>Total: {total}</p>
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/Price.vsk",
            code: `component Price(props: { qty: number, unit: number }) {
  const &[total] = derived(() => props.qty * props.unit);
  return <p>Total: {total}</p>;
}`,
          },
        ],
      },
      {
        kind: "p",
        text: "`total` is read-only — assigning to it throws. Its function re-runs whenever the value of a tracked dependency read inside it changes, which is what makes derived cells safe to use anywhere you'd use a plain cell.",
      },
    ],
  },
  {
    slug: "reactivity",
    title: "Reactivity",
    description:
      "Tracked cells, the cell API, microtask-batched scheduling, effects, and the flushSync/tick escapes. No virtual DOM.",
    group: "Language",
    blocks: [
      {
        kind: "p",
        text: "Say you have a counter, a form field, or any other piece of state that has to keep a piece of DOM honest. The model is a tracked cell created with `track()`. Reading a cell inside a component body or an `effect()` subscribes to it; writing a cell schedules an update. There's no virtual DOM — the compiler has already emitted per-cell DOM update code, so when state changes the browser runs a surgical set of mutations, not a rebuild of a whole tree.",
      },
      { kind: "h2", text: "Cell API" },
      {
        kind: "table",
        head: ["Function", "Purpose"],
        rows: [
          ["track(initial)", "Create a reactive cell"],
          ["get(cell)", "Read a value (subscribes inside effects)"],
          ["set(cell, v)", "Write a value; Object.is-guarded, schedules subscribers"],
          ["increment(cell) / decrement(cell)", "Post-increment/decrement a numeric cell; returns the original value"],
          ["untrack(fn)", "Run fn without subscribing"],
          ["peek(cell)", "Read a cell value without subscribing"],
          ["derived(fn)", "Computed cell that re-runs fn when its dependencies change"],
          ["effect(fn)", "Run fn now and on every dependency change"],
          ["flushSync(fn)", "Run fn with the scheduler in synchronous mode"],
          ["tick()", "Resolve after the next animation frame"],
          ["on_destroy(fn)", "Register teardown cleanup for the current block/component"],
        ],
      },
      {
        kind: "p",
        text: "Inside a component you never write an import statement for these — the compiler sees `track()`, `effect()`, `derived()` and friends in your body and imports them from `@vesk/runtime` for you. The table above is the whole public cell API; everything else in the runtime builds on it.",
      },
      { kind: "h2", text: "Scheduler semantics" },
      {
        kind: "list",
        items: [
          "`set()` does not touch the DOM synchronously — updates are microtask-batched, so several writes in one turn produce exactly one flush.",
          "`effect()` runs immediately on creation, then again on every dependency change. That eager first run is what makes effects good for wiring up listeners and subscriptions.",
          "`flushSync(fn)` flushes pending updates, runs fn with immediate DOM writes, and restores async mode afterwards. Use it when a test or a library needs the DOM current *now*.",
          "`await tick()` resolves after the frame the flush has painted — the \"after the browser has caught up\" escape hatch.",
          "The scheduler guards against effect loops: after 1001 flush rounds it throws: \"Maximum update depth exceeded. This typically indicates that an effect reads and writes the same piece of state.\"",
        ],
      },
      {
        kind: "note",
        tone: "warn",
        text: "`batch` does not exist in the runtime. For synchronous multi-write flushes use `flushSync(fn)` — importing `batch` from `@vesk/runtime` does not resolve.",
      },
      { kind: "h2", text: "Example" },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/Counter.vsk",
            code: `component Counter {
  const &[count] = track(0);

  effect(() => {
    console.log("count is", count);
  });

  <button onClick={() => count++}>
    Count: {count}
  </button>
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/Counter.vsk",
            code: `component Counter {
  const &[count] = track(0);

  effect(() => {
    console.log("count is", count);
  });

  return (
    <button onClick={() => count++}>
      Count: {count}
    </button>
  );
}`,
          },
        ],
      },
    ],
  },
  {
    slug: "expression-mode",
    title: "Expression Mode",
    description:
      "The classic component body style: a single return <jsx> at the end, with guard clauses, .map() lists and ternaries before it.",
    group: "Language",
    blocks: [
      {
        kind: "p",
        text: "Say you've written React or JSX before: expression mode is the body style that already feels like home. The body computes a single `return <jsx>;` at the end, with guard clauses and a few `.map()` calls along the way. It's the simplest way to write a component and the natural default for one-liners and mostly-static layouts.",
      },
      { kind: "h2", text: "Rules" },
      {
        kind: "list",
        items: [
          "The body must end with `return <jsx>;` — that final return is the value of the component.",
          "Guard-clause early returns are allowed before the final return, which is how you bail out to a loading or empty state without nesting the rest of the body.",
          "`.map()` callbacks render collections; a `key` prop is recommended for reconciliation — the compiler extracts the key expression from the JSX child.",
          "Ternary and `&&` expressions work inside `{}` — the conditional equivalents of `if`.",
          "Fragments are supported; adjacent top-level JSX is not (wrap siblings in a fragment or parent instead).",
        ],
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/TodoList.vsk",
            code: `component TodoList(props: { todos: Todo[] }) {
  if (props.todos.length === 0) return <EmptyState />;
  <div class="todo-list">
    {props.todos.map((todo) => (
      <TodoItem key={todo.id} todo={todo} />
    ))}
  </div>
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/TodoList.vsk",
            code: `component TodoList(props: { todos: Todo[] }) {
  if (props.todos.length === 0) return <EmptyState />;

  return (
    <div class="todo-list">
      {props.todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </div>
  );
}`,
          },
        ],
      },
      { kind: "h2", text: "Relationship to statement mode" },
      {
        kind: "p",
        text: "Statement mode is the statement-level equivalent — bare JSX, `if`, `for`, `switch`, `try`, and guard clauses without a wrapper return. Every body feature available in expression mode is available in statement mode and vice versa; which one you reach for is mostly about which reads better for the shape of the component.",
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/TodoList.vsk",
            code: `component TodoList(props: { todos: Todo[] }) {
  if (props.todos.length === 0) return <EmptyState />;
  for (const todo of props.todos; key todo.id) {
    <TodoItem todo={todo} />
  }
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/TodoList.vsk",
            code: `component TodoList(props: { todos: Todo[] }) {
  if (props.todos.length === 0) return <EmptyState />;

  return (
    <div class="todo-list">
      {props.todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </div>
  );
}`,
          },
        ],
      },
      {
        kind: "note",
        tone: "info",
        text: "Both modes lower to the same IR node types — the `for ... ; key` loop and the `.map()` call both become a MapRegion — so switching between them is a formatting decision, not an architecture one.",
      },
    ],
  },
  {
    slug: "statement-mode",
    title: "Statement Mode",
    description:
      "Markup and control flow directly as statements: bare JSX, if/for/while/switch/try, guard-clause returns, and for-key/index clauses.",
    group: "Language",
    blocks: [
      {
        kind: "p",
        text: "Statement mode is where a page starts to read like the page: markup and control flow appear directly as statements, no `return` wrapper required. Most real components are a sequence of guarded blocks — render the header, then only the cart list if it has items, otherwise an empty state — and that structure survives verbatim in statement mode. Every feature that works in expression mode also works here, and vice versa.",
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/List.vsk",
            code: `component List(props: { items: string[] }) {
  const &[filter] = track("");

  if (filter !== "") {
    <p>Filtered by: {filter}</p>
  }

  for (const item of props.items; key item) {
    <div>{item}</div>
  } empty {
    <p>No items.</p>
  }
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/List.vsk",
            code: `component List(props: { items: string[] }) {
  const &[filter] = track("");

  return (
    <>
      {filter !== "" && <p>Filtered by: {filter}</p>}
      {props.items.length === 0 ? (
        <p>No items.</p>
      ) : (
        props.items.map((item) => <div>{item}</div>)
      )}
    </>
  );
}`,
          },
        ],
      },
      { kind: "h2", text: "Statements the compiler understands" },
      {
        kind: "p",
        text: "Statement bodies are not free-form. Anything you write inside a body is either one of the statements below — which the compiler lowers to reactive IR — or plain runtime code it passes through unchanged:",
      },
      {
        kind: "table",
        head: ["Statement", "IR handling"],
        rows: [
          ["Bare JSX element / fragment", "rendered, tracked"],
          ["{expr} expression container", "rendered; .map() calls become a MapRegion"],
          ["if / else", "conditional region"],
          ["for...of, for...in, classic for", "loop region"],
          ["while / do...while", "loop region"],
          ["switch", "switch region"],
          ["try / catch", "try region (fallback content on error)"],
          ["return <jsx>", "guard-clause early return — renders and stops"],
          ["{#server} / {#client} blocks", "client-boundary regions"],
          ["let &[x] = track(0)", "TrackDecl"],
          ["Anything else", "preserved verbatim as a runtime statement"],
        ],
      },
      {
        kind: "note",
        tone: "warn",
        text: "`class Foo {}` inside a component body raises a compiler error — components are markup/state units, not class containers. Define classes at module top level, outside the body.",
      },
      { kind: "h2", text: "for key / index clauses" },
      {
        kind: "code",
        filename: "app/components/Table.vsk",
        code: `component Table(props: { rows: Row[] }) {
  for (const row of props.rows; key row.id; index i) {
    <Row data={row} index={i} />
  } empty {
    <p>No rows.</p>
  }
}`,
      },
      {
        kind: "list",
        items: [
          "`; key <expr>` sets the reconciliation key expression — the identity the list reuses when rows are added, removed, or reordered.",
          "`; index <ident>` binds the loop index to an identifier, so `<Row index={i} />` stays in sync with the row's position.",
          "Clauses are optional and combinable; only for...of/for...in headers may carry them (classic `for` keeps its normal semicolons).",
          "The compiler blanks the clause text before parsing and recovers it from annotations, preserving source offsets — which is why error positions still point at real characters in your file.",
        ],
      },
      { kind: "h2", text: "Guard-clause early returns" },
      {
        kind: "p",
        text: "A `return <jsx>` inside a statement-mode body is a guard clause, not the end of the function: it renders that markup and stops. It shines for handling loading, error, and auth states at the top of a body without indenting everything below it:",
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/Page.vsk",
            code: `component Page(props: { user: User | null }) {
  if (!props.user) return <Login />;
  <h1>Welcome, {props.user.name}</h1>;
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/Page.vsk",
            code: `component Page(props: { user: User | null }) {
  if (!props.user) return <Login />;
  return <h1>Welcome, {props.user.name}</h1>;
}`,
          },
        ],
      },
    ],
  },
  {
    slug: "client-boundary",
    title: "Client Boundary & Islands",
    description:
      "Server-first rendering, the client island modifier, {#client}/{#server} blocks, and which blocks a component kind may use.",
    group: "Language",
    blocks: [
      {
        kind: "p",
        text: "Say you're building a page that is mostly static — marketing copy, a product description — but has one piece that has to be alive on the client: a live clock, a sign-in form, a comment composer. You don't want to make the whole page interactive to get there. Vesk is server-first by default: every component renders to HTML on the server, and you opt specific pieces into client behavior with the `client` island modifier or `{#client}`/`{#server}` blocks. That boundary is explicit, not inferred.",
      },
      { kind: "h2", text: "Islands: the client keyword" },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/Clock.vsk",
            code: `component Clock() client {
  const &[now] = track(new Date());
  effect(() => { /* interval etc. */ });
  <time>{now.toLocaleTimeString()}</time>
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/Clock.vsk",
            code: `component Clock() client {
  const &[now] = track(new Date());
  effect(() => { /* interval etc. */ });
  return <time>{now.toLocaleTimeString()}</time>;
}`,
          },
        ],
      },
      {
        kind: "list",
        items: [
          "Marking a component `client` makes it an island: it has an interactive client bundle, but it still renders on both server and client, so the first paint is HTML.",
          "The modifier goes after the params (`component X() client`) or directly after `component` — both parse to the same flag.",
          "`client` composes with `export` and `async`: `export component X() client`.",
          "Event-handler attributes (`on*`) are excluded from the SSR HTML entirely — the server carries the markup, the client bundle attaches behavior. This is why an island's static shell shows up instantly and the interactivity is added later.",
        ],
      },
      { kind: "h2", text: "{#client} / {#server} blocks" },
      {
        kind: "p",
        text: "A component kind decides which block syntax it may use. The compiler enforces this statically at any nesting depth — a mistake here is a compile error, never a silent runtime surprise:",
      },
      {
        kind: "table",
        head: ["Component kind", "{#server}", "{#client}"],
        rows: [
          ["Server component (default)", "allowed", "error (clientBlockInServer)"],
          ["client island", "error (serverBlockInClient)", "allowed"],
        ],
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/Robots.vsk",
            code: `component Robots() {
  {#server}
    <meta name="robots" content="noindex" />
  {/server}

  <p>Always rendered.</p>
}

component ClientOnly() client {
  {#client}
    <p>This markup only hydrates on the client.</p>
  {/client}

  <p>Also always rendered.</p>
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/Robots.vsk",
            code: `component Robots() {
  {#server}
    <meta name="robots" content="noindex" />
  {/server}

  return <p>Always rendered.</p>;
}

component ClientOnly() client {
  {#client}
    <p>This markup only hydrates on the client.</p>
  {/client}

  return <p>Also always rendered.</p>;
}`,
          },
        ],
      },
      {
        kind: "p",
        text: "`{#server}` blocks render in SSR and are stripped from the client bundle; `{#client}` blocks are stripped from SSR and render on the client. The `#server { ... }` / `#client { ... }` prefix forms parse to the identical VeskBlock node, and blocks nest and accept full statement-mode bodies — so you can guard a genuinely server-only chunk (a meta tag, a secret-derived value) without splitting it into its own component.",
      },
      { kind: "h2", text: "What ships to the client" },
      {
        kind: "p",
        text: "The compiler only pays for interactivity where it exists. A module produces a client bundle when any component is a `client` island or has a non-static body (tracked cells, effects, on* handlers, bindings). A module where every component is fully static and non-client compiles to an empty client bundle — that page costs the user nothing in JavaScript.",
      },
    ],
  },
  {
    slug: "styles",
    title: "Styles",
    description:
      "Component-scoped CSS via a <style> element in the body, how it is extracted, and how it is emitted on server and client.",
    group: "Language",
    blocks: [
      {
        kind: "p",
        text: "Say you want a card component whose styles always travel with it — no global stylesheet, no naming convention to police, no class-name collisions to debug. Drop a `<style>` element in the component body and Vesk scopes the CSS to that component: the compiler extracts the element and hoists it to component level, then emits it appropriately on each target.",
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/Card.vsk",
            code: `component Card(props: { title: string }) {
  <div class="card">
    <h2>{props.title}</h2>
  </div>

  <style>
    .card { border: 1px solid #ccc; padding: 8px; }
    .card h2 { margin: 0; }
  </style>
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/Card.vsk",
            code: `component Card(props: { title: string }) {
  return (
    <>
      <div class="card">
        <h2>{props.title}</h2>
      </div>

      <style>
        .card { border: 1px solid #ccc; padding: 8px; }
        .card h2 { margin: 0; }
      </style>
    </>
  );
}`,
          },
        ],
      },
      { kind: "h2", text: "How it is compiled" },
      {
        kind: "list",
        items: [
          "The IR generator removes `<style>` nodes from the render body and stores their text as the component's style property (extractStyle). The body's IR no longer contains them.",
          "Server output emits a literal `<style>...</style>` block with the raw CSS — the stylesheet is on the page before any JavaScript has run.",
          "Client output creates a `<style>` element keyed by the component identifier and appends it to document.head, so the styles load whether or not the server markup is present.",
          "An unclosed `<style>` is a parse error: \"Unclosed `<style>` element: missing `</style>`\" — a missing closing tag is caught at build time, not left to corrupt the page.",
        ],
      },
    ],
  },
  {
    slug: "markdown",
    title: "Markdown",
    description:
      "The built-in <Md> component and renderMarkdown(): tokenizer-based, with highlighting, GFM, streaming, and configurable HTML policies.",
    group: "Language",
    blocks: [
      {
        kind: "p",
        text: "Say you're publishing blog posts or a docs site and the content arrives as Markdown strings. You want them rendered as HTML — syntax-highlighted code blocks, GFM tables and autolinks — without dragging a heavy runtime library into the page. Vesk's built-in `<Md>` component and `renderMarkdown()` cover that. The implementation is tokenizer-based (no regex in the compiler) and supports highlighting, GFM, streaming, and configurable HTML policies.",
      },
      {
        kind: "code",
        filename: "app/components/Docs.vsk",
        code: `<Md content="# Hello\\n\\nThis is **bold**." />`,
      },
      { kind: "h2", text: "Content types" },
      {
        kind: "p",
        text: "The same component handles four kinds of content, so rendering a hardcoded snippet and rendering a streamed fetch look identical at the call site:",
      },
      {
        kind: "table",
        head: ["Type", "Behavior"],
        rows: [
          ["string", "Literal markdown, rendered synchronously"],
          ["Tracked<string>", "Reactive — re-renders when the cell changes"],
          ["Resource<string> / useFetch.stream", "Streaming — progressively renders chunks"],
          ["\"/path/to/*.md\"", "Runtime-loaded from the public/ directory"],
        ],
      },
      { kind: "h2", text: "Props and options" },
      {
        kind: "table",
        head: ["Option", "Description"],
        rows: [
          ["css", "Built-in styles: true / false / custom CSS string"],
          ["lineNumbers / copy / highlight", "Code-block presentation (line numbers, copy button, highlighted lines)"],
          ["hardBreaks", "Treat newlines as <br>"],
          ["html", "'escape' (default) | 'allow' | 'allowlist' — inline HTML policy"],
          ["renderMarkdown(content, opts)", "Imperative render: chrome, ids, autolink, allowTags"],
          ["configureMd({ ... })", "Global defaults, e.g. { html: 'allowlist', allowTags: ['br', 'strong'] }"],
        ],
      },
      {
        kind: "p",
        text: "The `html` policy is the one to think about before you ship markdown that includes user-generated HTML: the default is `'escape'` (safe), `'allow'` passes markup through, and `'allowlist'` passes through only the tags you name. `configureMd({ ... })` sets the default for every `<Md>` on the site.",
      },
      {
        kind: "note",
        tone: "info",
        text: "`<Md>` content is polymorphic: a string renders synchronously, a Tracked<string> re-renders when the cell changes, a Resource/useFetch.stream progressively renders chunks, and a \"/path/to/*.md\" string loads from public/ at runtime.",
      },
    ],
  },
  {
    slug: "not-in-the-grammar",
    title: "Not in the Grammar",
    description:
      "Explicit non-features. Vesk is a TypeScript superset — everything listed here is intentionally absent today, and the absence is a contract.",
    group: "Language",
    blocks: [
      {
        kind: "p",
        text: "This page is a list of things deliberately *not* in Vesk, so you don't waste a session looking for them. Vesk is a TypeScript superset, and each entry here is a contract: code that relies on one of these will not compile, and that hard failure is a feature — it stops a subtly-wrong architecture at build time instead of in production.",
      },
      { kind: "h2", text: "Language" },
      {
        kind: "list",
        items: [
          "No `defer` / streaming boundaries — SSR output is a static template per component. If you need progressive content, stream the data into a reactive region instead.",
          "No `class` declarations in component bodies — raises a compiler error; define classes at module scope.",
          "No adjacent top-level JSX — siblings must be wrapped in `<>...</>` or a parent element.",
          "`component` is reserved and cannot be used as an identifier.",
          "No `suspense` implementation — use the `if (loading)` + `createResource` pattern instead: `if (res.loading) return <p>Loading...</p>`.",
        ],
      },
      { kind: "h2", text: "Reactivity" },
      {
        kind: "list",
        items: [
          "No `batch`. Synchronous multi-write flushes use `flushSync(fn)`; the default scheduler is microtask-batched.",
          "No React hooks. The equivalents are `track()`, `effect()`, `derived()` — the effects and lifecycle live in the component body, not in hook functions.",
          "No virtual DOM — updates compile to per-cell DOM mutations; there is no reconciliation tree at runtime.",
        ],
      },
      { kind: "h2", text: "Tooling" },
      {
        kind: "list",
        items: [
          "No `vite-plugin-vesk` — `vesk dev` / `vesk build` are the build entry points; Tailwind ships as `@vesk/plugin-tailwind`.",
          "The deprecated `packages/runtime/src/track.ts` module is dead code — never import it; the active API lives in ripple-runtime.ts.",
          "Server vs client exports are split: server-only APIs (cookies, headers, isr) are not in the client bundle; client-only APIs (hydrate, bindings, reconcile) are not in the server bundle. Crossing the line is a compile-time boundary error, not a runtime one.",
        ],
      },
    ],
  },
  {
    slug: "pipeline",
    title: "Compiler Pipeline",
    description:
      "Four stages, no hidden runtime: preprocess, parse, IR generation, and codegen to server and client JavaScript (or Kotlin).",
    group: "Compiler",
    blocks: [
      {
        kind: "p",
        text: "When you run `vesk build`, the compiler turns `.vsk` source into JavaScript targets from one intermediate representation: server codegen (SSR HTML) and client codegen (real DOM construction + hydration wiring). A native Kotlin path walks that same IR. Understanding the four stages matters when you're debugging why something renders the way it does, or extending the compiler itself.",
      },
      { kind: "h2", text: "Pipeline stages" },
      {
        kind: "table",
        head: ["Stage", "Module", "What happens"],
        rows: [
          ["[1] Preprocess", "parser.ts", "preprocessForClauses() blanks `; key <expr>` / `; index <ident>` clauses in for-of headers, preserving source offsets with VeskAnnotations"],
          ["[2] Parse", "acorn + acorn-ts-plugin + VeskPlugin", "ESTree-compatible AST with ComponentDeclaration, &[...] track atoms, statement-position JSX, VeskBlock islands, raw <style>"],
          ["[3] IR generation", "ir-generator.ts", "AST → typed IR node tree; statement-mode dispatch; validateBlocks; extractStyle"],
          ["[4] Codegen", "server-jsgen.ts / client-codegen.ts", "server emits HTML string chunks (event attrs stripped); client emits real DOM construction + tracked bindings + hydration wiring"],
        ],
      },
      { kind: "h2", text: "Notes" },
      {
        kind: "list",
        items: [
          "Statement mode and expression mode produce the same IR node types — `props.items.map(...)` and `for (...; key ...)` both become a MapRegion, so optimizing either once optimizes both.",
          "`isStaticIR(body)` decides whether a subtree is fully static; static components skip runtime effect wiring entirely and exist as markup only.",
          "User code in statement-mode bodies stays raw — unrecognized statements are preserved as RuntimeStatement and re-emitted verbatim, never reinterpreted.",
          "There is no regex anywhere in parsing or codegen — tokenizer/character scans only. All source transformation goes through the AST, so any new syntax is added in the parser and IR, not with string surgery.",
        ],
      },
    ],
  },
  {
    slug: "ir-format",
    title: "IR Format",
    description:
      "The ephemeral typed IR: a class hierarchy in ir.ts, consumed by the server and client codegen visitors and by vesk-native-compiler.",
    group: "Compiler",
    blocks: [
      {
        kind: "p",
        text: "The intermediate representation is where the compiler does its real thinking. Every `.vsk` file is lowered to a typed class hierarchy in `packages/compiler/src/ir.ts`; the server and client codegen visitors then walk that same tree — and so does the native Kotlin compiler. The IR is ephemeral: created per compilation by ir-generator.ts, consumed immediately, discarded. Nodes dispatch via `instanceof`, not string tags.",
      },
      { kind: "h2", text: "Root nodes" },
      {
        kind: "list",
        items: [
          "IRRoot — the whole compilation: components, imports, staticProps (hoisted `export const props = {...}`), loadFn, topLevelCode. One per compiled module.",
          "ComponentIR — a single component: name, paramNames, propsType, isClient, isAsync, ssrAwait, mode ('expression' | 'statement'), body, style, exported flags. The body is a tree of the node types below.",
        ],
      },
      { kind: "h2", text: "Node types" },
      {
        kind: "table",
        head: ["Class", "Meaning"],
        rows: [
          ["Expression", "A source-text expression (raw, deps, ast)"],
          ["StaticNode", "HTML element with static attrs"],
          ["TextNode", "Literal text"],
          ["DynamicBinding", "Interpolated expression (text or attribute)"],
          ["OpaqueDynamicRegion", "Conditional region"],
          ["MapRegion", "List rendering (for...of or .map())"],
          ["ForLoop / WhileLoop", "Classic for, for...in, while, do...while"],
          ["SwitchBlock / TryCatch", "switch and try/catch fallback"],
          ["TrackDecl", "Tracked declaration (&[])"],
          ["ComponentRef / ComponentCall", "Child component reference or invocation"],
          ["SlotNode", "props.children rendering"],
          ["ServerBlock / ClientBlock", "{#server} / {#client} blocks"],
          ["HeadBlock / RuntimeStatement", "Head content / verbatim preserved statement"],
        ],
      },
      { kind: "h2", text: "Codegen contract" },
      {
        kind: "list",
        items: [
          "Server walks nodes pushing HTML string chunks to an `__out` array; ServerBlock renders, ClientBlock returns '' — so an island's markup survives and only its client-only parts disappear.",
          "Client walks nodes creating real DOM; ServerBlock returns null, ClientBlock renders. The same tree drives both sides, with each node deciding what it contributes per target.",
          "In hydrate mode, `<!--vsk-->` claim markers precede the subtrees that need client JS — the server tells the hydrator exactly where to attach behavior.",
        ],
      },
    ],
  },
  {
    slug: "static-codegen",
    title: "Static Code Generation",
    description:
      "How the client codegen distinguishes fully-static subtrees from reactive ones, and how hydrate-mode markers work.",
    group: "Compiler",
    blocks: [
      {
        kind: "p",
        text: "The client bundle can't know at runtime which parts of a subtree will ever change — so the compiler decides at build time. Anything fully static — no bindings, no handlers — is constructed once and never touched again by effects. This page is that distinction, and how the server communicates it to the client.",
      },
      { kind: "h2", text: "isStaticIR" },
      {
        kind: "list",
        items: [
          "`isStaticIR(body)` returns true only when every node is a StaticNode or TextNode and no attribute binding (including on* handlers) is dynamic.",
          "A component whose whole body is static gets no effect wiring — its DOM is built once, synchronously, then left alone.",
          "A component with a `<style>` block is never static — the style is appended to the head at runtime and counts as work.",
          "A MapRegion counts as static only when both its template and alternate (the empty branch) are static.",
        ],
      },
      { kind: "h2", text: "Hydrate-mode markers" },
      {
        kind: "p",
        text: "The server emits numeric markers only where the client will need to do something. The rule that decides is the same one on both sides:",
      },
      {
        kind: "code",
        filename: "subtreeNeedsJS",
        code: `subtreeNeedsJS = __vskHydrate && (forceClaim || !isStaticIR(node.children))`,
      },
      {
        kind: "list",
        items: [
          "Static subtrees: no marker, no client-side reconstruction — the server HTML is claimed as-is and left to the browser's parser.",
          "Reactive subtrees: a `<!--vsk-->` marker tells the client hydrator where to attach effects and per-cell update code.",
          "forceClaim forces a claim marker even for a static-looking subtree (e.g. event delegation), so the client still gets a hook.",
        ],
      },
      { kind: "h2", text: "Static props" },
      {
        kind: "p",
        text: "Module-level `export const props = { ... }` static data is hoisted into IRRoot.staticProps and re-emitted exactly once, shared by the server and client outputs. Instead of re-evaluating the object per component instance, both sides read the same hoisted value — which keeps the shipped data identical between SSR HTML and the hydrated client.",
      },
    ],
  },
  {
    slug: "client-reachability",
    title: "Client Reachability",
    description:
      "The compiler's answer to the client/server boundary: the needsClient check, per-block validation, and per-target stripping.",
    group: "Compiler",
    blocks: [
      {
        kind: "p",
        text: "\"Client reachability\" is the compiler's answer to two questions every component raises: does this component need to exist on the client at all, and which parts of its body belong to which side of the wire? Both are decided at compile time, by three mechanisms. The goal is the same: never ship JavaScript for a page that can't use it, and never guess where the server/client boundary lies at runtime.",
      },
      { kind: "h2", text: "Per-component island flag" },
      {
        kind: "code",
        filename: "client-codegen.ts",
        code: `const needsClient = ir.components.some((c) => c.isClient || !isStaticComponent(c));`,
      },
      {
        kind: "list",
        items: [
          "A `client` island always needs client code — it renders on both server and client, so both sides have to know how to build its markup.",
          "A non-client component needs client code only when its body is not fully static — reactive content, on* handlers, effects, bindings all count as needing the client.",
          "A module where every component is static and non-client compiles to an empty client bundle (compileClient returns '' unless forceClient: true). Those pages fetch HTML and nothing else.",
        ],
      },
      { kind: "h2", text: "Per-block validation" },
      {
        kind: "p",
        text: "`validateBlocks(compName, isClient, body)` enforces the boundary statically per component kind: a `client` component containing `{#server}` raises serverBlockInClient; a server component containing `{#client}` raises clientBlockInServer. The check recurses through StaticNode, ServerBlock and ClientBlock children, so the rules apply at any nesting depth — a `{#client}` buried five elements deep in a server component is still a compile error, not a surprise empty region in production.",
      },
      { kind: "h2", text: "Per-target stripping" },
      {
        kind: "p",
        text: "The same IR node means opposite things to each codegen pass, and each side renders only its own:",
      },
      {
        kind: "table",
        head: ["Node", "Server codegen", "Client codegen"],
        rows: [
          ["ServerBlock ({#server})", "rendered", "dropped"],
          ["ClientBlock ({#client})", "dropped", "rendered"],
        ],
      },
      { kind: "h2", text: "Client bundle" },
      {
        kind: "p",
        text: "The browser bundle is built from the runtime's index-client barrel — tree-shaken down to the names actually used, so you never ship the whole runtime — plus the hydration entry points: hydrate, hydrateViewport, hydrateIdle, hydrateOnInteraction, needsHydration, createHydrateWalker, collectVskMarkers, reactiveProps. In code-split mode it is split into per-route `page-<name>.js` chunks, so each page loads only the navigation it actually needs.",
      },
    ],
  },
  {
    slug: "errors",
    title: "Errors & Diagnostics",
    description:
      "VeskError, HttpError, TimeoutError and NotFoundError, plus error handling in components and server code.",
    group: "Compiler",
    blocks: [
      {
        kind: "p",
        text: "Errors are only as good as the signal they carry. `VeskError` is the compiler's structured error type — a stable code, file/line/column, and a suggested fix. `HttpError`, `TimeoutError`, and `NotFoundError` are the runtime's way of telling you the network failed or the page doesn't exist. Reach for them any time a fetch or a route can fail in a way a user will actually hit.",
      },
      { kind: "h2", text: "VeskError" },
      {
        kind: "code",
        filename: "compiler",
        code: `import { VeskError } from '@vesk/compiler';

throw new VeskError({
  code: 'V0412',
  message: 'Reactive read outside a tracked scope',
  file: 'app/page.vsk',
  line: 15,
  column: 3,
  help: 'Move the reactive read inside an effect() or component body.',
});`,
      },
      {
        kind: "list",
        items: [
          "Every VeskError carries a stable V-code, message, file, line, column and a suggested help line — so a failing build tells you both what's wrong and where to look.",
          "`codeFrame()` returns a formatted code frame with the caret pointing at the problem, for the terminal and for the LSP's inline diagnostics.",
        ],
      },
      { kind: "h2", text: "Runtime error types" },
      {
        kind: "table",
        head: ["Type", "Properties", "When thrown"],
        rows: [
          ["HttpError", "status, statusText", "Non-2xx HTTP response"],
          ["TimeoutError", "timeout (ms)", "Request exceeded its timeout"],
          ["NotFoundError", "—", "notFound(); renders not-found.vsk"],
        ],
      },
      {
        kind: "p",
        text: "Used together they give a route a complete failure vocabulary: 404 means \"you asked for something that isn't there\" (and renders `not-found.vsk`), 504 means \"upstream took too long\", and anything 4xx/5xx is an `HttpError` you can branch on.",
      },
      { kind: "h2", text: "In components" },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/SafePage.vsk",
            code: `component SafePage() {
  try {
    <RiskyComponent />
  } catch (err) {
    <p>Error: {err.message}</p>
  }
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/SafePage.vsk",
            code: `component SafePage() {
  try {
    return <RiskyComponent />;
  } catch (err) {
    return <p>Error: {err.message}</p>;
  }
}`,
          },
        ],
      },
      {
        kind: "p",
        text: "A `try { } catch (err) { }` around markup is a first-class region in both body modes: it renders the fallback content when the wrapped components throw. That's your component-level safety net — keep it around anything that can fail at render time.",
      },
      { kind: "h2", text: "In server code" },
      {
        kind: "code",
        filename: "app/api/items/route.ts",
        code: `export async function GET(request: Request) {
  try {
    const data = await fetchExternalData();
    return Response.json(data);
  } catch (err) {
    if (err instanceof TimeoutError) {
      return Response.json(
        { error: \`Request timed out after \${err.timeout}ms\` },
        { status: 504 }
      );
    }
    throw err;
  }
}`,
      },
    ],
  },
  {
    slug: "hydration",
    title: "Hydration",
    description:
      "How Vesk attaches client behavior to server-rendered HTML: vsk markers, claim walkers, and the hydration entry points.",
    group: "Runtime",
    blocks: [
      {
        kind: "p",
        text: "Hydration is how Vesk attaches client behavior — event handlers, effects, tracked bindings — to HTML the server already sent. The crucial move is *not* rebuilding the DOM: the server marks the parts of the DOM that need client JS, and the client hydrator walks those markers and claims the existing DOM in place. Rebuilding would flash the page and waste the server render; claiming keeps it seamless.",
      },
      { kind: "h2", text: "Server side" },
      {
        kind: "code",
        filename: "server-jsgen.ts",
        code: `subtreeNeedsJS = __vskHydrate && (forceClaim || !isStaticIR(node.children))`,
      },
      {
        kind: "list",
        items: [
          "Fully static subtrees get no marker and no client-side reconstruction — the browser keeps the HTML as the parser laid it down.",
          "Reactive subtrees get a `<!--vsk-->` marker; the hydrator claims them in place and wires up the per-cell update code.",
          "Event-handler attributes are excluded from the SSR HTML entirely — the client bundle attaches them, so the markup is clean and the handlers land exactly where the markers say.",
        ],
      },
      { kind: "h2", text: "Client entry points" },
      {
        kind: "p",
        text: "You rarely hydrate everything at once. These entry points let the page match its cost to what the user is doing:",
      },
      {
        kind: "table",
        head: ["Entry", "Behavior"],
        rows: [
          ["hydrate(container, fn, props)", "Hydrate everything immediately"],
          ["hydrateViewport(container, fn, props, rootMargin)", "Hydrate visible markers now; hydrate the rest via IntersectionObserver"],
          ["hydrateIdle(container, fn, props, {chunkSize, timeout})", "Hydrate in chunks via requestIdleCallback; returns { cancel() }"],
          ["hydrateOnInteraction(container, fn, props, {events})", "Hydrate on the first click/touchstart/focus/mouseenter"],
          ["hydrateInitial(container, fn, props)", "Hydrate with a fresh walker (no marker list)"],
          ["needsHydration / hydrationCount(container)", "Whether the container still contains unhydrated vsk markers"],
        ],
      },
      {
        kind: "p",
        text: "Automated hydration uses `hydrateViewport` by default — the fold reacts instantly, the rest after scroll. `createHydrateWalker(container, markerList?)` walks from a marker list or from the container itself, and `reactiveProps(props)` turns the server-rendered prop values into reactive cells on the client so a hydration doesn't lose the tracked-ness of the initial state.",
      },
    ],
  },
  {
    slug: "seo",
    title: "SEO",
    description:
      "Structured data via the JsonLd component and schema generator functions, plus vesk seo to audit your app.",
    group: "Runtime",
    blocks: [
      {
        kind: "p",
        text: "Say you have a blog post or a product page and you want it to show up as a rich result — a headline, a date, an author, a breadcrumb trail. Search engines read that from structured data embedded in the page. Vesk's `JsonLd` component renders a `<script type=\"application/ld+json\">` tag, and a set of schema generators build the right shape for you. All auto-imported from `@vesk/runtime`.",
      },
      { kind: "h2", text: "JsonLd component" },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/BlogPost.vsk",
            code: `component BlogPost(props: { title: string, date: string, author: string }) {
  <div>
    <h1>{props.title}</h1>
    <JsonLd schema={ArticleSchema({
      headline: props.title,
      datePublished: props.date,
      author: { name: props.author },
    })} />
  </div>
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/BlogPost.vsk",
            code: `component BlogPost(props: { title: string, date: string, author: string }) {
  return (
    <div>
      <h1>{props.title}</h1>
      <JsonLd schema={ArticleSchema({
        headline: props.title,
        datePublished: props.date,
        author: { name: props.author },
      })} />
    </div>
  );
}`,
          },
        ],
      },
      {
        kind: "p",
        text: "The pattern is: render the page normally, and drop a `<JsonLd>` nearby with the metadata that search engines care about. The data is computed from the same props the visible content uses, so the structured data and the page can't drift.",
      },
      {
        kind: "list",
        items: [
          "Renders a `<script type=\"application/ld+json\">` tag with the structured data — a snippet search engines can read without executing any JavaScript.",
          "Schema generators return Record<string, unknown> objects with @type set: ArticleSchema, ProductSchema, FAQPageSchema, BreadcrumbListSchema, OrganizationSchema, LocalBusinessSchema, VideoSchema.",
        ],
      },
      {
        kind: "note",
        tone: "info",
        text: "`vesk seo` runs the SEO audit against app/ (RouteOutput checks); pass `--strict` to make audit errors fail the build or exit non-zero. It's the closest thing to a CI gate for the basics — titles, descriptions, structured data — before a page ships.",
      },
    ],
  },
  {
    slug: "bindings",
    title: "Two-Way Bindings",
    description:
      "bindValue, bindChecked and bindGroup for wiring tracked cells to DOM form elements.",
    group: "Runtime",
    blocks: [
      {
        kind: "p",
        text: "State in a cell, value in an input — keeping those two in sync by hand means writing an input listener, a write-back, and a cleanup every single time. `bindValue`, `bindChecked`, and `bindGroup` wire a tracked cell to a DOM form element so the whole connection is one line. All auto-imported from `@vesk/runtime`. That's the round trip for a checkout form or a settings page: type, cell updates, DOM already current.",
      },
      { kind: "h2", text: "bindValue" },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/NameInput.vsk",
            code: `component NameInput() {
  const &[name] = track('');
  <input value={name} ref={bindValue(name)} />
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/NameInput.vsk",
            code: `component NameInput() {
  const &[name] = track('');
  return <input value={name} ref={bindValue(name)} />;
}`,
          },
        ],
      },
      {
        kind: "p",
        text: "The ref is where the wiring happens: bindValue reads the cell once to seed the element's value, then writes the cell back on input/change. The `value={name}` side keeps programmatic updates flowing the other way.",
      },
      {
        kind: "list",
        items: [
          "Reads the cell and sets the element's value; on input/change writes back.",
          "Handles `<input>` and `<select>` (including multiple); type=\"number\" and type=\"range\" coerce to numbers.",
          "Accepts a custom setter: `bindValue(count, (val) => Math.max(0, Number(val)))` — useful for clamping or sanitizing what's written back to the cell.",
          "Returns a cleanup function, run when the element unmounts.",
        ],
      },
      { kind: "h2", text: "bindChecked / bindGroup" },
      {
        kind: "p",
        text: "Checkboxes and radio groups need the same two-way wiring, but with a bit more shape: `bindChecked` owns a single checkbox's `checked` property, and `bindGroup` makes a whole radio group share one cell:",
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/ColorPicker.vsk",
            code: `component ColorPicker() {
  const &[color] = track('blue');

  <div>
    <label><input type="radio" value="red" ref={bindGroup(color)} /> Red</label>
    <label><input type="radio" value="blue" ref={bindGroup(color)} /> Blue</label>
  </div>
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/ColorPicker.vsk",
            code: `component ColorPicker() {
  const &[color] = track('blue');

  return (
    <div>
      <label><input type="radio" value="red" ref={bindGroup(color)} /> Red</label>
      <label><input type="radio" value="blue" ref={bindGroup(color)} /> Blue</label>
    </div>
  );
}`,
          },
        ],
      },
      {
        kind: "table",
        head: ["Function", "Target elements", "Binds"],
        rows: [
          ["bindValue(cell, setFn?)", "<input>, <select>", "value property"],
          ["bindChecked(cell, setFn?)", "<input type=\"checkbox\">", "checked property"],
          ["bindGroup(cell, setFn?)", "<input type=\"radio\">, checkbox", "group value"],
        ],
      },
      {
        kind: "p",
        text: "Each binding returns a cleanup function that runs on unmount, so tearing the element down never leaks a subscription.",
      },
    ],
  },
  {
    slug: "built-in-components",
    title: "Built-in Components",
    description:
      "Image, Portal, Experiment and LoadingIndicator — all auto-imported from @vesk/runtime.",
    group: "Runtime",
    blocks: [
      {
        kind: "p",
        text: "A handful of components ship with the runtime that don't map onto ordinary markup — they solve cross-cutting problems: images that behave, portals, A/B tests, and a page-navigation progress bar. They're used like normal JSX tags and are all auto-imported from `@vesk/runtime`.",
      },
      { kind: "h2", text: "Image" },
      {
        kind: "code",
        filename: "app/components/Hero.vsk",
        code: `<Image src="/hero.jpg" alt="Hero image" width={1200} height={600} priority />`,
      },
      {
        kind: "list",
        items: [
          "Responsive with automatic srcset generation and lazy loading by default.",
          "Props: src, alt, width, height, priority (preload + no lazy), loading ('lazy'|'eager'), sizes, widths, placeholder.",
          "SSR renders a `<span>` wrapper with `<img>`; priority images get `<link rel=\"preload\">` in `<head>`.",
        ],
      },
      { kind: "h2", text: "Portal" },
      {
        kind: "code",
        filename: "app/components/Modal.vsk",
        code: `<Portal target="#modal-root">
  <div class="modal">Hello from portal</div>
</Portal>`,
      },
      {
        kind: "list",
        items: [
          "Teleports children to another DOM node by CSS selector or element — the standard escape hatch for modals and tooltips that need to break out of an overflow: hidden parent.",
          "SSR returns an empty string — client-only.",
        ],
      },
      { kind: "h2", text: "Experiment" },
      {
        kind: "code",
        filename: "app/components/Hero.vsk",
        code: `<Experiment name="hero-variant" variants={[
  { name: 'control', weight: 50, content: <OriginalHero /> },
  { name: 'challenger', weight: 50, content: <NewHero /> },
]} />`,
      },
      {
        kind: "list",
        items: [
          "A/B/n testing with sticky (cookie-based) assignment, default true.",
          "`track: true` records assignments to window.__vsk_experiments.",
        ],
      },
      { kind: "h2", text: "LoadingIndicator" },
      {
        kind: "list",
        items: [
          "Nuxt-style page-navigation progress bar: `<LoadingIndicator color=\"#ff6600\" height={3} />`.",
          "Programmatic control via `useLoadingIndicator()` (start/finish); global defaults via `configureLoadingIndicator({ duration, throttle, hideDelay })`.",
        ],
      },
    ],
  },
  {
    slug: "headless",
    title: "Headless Components",
    description:
      "Show, For, Switch and Match — composable render helpers with no markup and no styling.",
    group: "Runtime",
    blocks: [
      {
        kind: "p",
        text:
          "Sometimes you need conditional or list rendering in a spot where statements can't reach — inside a `return (...)`, inside `{...}` interpolation, or as an argument to `.map()`. That's the problem the headless components solve: `Show`, `For`, `Switch`, `Match` are composable render helpers with no markup and no styling, and they are **auto-imported** from `@vesk/runtime` (no import statement needed).",
      },
      { kind: "h2", text: "Why headless components exist alongside native statements" },
      {
        kind: "p",
        text:
          "Vesk has two rendering systems that overlap in purpose but differ in where they can appear. Understanding the difference is the key to picking the right one, and it's simpler than it looks once you separate statement position from expression position.",
      },
      {
        kind: "p",
        text: "**Native statements: `if`, `for`, `switch`**",
      },
      {
        kind: "p",
        text:
          "The compiler lowers statement-mode `if`, `for...of`, `switch`, and `while` directly into reactive IR. They are always available — no import, no helper, no ceremony — and they're the **default** way to render inside a component body.",
      },
      {
        kind: "list",
        items: [
          "`if (cond) return <p>Loading</p>;` — guard-clause early return, idiomatic for `useFetch` loading/error guards.",
          "`for (const item of items; key item.id) { <li>{item}</li> }` — keyed list rendering that compiles to efficient DOM updates.",
          "`switch (status) { case 'active': return <span>Active</span>; ... }` — multi-way branching with strict equality.",
        ],
      },
      {
        kind: "p",
        text:
          "These work **only in statement position** — the top of a component body, inside a block, or as a guard-clause return. They cannot appear inside a `return (...)` expression, inside `{...}` interpolation, or as arguments to `.map()`.",
      },
      {
        kind: "p",
        text: "**Headless components: `Show`, `For`, `Switch`, `Match`**",
      },
      {
        kind: "p",
        text:
          "Headless components are JSX tags. They work **wherever a JSX tag works** — inside `return (...)`, inside `{...}` interpolation, inside `.map()` callbacks, as children of other components, or as standalone statement-mode JSX. They are values, not control flow: the conditional or loop is a thing you can put anywhere a component can go.",
      },
      {
        kind: "list",
        items: [
          "`<Show when={cond}>...</Show>` — the expression-position `if`. Useful inside a `return (...)`, inside a `map`, or anywhere you need a conditional that is itself just a value.",
          "`<Switch><Match when=.../>...</Switch>` — the expression-position `switch`. Stays flat where nested ternaries would indent. Multiple `<Match>` arms, with `<Match fallback>` for the default.",
          "`<For each={items}>` — the expression-position list render. Takes a `children` render function. In `.vsk`, prefer the native `for...of ; key` loop instead (see below).",
        ],
      },
      {
        kind: "p",
        text: "**When to pick which**",
      },
      {
        kind: "table",
        head: ["Scenario", "Use native statement", "Use headless component"],
        rows: [
          ["Guard clause at top of body", "`if (loading) return <Spinner/>;`", "—"],
          ["Conditional inside `return (...)`", "—", "`return (<Show when={user}>{user.name}</Show>)`"],
          ["Conditional inside a `map`", "—", "`items.map(i => <Show when={i.active}>{i.name}</Show>)`"],
          ["Keyed list, statement body", "`for (const x of items; key x.id) { ... }`", "—"],
          ["List inside `return (...)`", "—", "`return (<ul>{items.map(...)}</ul>)`"],
          ["Multi-way, statement body", "`switch (x) { case 'a': ... }`", "—"],
          ["Multi-way inside JSX", "—", "`<Switch><Match when=...>...</Match>...</Switch>`"],
        ],
      },
      {
        kind: "p",
        text:
          "Both forms compile to the same rendering. Pick whichever reads more naturally in the surrounding code — a statement body reads like a script, an expression body reads like a value.",
      },
      { kind: "h2", text: "Show" },
      {
        kind: "p",
        text:
          "`Show` renders its children when `when` is truthy, otherwise its `fallback`. The `fallback` is a string, a JSX element, or omitted (`null`). It's the headless version of a ternary that doesn't nest.",
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/Greeting.vsk",
            code: `component Greeting(props: { name?: string }) {
  <Show when={props.name} fallback="Hello, stranger">
    <p>Hello, {props.name}</p>
  </Show>
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/Greeting.vsk",
            code: `component Greeting(props: { name?: string }) {
  return (
    <Show when={props.name} fallback="Hello, stranger">
      <p>Hello, {props.name}</p>
    </Show>
  );
}`,
          },
        ],
      },
      { kind: "h2", text: "For" },
      {
        kind: "p",
        text:
          "`For` takes an `each` list and a `children` render function `(item, index) => vnode`. In `.vsk`, JSX render-function children (`{(item, i) => ...}` directly inside the tag) do **not** compile — prefer the native `for...of ; key` loop for list rendering. The `for...of` form compiles to keyed reconciliation and reads like plain JavaScript, so it's both the supported path and the easier one to read.",
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/TodoList.vsk",
            code: `interface Todo { id: number; text: string }

component TodoList(props: { items: Todo[] }) {
  if (props.items.length === 0) return <p>No items</p>;
  <ul>
    for (const todo of props.items; key todo.id) {
      <li>{todo.text}</li>
    }
  </ul>
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/TodoList.vsk",
            code: `interface Todo { id: number; text: string }

component TodoList(props: { items: Todo[] }) {
  return (
    <ul>
      {props.items.map((todo) => <li key={todo.id}>{todo.text}</li>)}
    </ul>
  );
}`,
          },
        ],
      },
      {
        kind: "note",
        tone: "warn",
        text:
          "The `; key` clause you see in the statement-mode example is a Vesk extension, covered on the List Rendering page. Use it for anything ordered or reordered: it compiles to keyed DOM reconciliation — adding, removing, and reordering elements without re-rendering the whole list — which is what keeps long lists fast.",
      },
      { kind: "h2", text: "Switch / Match" },
      {
        kind: "p",
        text:
          "`<Switch>` returns the first child that renders non-empty; `<Match when=...>` renders its children only when `when` is truthy, and a `<Match fallback>` matches the default arm. This is the expression-position analogue of a `switch` with `default` — the tool for a three-or-more-way branch that would be unreadable as nested ternaries. Here it powers a status badge that changes color per order state:",
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/StatusBadge.vsk",
            code: `component StatusBadge(props: { status: string }) {
  <Switch>
    <Match when={props.status === 'active'}>
      <span class="bg-green-100 text-green-800">Active</span>
    </Match>
    <Match when={props.status === 'off'}>
      <span class="bg-gray-100 text-gray-800">Off</span>
    </Match>
    <Match fallback>
      <span class="bg-gray-100 text-gray-800">Unknown</span>
    </Match>
  </Switch>
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/StatusBadge.vsk",
            code: `component StatusBadge(props: { status: string }) {
  return (
    <Switch>
      <Match when={props.status === 'active'}>
        <span class="bg-green-100 text-green-800">Active</span>
      </Match>
      <Match when={props.status === 'off'}>
        <span class="bg-gray-100 text-gray-800">Off</span>
      </Match>
      <Match fallback>
        <span class="bg-gray-100 text-gray-800">Unknown</span>
      </Match>
    </Switch>
  );
}`,
          },
        ],
      },
    ],
  },
  {
    slug: "reactive-core",
    title: "Reactive Core",
    description:
      "The runtime reactivity engine: cells, the microtask scheduler, block trees, scoped flushing, and the flushSync/tick escapes.",
    group: "Runtime",
    blocks: [
      {
        kind: "p",
        text: "The Reactivity page is what you write; this is what actually runs beneath it: tracked cells, derived values, effects, and a block-tree scheduler that decides what flushes when. Most apps never touch these internals directly — but when a list update lands in the wrong order or an effect loops, this is where the reason lives. (The legacy `track.ts` module is dead code and must not be imported.)",
      },
      { kind: "h2", text: "Cells" },
      {
        kind: "list",
        items: [
          "`track(value)` creates a tracked cell. Reads register a dependency on the active reaction; writes mark the owning block dirty and schedule it.",
          "`untrack(fn)` runs fn with tracking disabled; `peek(cell)` reads without registering a dependency. Both are for the cases where a read is a side effect you don't want to subscribe to.",
          "`derived(fn)` is a computed cell: fn runs under an effect and its result is written to the derived cell. Mutating tracked state inside a derived evaluation is forbidden — a derived is expected to be a pure function of its inputs.",
        ],
      },
      { kind: "h2", text: "Scheduler" },
      {
        kind: "list",
        items: [
          "Default mode is microtask-batched: writes enqueue `queueMicrotask(flush_microtasks)`, and one flush runs all queued root blocks. Ten writes in one click still cost exactly one flush.",
          "More than 1001 consecutive flush rounds throw \"Maximum update depth exceeded\" — the effect read-write loop guard.",
          "`flushSync(fn)` switches to synchronous scheduling while fn runs; `tick()` resolves on the next requestAnimationFrame. The two escapes for coordinating with code that can't wait for the microtask queue.",
          "Low-level control: `schedule_update`, `queue_microtask` are exported for the codegen and for advanced consumers.",
        ],
      },
      { kind: "h2", text: "Blocks" },
      {
        kind: "p",
        text: "Every component body and effect compiles to a block in a doubly-linked tree: render blocks, branch blocks, effect blocks, user effects, pre-effects, root blocks and try blocks. The tree is what makes scoped updates possible — a write to a cell knows which block owns it and walks only the affected branches. `destroy_block(pause/resume)`, `pause_block`, `is_destroyed`, and `on_destroy(fn)` manage the lifecycle: tearing a component down destroys its blocks and runs their cleanups.",
      },
      { kind: "h2", text: "Scoped flushing" },
      {
        kind: "p",
        text: "Each cell records its owning block. When a block reads a cell owned by another block the flush is scoped — it can update just that owner and the blocks between them — unless the owner is not an ancestor, in which case the `disable_scoped_flush` guard falls back to a full flush so a cross-branch dependency still updates correctly.",
      },
    ],
  },
  {
    slug: "reconcile",
    title: "Keyed Reconciliation",
    description:
      "The reconcile function: keyed list updates that operate directly on the real DOM with comment markers — no virtual DOM.",
    group: "Runtime",
    blocks: [
      {
        kind: "p",
        text: "Keyed list updates — items arrive from a server, some change, the order shifts — are where naive re-rendering falls apart. `reconcile` patches the real DOM directly: it diffs keys between the old and new lists and applies the smallest set of DOM moves. No virtual DOM, no tree diff — just comment markers as boundaries and the nodes between them.",
      },
      { kind: "h2", text: "reconcile" },
      {
        kind: "code",
        filename: "app/lib/list.ts",
        code: `import { reconcile } from '@vesk/runtime';

const update = reconcile(
  anchor,              // start comment marker node
  endAnchor,           // end comment marker node
  items,               // initial items array
  (item) => item.id,   // key function
  (item, index, effects) => {
    const el = document.createElement('li');
    el.textContent = item.name;
    anchor.parentNode.insertBefore(el, endAnchor);
  }
);

update(newItems);      // efficient patch
update([]);            // clear the list`,
      },
      {
        kind: "p",
        text: "You give it the two comment markers that fence the list region, the current item array, a key function, and a function that builds one element. The returned `update` function then takes a new array and reconciles it in place.",
      },
      { kind: "h2", text: "How it works" },
      {
        kind: "list",
        items: [
          "Comment markers (`<!--k:key-->`) are inserted as boundaries, so the reconciler always knows exactly where a list starts and ends in the live DOM.",
          "On update, the reconciler diffs keys: matching keys reuse DOM nodes, new keys create them, removed keys destroy their blocks, reordered keys move nodes. Content is never rebuilt from scratch.",
          "It diffs keys, not content — O(n) for the common case, which is what keeps long lists cheap to update.",
        ],
      },
      {
        kind: "p",
        text: "The `For` headless component and statement-mode `for` loops both compile to keyed reconciliation; you typically don't call `reconcile` directly. This is the function underneath them, and the escape hatch if you're managing a list outside of a component body.",
      },
    ],
  },
  {
    slug: "deployment",
    title: "Deployment",
    description:
      "One SSR function + one client bundle, platform targets, the Node server, SSR rendering rules, and the browser bundle.",
    group: "Runtime",
    blocks: [
      {
        kind: "p",
        text: "`vesk build` produces one SSR function and one client bundle. What a deploy actually looks like — a long-running Node process, a serverless function, an edge worker — depends on the platform target you build for. The default is a standard Node.js server: local `vesk start` and your VPS both do the same thing.",
      },
      { kind: "h2", text: "Platforms" },
      {
        kind: "code",
        filename: "terminal",
        code: `type Platform = 'node' | 'vercel' | 'netlify' | 'cloudflare' | 'deno' | 'aws' | 'edge' | 'coxmos'`,
      },
      {
        kind: "list",
        items: [
          "Detection order: explicit `--platform` override, then well-known CI env (e.g. DENO_DEPLOYMENT_ID → deno), then `node`.",
          "Node: `vesk start` serves the `.vesk/` build with startProdServer (default port 3000).",
        ],
      },
      { kind: "h2", text: "SSR rendering" },
      {
        kind: "p",
        text: "The same component model renders identically on every platform, because the server codegen is platform-independent. What it does and doesn't put in the HTML:",
      },
      {
        kind: "list",
        items: [
          "Rendered server-side: static HTML, dynamic interpolation, conditionals, .map()/for lists, child component HTML, {#server} blocks, styles.",
          "Not rendered server-side: event-handler attributes (on* — client-only) and {#client} blocks (stripped).",
          "Tracked state renders its initial value; reactivity is client-side.",
          "All dynamic text content is escaped with `escapeHtml()` (XSS-safe); static attribute values from source are trusted.",
        ],
      },
      { kind: "h2", text: "Browser" },
      {
        kind: "p",
        text: "The client bundle is built from the compiled client codegen plus the runtime's index-client barrel, tree-shaken to the exports actually used, with the hydration entry points (hydrate, hydrateViewport, hydrateIdle, hydrateOnInteraction, needsHydration, createHydrateWalker, collectVskMarkers, reactiveProps). A page that only renders static content ships an empty bundle; a page with one island ships exactly the code that island needs.",
      },
    ],
  },
  {
    slug: "lsp",
    title: "Language Server",
    description:
      "@vesk/lsp provides LSP support for .vsk files: diagnostics, autocomplete, go to definition, hover and find references.",
    group: "Tooling",
    blocks: [
      {
        kind: "p",
        text: "Editing `.vsk` shouldn't feel like writing blind. `@vesk/lsp` speaks the Language Server Protocol, so your editor gets the same compiler knowledge `vesk typecheck` uses — inline diagnostics, autocomplete, type info on hover, and jumps across files. Any LSP-capable editor can connect over stdio.",
      },
      { kind: "h2", text: "Features" },
      {
        kind: "list",
        items: [
          "Syntax highlighting — .vsk files are recognized as a TypeScript superset with JSX/TSX grammar.",
          "Diagnostics — compiler errors reported inline in the editor, same as a failed `vesk typecheck` run.",
          "Autocomplete — component names, auto-imported runtime APIs (track, effect, derived), props on known components, CSS class names with the Tailwind plugin.",
          "Go to definition, hover type info, and find references.",
        ],
      },
      { kind: "h2", text: "How it works" },
      {
        kind: "list",
        items: [
          "The LSP wraps the compiler's vskToTsx transform to convert .vsk files to standard TypeScript for the editor — so the editor sees real types, not a bespoke language of its own.",
          "Diagnostics come from the same pipeline that `vesk typecheck` uses, so the editor and the CLI can never disagree about what's an error.",
          "Auto-import suggestions come from the VESK_BUILTINS list in the compiler.",
          "Setup: add `\"*.vsk\": \"typescriptreact\"` to VS Code file associations; any LSP editor can connect over stdio.",
        ],
      },
    ],
  },
  {
    slug: "prettier",
    title: "Prettier Plugin",
    description:
      "@vesk/prettier-plugin formats .vsk files in Prettier, preserving component, &[] and {#server}/{#client} syntax.",
    group: "Tooling",
    blocks: [
      {
        kind: "p",
        text: "Consistent formatting across a team starts with everyone running the same formatter. `@vesk/prettier-plugin` makes `.vsk` a first-class Prettier citizen while preserving the syntax Prettier's parser doesn't know about — `component`, `&[]`, `{#client}`/`{#server}` — so three-space or one-line debates never have to happen again.",
      },
      { kind: "h2", text: "Setup" },
      {
        kind: "code",
        filename: "terminal",
        code: `npm install -D @vesk/prettier-plugin`,
      },
      {
        kind: "code",
        filename: ".prettierrc",
        code: `{
  "plugins": ["@vesk/prettier-plugin"]
}`,
      },
      { kind: "h2", text: "How it works" },
      {
        kind: "list",
        items: [
          "Registers .vsk as a handled extension.",
          "Transforms .vsk syntax to TypeScript/JSX for Prettier's parser, formats, then maps back.",
          "Vesk-specific syntax (`component`, `&[]`, `{#client}`/`{#server}`) is preserved through the format pass — you get consistent formatting without ever re-learning how the special syntax is written.",
        ],
      },
    ],
  },
];

const extendedPages: DocPage[] = [
  ...dataFetchingPages,
  ...middlewarePages,
  ...routingPages,
  ...serverApisPages,
  ...configPluginPages,
  ...apiRoutesPages,
  ...cliPages,
  ...nativePages,
  ...nativeGettingStartedPages,
  ...nativeRoutingPages,
  ...nativeConfigPages,
  ...nativeApisPages,
  ...nativeCommandsPages,
  ...nativeLibrariesPages,
  ...nativeDevPages,
  ...nativeBundlingPages,
  ...nativeComponentsPages,
  ...nativeMotionPages,
  ...nativeWebApisPages,
  ...nativeCompilerPages,
];

const extendedBySlug = new Map(extendedPages.map((p) => [p.slug, p]));

const docSlugOrder = [
  "getting-started",
  "components",
  "track-declarations",
  "reactivity",
  "expression-mode",
  "statement-mode",
  "client-boundary",
  "styles",
  "markdown",
  "config",
  "not-in-the-grammar",
  "pipeline",
  "ir-format",
  "static-codegen",
  "client-reachability",
  "errors",
  "routing",
  "data-fetching",
  "hydration",
  "forms",
  "api-routes",
  "middleware",
  "isr",
  "server-apis",
  "seo",
  "network",
  "bindings",
  "built-in-components",
  "headless",
  "reactive-core",
  "reconcile",
  "deployment",
  "native",
  "native-getting-started",
  "native-routing",
  "native-config",
  "native-apis",
  "native-web-apis",
  "native-components",
  "native-motion",
  "native-libraries",
  "native-dev",
  "native-bundling",
  "native-compiler",
  "native-commands",
  "cli",
  "plugin-api",
  "lsp",
  "prettier",
];

export const docPages: DocPage[] = [
  ...docSlugOrder.map((slug) => {
    const replacement = extendedBySlug.get(slug);
    if (replacement) return replacement;
    const base = basePages.find((p) => p.slug === slug);
    if (base) return base;
    throw new Error(`doc slug missing: ${slug}`);
  }),
  ...extendedPages.filter((p) => !(docSlugOrder as readonly string[]).includes(p.slug)),
];

export const docSlugs = docPages.map((p) => p.slug);

export function getDoc(slug: string) {
  return docPages.find((p) => p.slug === slug);
}

export function getNeighbours(slug: string) {
  const i = docPages.findIndex((p) => p.slug === slug);
  return {
    prev: i > 0 ? docPages[i - 1] : undefined,
    next: i >= 0 && i < docPages.length - 1 ? docPages[i + 1] : undefined,
  };
}

export function headingId(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}