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
    slug: "native-components",
    title: "Native Framework Components",
    description:
      "PullToRefresh, SwipeToDismiss, CardStack, Link, NavLink, and Outlet — the Material3-backed framework components emitted as native composed calls.",
    group: "Native",
    blocks: [
      {
        kind: "p",
        text: "Every mobile app ends up hand-rolling the same small set of behaviors: navigating between routes, refreshing a feed, swiping a row away, flipping through a deck of cards, rendering the child of a nested layout. In Vesk Native those are real components rather than something you build by hand, and because the compiler emits them as named Compose calls they run at native speed with no JavaScript layer underneath. They're auto-available in any `.vsk` file — no import needed.",
      },
      {
        kind: "note",
        tone: "info",
        text: "The complete list of framework components is the `FRAMEWORK_COMPONENT_CALLS` set: `Link`, `NavLink`, `Outlet`, `PullToRefresh`, `SwipeToDismiss`, `CardStack`. Any other capitalized component name is treated as an unknown tag and fails the build.",
      },
      { kind: "h2", text: "Link & NavLink" },
      {
        kind: "p",
        text: "Navigation in a native app is still a route transition. `Link` navigates to a route on tap; `NavLink` is the same call plus an active-state style for the route you're currently on, so nav bars know where the user is without any route-inspection glue.",
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/components/Nav.vsk",
            code: `component Nav() {
  <nav class="flex gap-3 p-4 border-b">
    <Link href="/">
      <span class="font-bold">Home</span>
    </Link>
    <NavLink href="/shop" class="text-gray-600">
      Shop
    </NavLink>
  </nav>
}`,
          },
          {
            label: "expression mode",
            filename: "app/components/Nav.vsk",
            code: `component Nav() {
  return (
    <nav class="flex gap-3 p-4 border-b">
      <Link href="/">
        <span class="font-bold">Home</span>
      </Link>
      <NavLink href="/shop" class="text-gray-600">
        Shop
      </NavLink>
    </nav>
  );
}`,
          },
        ],
      },
      {
        kind: "list",
        items: [
          "`<Link href=\"/path\" class=\"...\">` — navigates to the route on tap.",
          "`<NavLink href=\"/path\" class=\"...\">` — same, plus an active style for the current route.",
          "Both take `class` and `modifier` (the `LinkProps` shape: `{ href, class, modifier }`).",
          "Tap is handled through the runtime `Link` composable — no JavaScript involved.",
        ],
      },
      { kind: "h2", text: "Outlet" },
      {
        kind: "p",
        text: "`<Outlet />` renders the child route inside a nested layout — the native counterpart of `{props.children}` in file-based layouts. Both resolve to the same child-rendering slot, so a layout tree you designed for the web keeps the identical shape in native.",
      },
      { kind: "h2", text: "PullToRefresh" },
      {
        kind: "p",
        text: "A feed is dishonest if it can't be refreshed. `PullToRefresh` wraps content, surfaces the Material3 indicator on the pull gesture, and calls `onRefresh` when the user commits. The refresh state is yours to drive — the component only knows what `isRefreshing` tells it.",
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/feed/page.vsk",
            code: `export component Feed() {
  const &[refreshing] = track(false)

  <PullToRefresh
    isRefreshing={refreshing}
    onRefresh={() => {
      refreshing = true
      device.refreshNetwork(() => { refreshing = false })
    }}
  >
    <List items={posts} />
  </PullToRefresh>
}`,
          },
          {
            label: "expression mode",
            filename: "app/feed/page.vsk",
            code: `export component Feed() {
  const &[refreshing] = track(false)

  return (
    <PullToRefresh
      isRefreshing={refreshing}
      onRefresh={() => {
        refreshing = true
        device.refreshNetwork(() => { refreshing = false })
      }}
    >
      <List items={posts} />
    </PullToRefresh>
  );
}`,
          },
        ],
      },
      {
        kind: "list",
        items: [
          "Pull gesture triggers `onRefresh`; while `isRefreshing` is true the spinner is shown.",
          "Material3 pull-to-refresh indicator with the app's theme colors.",
          "Wire `isRefreshing` to a tracked cell and reset it in your refresh logic — the component reports the gesture, you own the network call and its loading state.",
        ],
      },
      { kind: "h2", text: "SwipeToDismiss" },
      {
        kind: "p",
        text: "The inbox interaction: a horizontal swipe reveals the background and reports that the row should go away. `SwipeToDismiss` gives you the gesture; what the dismissal means — deleting, archiving, undoing — stays in your component.",
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/inbox/[id]/page.vsk",
            code: `export component Message() {
  const &[dismissed] = track(false)

  if (dismissed) return <p class="p-4 text-gray-500">Message deleted.</p>

  <SwipeToDismiss
    onDismiss={() => { dismissed = true }}
    background="red"
  >
    <div class="p-4 border-b">
      <h2>Flight from Lisbon</h2>
      <p>Boarding at gate 12...</p>
    </div>
  </SwipeToDismiss>
}`,
          },
          {
            label: "expression mode",
            filename: "app/inbox/[id]/page.vsk",
            code: `export component Message() {
  const &[dismissed] = track(false)

  if (dismissed) return <p class="p-4 text-gray-500">Message deleted.</p>

  return (
    <SwipeToDismiss
      onDismiss={() => { dismissed = true }}
      background="red"
    >
      <div class="p-4 border-b">
        <h2>Flight from Lisbon</h2>
        <p>Boarding at gate 12...</p>
      </div>
    </SwipeToDismiss>
  );
}`,
          },
        ],
      },
      {
        kind: "list",
        items: [
          "Swipe horizontally to reveal the background and trigger `onDismiss`.",
          "`background` accepts a color string (e.g. `red`) or the default Material3 surface.",
          "The dismissed state is yours — the component only reports the gesture. The example flips a tracked cell and lets a guard-clause `if (dismissed)` (or its expression-mode equivalent) drop the row.",
        ],
      },
      { kind: "h2", text: "CardStack" },
      {
        kind: "p",
        text: "A deck of cards for the swipe-through-a-feed interaction — deals, matches, photos. The top card is interactive and swiping it away reveals the next one, with Compose's `CardStack` supplying the gesture and depth handling.",
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/deals/page.vsk",
            code: `export component Deals() {
  const cards = [
    { id: 1, title: 'Winter sale' },
    { id: 2, title: 'Student deal' },
    { id: 3, title: 'Members only' },
  ]

  <CardStack>
    for (const card of cards; key card.id) {
      <div class="rounded-2xl p-6 bg-white shadow-lg m-4">
        <h2 class="text-lg font-bold">{card.title}</h2>
        <p class="text-gray-500">Swipe to dismiss</p>
      </div>
    }
  </CardStack>
}`,
          },
          {
            label: "expression mode",
            filename: "app/deals/page.vsk",
            code: `export component Deals() {
  const cards = [
    { id: 1, title: 'Winter sale' },
    { id: 2, title: 'Student deal' },
    { id: 3, title: 'Members only' },
  ]

  return (
    <CardStack>
      {cards.map((card) => (
        <div class="rounded-2xl p-6 bg-white shadow-lg m-4">
          <h2 class="text-lg font-bold">{card.title}</h2>
          <p class="text-gray-500">Swipe to dismiss</p>
        </div>
      ))}
    </CardStack>
  );
}`,
          },
        ],
      },
      {
        kind: "list",
        items: [
          "A horizontally stacked deck — the top card is interactive; swiping it reveals the next.",
          "Children are cards; the stack renders them offset and stacked like a deck.",
          "Compose's `CardStack` provides the gesture and depth handling.",
        ],
      },
      {
        kind: "note",
        tone: "warn",
        text: "Framework components are the ONLY capitalized tags the native compiler understands as built-ins. Custom components are resolved from the declared components in your `.vsk` files or imported `@vesk/<library>` components — anything else capitalized is an unknown tag and fails the build.",
      },
    ],
  },
];