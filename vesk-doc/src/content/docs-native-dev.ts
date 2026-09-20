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
    slug: "native-dev",
    title: "Native Dev Modes",
    description:
      "The three vesk-native dev loops: on-device fast reload, the desktop JVM preview with Compose Hot Reload, and the web browser preview with the device.* shim.",
    group: "Native",
    blocks: [
      {
        kind: "p",
        text: "Waiting out a full `gradle installDebug` cycle every time you tweak a button color is the fastest way to wear a mobile dev loop down — and it's the problem `vesk-native dev` solves. Your `.vsk` source compiles to Kotlin; what these modes decide is where the smoke gets tested. The default targets a connected Android device with a regenerate-reinstall-relaunch loop, `--desktop` opens a JVM window with Compose Hot Reload, and `--web` previews in a browser with per-file HMR. All three watch `.vsk` files, project modules, `veskconfig.*`, and `libraries.json`, so the toolchain always knows what changed, however you edit.",
      },
      { kind: "h2", text: "Mode comparison" },
      {
        kind: "table",
        head: ["Mode", "Flag", "Target", "Reload", "Cell state"],
        rows: [
          ["On-device", "(default)", "adb device / emulator", "Regenerate + installDebug + relaunch (5-15s)", "Reset on each relaunch"],
          ["Desktop", "--desktop", "JVM window", "Compose Hot Reload (ms)", "Preserved"],
          ["Web", "--web", "Browser", "Per-file HMR over WebSocket", "Preserved"],
        ],
      },
      { kind: "h2", text: "On-device fast reload (default)" },
      {
        kind: "p",
        text: "This is the loop that matches how the app actually ships — real hardware, a real `installDebug`, the genuine relaunch. Reach for it when the question is \"does this feel right in the hand?\" rather than \"does this color work?\".",
      },
      {
        kind: "code",
        filename: "terminal",
        language: "text",
        code: `vesk-native dev   # requires a connected adb device or emulator`,
      },
      {
        kind: "list",
        items: [
          "Verifies an adb device is present, runs `gradle installDebug`, and starts `MainActivity` via `am start` — you get a real installed app on real hardware, not a preview.",
          "Watches `.vsk`, project `.ts/.js/.mjs/.tsx/.jsx` modules (skipping `node_modules`, `.vesk`, `.git`), `veskconfig.*`, and `libraries.json`, coalescing edits through a 250ms debounce in a 500ms loop so rapid saves don't trigger a stampede of rebuilds.",
          "On change: regenerates, reinstalls, relaunches. The target cycle is 5–15 seconds — fast enough to keep momentum, slow enough that the moment an edit turns purely cosmetic you'll reach for `--desktop`.",
          "Cell state is lost on each relaunch — effects and tracked values re-init from scratch, so stateful debugging belongs in a mode whose reload you don't pay a reinstall for.",
        ],
      },
      { kind: "h2", text: "Desktop preview (--desktop)" },
      {
        kind: "p",
        text: "When the change is a spacing value or a class swap, reinstalling an APK is overkill. `--desktop` compiles the same `.vsk` source into a Compose window that hot-reloads in milliseconds, so the only thing you give up is the touchscreen.",
      },
      {
        kind: "code",
        filename: "terminal",
        language: "text",
        code: `vesk-native dev --desktop`,
      },
      {
        kind: "list",
        items: [
          "Generates the project with `devDesktop: true`, then runs `:shared:hotRunJvm --auto` detached — a desktop window with Compose Hot Reload.",
          "Edits push in milliseconds and cells are preserved, so the exact interaction state you're refining survives each edit.",
          "JBR (JetBrains Runtime) 21 is auto-provisioned for the desktop target.",
          "The same watcher recompiles `:shared:compileKotlinJvm` on change.",
          "The desktop target is a preview convenience — the app still ships as an Android APK.",
        ],
      },
      {
        kind: "note",
        tone: "warn",
        text: "On some setups the desktop Compose Hot Reload orchestration-socket launch is blocked (see HMR-STATUS notes in the repo). The loop degrades to full-recompile reloads; the web preview is a reliable fallback for rapid iteration.",
      },
      { kind: "h2", text: "Web preview (--web)" },
      {
        kind: "p",
        text: "One step faster still: the browser. `--web` compiles the same `.vsk` with the web compiler and serves it through the web adapter's client bundle pipeline, trading native fidelity for per-file HMR and zero setup — the tightest loop of the three.",
      },
      {
        kind: "code",
        filename: "terminal",
        language: "text",
        code: `vesk-native dev --web            # http://localhost:5173
vesk-native dev --web --port 8080`,
      },
      {
        kind: "list",
        items: [
          "Compiles `.vsk` with the web compiler (`@vesk/compiler`) and serves the result through the web adapter's client bundle pipeline on port 5173 by default.",
          "Per-file HMR over WebSocket — component edits hot-swap with no reload.",
          "`device.*` APIs map to real browser equivalents where possible through the `web-preview-shim`: Notification, file input, MediaRecorder, clipboard copy, vibrate, Web Share, speechSynthesis, geolocation, Battery Status, Network Information, OPFS, URL schemes.",
          "Unmapped device APIs warn instead of throwing — layout iteration never crashes the preview.",
          "The shim ships nowhere in a built app; it exists only in the dev toolchain, so nothing about previewing changes what you ship.",
        ],
      },
      {
        kind: "note",
        tone: "warn",
        text: "The web preview is for layout iteration and fast feedback, not a substitute for on-device testing — platform APIs degrade to nearest-browser equivalents and native look-and-feel differs.",
      },
      { kind: "h2", text: "Watcher rules" },
      {
        kind: "p",
        text: "Whichever mode you run, the watcher underneath is the same machine. These rules apply everywhere:",
      },
      {
        kind: "list",
        items: [
          "Watched extensions: `.vsk`, project `.ts`/`.js`/`.mjs`/`.tsx`/`.jsx` modules.",
          "Skipped directories: `node_modules`, `.vesk`, `.git`.",
          "Config changes (`veskconfig.*`, `libraries.json`) trigger a full regeneration.",
          "Edits are coalesced through a 250ms debounce.",
        ],
      },
    ],
  },
];