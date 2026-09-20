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
    slug: "native-motion",
    title: "Native Motion",
    description:
      "motion.animate() and friends in native: MotionRef, spring and tween easing mapped to Compose, motionInView, and connected interrupts.",
    group: "Native",
    blocks: [
      {
        kind: "p",
        text: "An animation is how you tell the user the UI is alive — whether something slid, grew, or faded matters less than that nothing teleported. Native motion keeps the `motion.*` API you already know from the web and compiles it onto Compose's animation engine, so one `.vsk` source animates identically on both platforms. What doesn't carry over is the CSS shortcut: `animation-*` classes have no meaning on a Compose view, so the compiler warns and points you to `motion.animate()` instead.",
      },
      { kind: "h2", text: "motion.animate()" },
      {
        kind: "p",
        text: "The core call takes a ref, a set of target property values, and an options object — the same shape as the web API, compiled to Compose `Animatable`/`animate*` calls underneath:",
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/anim/page.vsk",
            code: `export component FadeIn() {
  const ref = { x: 0 }

  <div
    ref={ref}
    class="p-6 rounded-2xl bg-indigo-600 text-white"
    onClick={() => {
      motion.animate(ref, {
        x: 100,
        opacity: 0.5,
      }, { duration: 300 })
    }}
  >
    Tap to slide
  </div>
}`,
          },
          {
            label: "expression mode",
            filename: "app/anim/page.vsk",
            code: `export component FadeIn() {
  const ref = { x: 0 }

  return (
    <div
      ref={ref}
      class="p-6 rounded-2xl bg-indigo-600 text-white"
      onClick={() => {
        motion.animate(ref, {
          x: 100,
          opacity: 0.5,
        }, { duration: 300 })
      }}
    >
      Tap to slide
    </div>
  );
}`,
          },
        ],
      },
      {
        kind: "list",
        items: [
          "Animate `x`, `y`, `scale`, `rotate`, `opacity`, `width`, `height`, and more — the same property names as the web API, so the animation you wrote for the browser is the animation you get on device.",
          "The second argument holds the target property values; the third holds options (`duration`, `ease`, spring properties).",
          "`motion.animate()` returns `MotionControls` — dispatch to `motionAnimateElement` (ref) or `motionAnimateNumber`.",
          "Per-property in-flight animation jobs are cancelled on new calls — connected interrupts work naturally, so a new call cleanly supersedes the one still running with no manual bookkeeping.",
        ],
      },
      { kind: "h2", text: "MotionRef properties" },
      {
        kind: "p",
        text: "These are the animatable properties on a MotionRef, the same surface the web API exposes, mapped one-to-one:",
      },
      {
        kind: "table",
        head: ["Property", "Meaning"],
        rows: [
          ["alpha", "Opacity (0..1)"],
          ["scaleX / scaleY", "Scale along each axis"],
          ["translateX / translateY", "Translation in px"],
          ["rotate", "Rotation in degrees"],
          ["width / height", "Size animation"],
          ["skewX / skewY", "Shear"],
          ["blur / brightness / contrast", "Visual effects"],
          ["bounds", "Layout bounds"],
          ["visible / entered", "Visibility / in-view state"],
          ["viewportW / viewportH", "Viewport dimensions"],
        ],
      },
      { kind: "h2", text: "Timing & easing" },
      {
        kind: "p",
        text: "Motion easing constants come from the real motion-utils values and are mapped to Compose `FontSpline` easing / `SpringSpec`:",
      },
      {
        kind: "table",
        head: ["Easing", "Compose mapping"],
        rows: [
          ["easeIn", "cubicBezier(0.42, 0, 1, 1)"],
          ["easeOut", "cubicBezier(0, 0, 0.58, 1)"],
          ["easeInOut", "cubicBezier(0.42, 0, 0.58, 1)"],
          ["backOut", "cubicBezier(0.33, 1.53, 0.69, 0.99)"],
          ["spring", "SpringSpec via critical damping ratio (damping / 2·sqrt(mass·stiffness))"],
        ],
      },
      { kind: "h2", text: "Other motion helpers" },
      {
        kind: "p",
        text: "Beyond the core call, the usual motion-utils helpers exist under their same names, so imports you already know keep working in Kotlin:",
      },
      {
        kind: "list",
        items: [
          "`motionSpring`, `motionTween`, `motionEase`, `motionCubicBezier`, `motionSteps`, `motionReverseEasing`, `motionMirrorEasing`, `motionDelay` — the animation option constructors.",
          "`motionInView(element, options)` — triggers when the element enters the viewport.",
          "`rememberMotionRef` — Compose-memoized MotionRef.",
          "`motionGraphics` / `motionStagger(item, index)` — stagger children animations.",
          "`motionScroll` / `motionDrag` / `motionHover` / `motionPress` / `motionFocus` — gesture and scroll-driven animation counters.",
        ],
      },
      { kind: "h2", text: "motionInView" },
      {
        kind: "p",
        text: "Reveal-on-scroll needs the element to tell you when it's on screen. `motionInView` resolves when the element enters the viewport; the example flips a tracked cell to swap the class between hidden and revealed:",
      },
      {
        kind: "tabs",
        tabs: [
          {
            label: "statement mode",
            filename: "app/landing/page.vsk",
            code: `export component Landing() {
  const &[inView] = track(false)

  <motion.div
    ref={(el) => {
      motionInView(el, { once: true }).then(() => { inView = true })
    }}
    class={inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
  >
    Reveal on scroll
  </motion.div>
}`,
          },
          {
            label: "expression mode",
            filename: "app/landing/page.vsk",
            code: `export component Landing() {
  const &[inView] = track(false)

  return (
    <motion.div
      ref={(el) => {
        motionInView(el, { once: true }).then(() => { inView = true })
      }}
      class={inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
    >
      Reveal on scroll
    </motion.div>
  );
}`,
          },
        ],
      },
      {
        kind: "note",
        tone: "warn",
        text: "CSS `animation-*` classes are unsupported in native and emit a compile-time warning pointing to `motion.animate()` — the runtime's motion helpers are the supported animation surface.",
      },
    ],
  },
];