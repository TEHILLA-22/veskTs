import { createHydrateWalker, onHydrationMismatch } from '@vesk/runtime/src/hydrate';
import { createLayoutSlot, trackSlotContent, auditLayoutSlots } from '@vesk/runtime/src/layout';
import type { HydrationIssue } from '@vesk/runtime/src/hydrate';

let passed = 0;
let failed = 0;

function describe(name, fn) {
  console.log(`\n${name}`);
  fn();
}

function it(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      return r.then(
        () => { passed++; console.log(`  ✓ ${name}`); },
        (e) => { failed++; console.log(`  ✗ ${name}`); console.log(`    ${e && e.message ? e.message : e}`); },
      );
    }
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

function expect(actual) {
  const show = (v) => {
    if (v == null || typeof v !== 'object') return JSON.stringify(v);
    try { return JSON.stringify(v); } catch { return Object.prototype.toString.call(v); }
  };
  return {
    toBe(expected) {
      if (actual !== expected) throw new Error(`Expected ${show(expected)}, got ${show(actual)}`);
    },
    toEqual(expected) {
      let a, e;
      try {
        a = JSON.stringify(actual);
        e = JSON.stringify(expected);
      } catch {
        throw new Error('Expected deep-equal values (unstringifiable)');
      }
      if (a !== e) throw new Error(`Expected ${e}, got ${a}`);
    },
    toContain(expected) {
      if (!actual.includes(expected)) throw new Error(`Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(expected)}`);
    },
  };
}

// Minimal DOM mock (same model as hydrate.test.ts): linked-list nodes with
// sibling traversal, insertBefore/appendChild/remove/contains, and a comment
// TreeWalker with acceptNode filtering.
let _nodeId = 0;
function makeNode(type, tag) {
  const node = {
    id: _nodeId++,
    nodeType: type,
    tagName: type === 1 ? (tag || 'DIV').toUpperCase() : undefined,
    data: type === 1 ? undefined : '',
    parentNode: null,
    childNodes: [],
    _attrs: new Map(),
  };
  const def = (name, getter) => Object.defineProperty(node, name, { get: getter, enumerable: true, configurable: true });
  def('children', () => node.childNodes.filter((c) => c.nodeType === 1));
  def('firstChild', () => node.childNodes[0] || null);
  def('nextSibling', () => {
    if (!node.parentNode) return null;
    const i = node.parentNode.childNodes.indexOf(node);
    return i >= 0 && i < node.parentNode.childNodes.length - 1 ? node.parentNode.childNodes[i + 1] : null;
  });
  def('nextElementSibling', () => {
    for (let n = node.nextSibling; n; n = n.nextSibling) if (n.nodeType === 1) return n;
    return null;
  });
  def('parentElement', () => (node.parentNode && node.parentNode.nodeType === 1 ? node.parentNode : null));
  def('isConnected', () => {
    let n = node;
    while (n.parentNode) n = n.parentNode;
    return !!n._connected;
  });
  def('textContent', () => (node.data !== undefined ? node.data : node.childNodes.map((c) => c.textContent).join('')));
  def('nodeValue', () => (node.nodeType === 8 || node.nodeType === 3 ? node.data : null));
  node.appendChild = (c) => {
    if (c.parentNode !== null) c.remove();
    node.childNodes.push(c);
    c.parentNode = node;
    return c;
  };
  node.insertBefore = (c, ref) => {
    if (ref == null) return node.appendChild(c);
    if (c.parentNode !== null) c.remove();
    const i = node.childNodes.indexOf(ref);
    if (i === -1) return node.appendChild(c);
    node.childNodes.splice(i, 0, c);
    c.parentNode = node;
    return c;
  };
  node.removeChild = (c) => {
    const i = node.childNodes.indexOf(c);
    if (i !== -1) { node.childNodes.splice(i, 1); c.parentNode = null; }
    return c;
  };
  node.remove = () => { if (node.parentNode) node.parentNode.removeChild(node); };
  node.contains = (other) => {
    for (let n = other; n; n = n.parentNode) if (n === node) return true;
    return false;
  };
  node.getAttribute = (k) => (node._attrs.has(k) ? node._attrs.get(k) : null);
  node.setAttribute = (k, v) => { node._attrs.set(k, String(v)); };
  node.hasAttribute = (k) => node._attrs.has(k);
  return node;
}

function commentWalker(root) {
  const out = [];
  (function walk(n) {
    for (const c of n.childNodes) { if (c.nodeType === 8) out.push(c); walk(c); }
  })(root);
  return out;
}

function mockDocument() {
  const doc = {
    head: { appendChild() {} },
    createElement(tag) { return makeNode(1, tag); },
    createComment(text) { const c = makeNode(8); c.data = text; return c; },
    createTextNode(text) { const t = makeNode(3); t.data = text; return t; },
    createTreeWalker(root, _whatToShow, filter) {
      const comments = commentWalker(root);
      let i = 0;
      const w = {
        currentNode: null,
        nextNode() {
          while (i < comments.length) {
            const node = comments[i++];
            const res = filter ? filter.acceptNode(node) : 1;
            if (res === 1) { w.currentNode = node; return node; }
          }
          return null;
        },
      };
      return w;
    },
  };
  globalThis.document = doc;
  return doc;
}

function el(doc, tag, kids) {
  const e = doc.createElement(tag);
  for (const k of kids || []) e.appendChild(k);
  return e;
}

function marker(doc, text) {
  return doc.createComment(text);
}

// Builds the canonical layout DOM:
//   root > nav-marker, nav, main > slot-open, page-marker, section, slot-end,
//         footer-marker, footer
function layoutDom(doc) {
  const section = el(doc, 'section');
  const main = el(doc, 'main', [
    marker(doc, 'vsk-slot'),
    marker(doc, 'vsk:c:Page'),
    section,
    marker(doc, 'vsk-slot-end'),
  ]);
  const nav = el(doc, 'nav');
  const footer = el(doc, 'footer');
  const root = el(doc, 'div', [
    marker(doc, 'vsk:c:Nav'),
    nav,
    main,
    marker(doc, 'vsk:c:Footer'),
    footer,
  ]);
  root._connected = true;
  return { root, nav, main, section, footer };
}

// Same shape with id-stamped boundaries (`vsk-slot:s1` … `vsk-slot-end:s1`).
function idLayoutDom(doc, openId, closeId) {
  const section = el(doc, 'section');
  const main = el(doc, 'main', [
    marker(doc, 'vsk-slot:' + openId),
    marker(doc, 'vsk:c:Page'),
    section,
    marker(doc, 'vsk-slot-end:' + closeId),
  ]);
  const nav = el(doc, 'nav');
  const footer = el(doc, 'footer');
  const root = el(doc, 'div', [
    marker(doc, 'vsk:c:Nav'),
    nav,
    main,
    marker(doc, 'vsk:c:Footer'),
    footer,
  ]);
  root._connected = true;
  return { root, nav, main, section, footer };
}

// Nested layout inside an outer slot:
//   outerMain > open(outer) marker(c:Inner) divInner > open(inner)
//             marker(c:InnerPage) section close(inner) … close(outer)
function nestedDom(doc, outerOpen, outerClose, innerOpen, innerClose) {
  const section = el(doc, 'section');
  const divInner = el(doc, 'div', [
    marker(doc, innerOpen),
    marker(doc, 'vsk:c:InnerPage'),
    section,
    marker(doc, innerClose),
  ]);
  const outerMain = el(doc, 'main', [
    marker(doc, outerOpen),
    marker(doc, 'vsk:c:Inner'),
    divInner,
    marker(doc, outerClose),
  ]);
  const root = el(doc, 'div', [outerMain]);
  root._connected = true;
  return { root, outerMain, divInner, section };
}

function findComment(root, text) {
  let found = null;
  (function walk(n) {
    for (const c of n.childNodes) {
      if (c.nodeType === 8 && c.data === text) { found = c; return; }
      walk(c);
      if (found) return;
    }
  })(root);
  return found;
}

mockDocument();

describe('layout slot scoping', () => {
  it('scopes page markers between boundaries out of the shared walk', () => {
    const doc = globalThis.document;
    const { root, nav, main, section, footer } = layoutDom(doc);
    const walker = createHydrateWalker(root);
    // Real claim order: the layout claims its nav first, then the slot
    // scopes, then the footer claims past the neutralized page markers.
    expect(walker.nextElement('nav')).toBe(nav);
    const slot = createLayoutSlot(walker, main);
    expect(slot.scoped).toBe(true);
    // The slot walker claims the page section…
    const claimed = slot.walker.nextElement('section');
    expect(claimed).toBe(section);
    // …while the shared walker skips straight to the footer — the taken page
    // marker no longer drifts the footer claim.
    const after = walker.nextElement('footer');
    expect(after).toBe(footer);
  });

  it('falls back to the shared walker without SSR boundaries (legacy output)', () => {
    const doc = globalThis.document;
    const section = el(doc, 'section');
    const main = el(doc, 'main', [marker(doc, 'vsk:c:Page'), section]);
    const root = el(doc, 'div', [main]);
    root._connected = true;
    const walker = createHydrateWalker(root);
    const slot = createLayoutSlot(walker, main);
    expect(slot.scoped).toBe(false);
    expect(slot.walker).toBe(walker);
  });

  it('consumes each boundary pair once (double slots degrade, never mis-scope)', () => {
    const doc = globalThis.document;
    const { main } = layoutDom(doc);
    const root = main.parentNode;
    const walker = createHydrateWalker(root);
    const first = createLayoutSlot(walker, main);
    expect(first.scoped).toBe(true);
    const second = createLayoutSlot(walker, main);
    expect(second.scoped).toBe(false);
    expect(second.walker).toBe(walker);
  });

  it('outer slot neutralizes nested markers; inner scope re-owns them', () => {
    const doc = globalThis.document;
    const { root, outerMain, divInner, section } = nestedDom(doc, 'vsk-slot', 'vsk-slot-end', 'vsk-slot', 'vsk-slot-end');
    const walker = createHydrateWalker(root);
    const outer = createLayoutSlot(walker, outerMain);
    expect(outer.scoped).toBe(true);
    // The outer walker owns only the depth-0 inner-layout root marker…
    expect(outer.walker.nextElement('div')).toBe(divInner);
    expect(outer.walker.done()).toBe(true);
    // …while the inner page marker stays live in the DOM (neutralized in the
    // ancestor cursor, not removed) for the inner scope to re-scan.
    const live = findComment(root, 'vsk:c:InnerPage');
    expect(live !== null && live.parentNode !== null).toBe(true);
    // The inner layout scopes its own pair from the live DOM…
    const inner = createLayoutSlot(outer.walker, divInner);
    expect(inner.scoped).toBe(true);
    expect(inner.walker.nextElement('section')).toBe(section);
    // …and the ancestor walk is blind to slot content: nothing left to adopt.
    const fresh = walker.nextElement('div');
    expect(fresh !== divInner && fresh.parentNode === null).toBe(true);
  });
});

describe('layout slot id pairing', () => {
  it('scopes an id-stamped pair by exact id', () => {
    const doc = globalThis.document;
    const { root, nav, main, section, footer } = idLayoutDom(doc, 's1', 's1');
    const walker = createHydrateWalker(root);
    expect(walker.nextElement('nav')).toBe(nav);
    const slot = createLayoutSlot(walker, main);
    expect(slot.scoped).toBe(true);
    expect(slot.walker.nextElement('section')).toBe(section);
    expect(walker.nextElement('footer')).toBe(footer);
  });

  it('refuses an id-stamped open with no same-id close (no positional fallback)', () => {
    const doc = globalThis.document;
    const { root, main } = idLayoutDom(doc, 's1', 's2');
    const walker = createHydrateWalker(root);
    const slot = createLayoutSlot(walker, main);
    expect(slot.scoped).toBe(false);
    expect(slot.walker).toBe(walker);
  });

  it('refuses a legacy open facing only id-stamped closes (version skew)', () => {
    const doc = globalThis.document;
    const section = el(doc, 'section');
    const main = el(doc, 'main', [
      marker(doc, 'vsk-slot'),
      marker(doc, 'vsk:c:Page'),
      section,
      marker(doc, 'vsk-slot-end:s9'),
    ]);
    const root = el(doc, 'div', [main]);
    root._connected = true;
    const walker = createHydrateWalker(root);
    const slot = createLayoutSlot(walker, main);
    expect(slot.scoped).toBe(false);
    expect(slot.walker).toBe(walker);
  });

  it('nested distinct ids scope independently', () => {
    const doc = globalThis.document;
    const { root, outerMain, divInner, section } = nestedDom(doc, 'vsk-slot:s1', 'vsk-slot-end:s1', 'vsk-slot:s2', 'vsk-slot-end:s2');
    const walker = createHydrateWalker(root);
    const outer = createLayoutSlot(walker, outerMain);
    expect(outer.scoped).toBe(true);
    expect(outer.walker.nextElement('div')).toBe(divInner);
    expect(outer.walker.done()).toBe(true);
    const live = findComment(root, 'vsk:c:InnerPage');
    expect(live !== null && live.parentNode !== null).toBe(true);
    const inner = createLayoutSlot(outer.walker, divInner);
    expect(inner.scoped).toBe(true);
    expect(inner.walker.nextElement('section')).toBe(section);
    const fresh = walker.nextElement('div');
    expect(fresh !== divInner && fresh.parentNode === null).toBe(true);
  });

  it('audit flags an id mismatch between open and close', () => {
    const doc = globalThis.document;
    const { root } = idLayoutDom(doc, 's1', 's2');
    const res = auditLayoutSlots(root);
    expect(res.ok).toBe(false);
    expect(res.unbalanced).toBe(1);
  });
});

describe('layout async slot anchoring', () => {
  it('inserts detached async content before slot-end (SSR position)', async () => {
    const doc = globalThis.document;
    const { main } = layoutDom(doc);
    const kids = main.childNodes.map((c) => (c.nodeType === 8 ? `<!--${c.data}-->` : `<${c.tagName.toLowerCase()}>`));
    expect(kids).toEqual(['<!--vsk-slot-->', '<!--vsk:c:Page-->', '<section>', '<!--vsk-slot-end-->']);
    const fresh = el(doc, 'article');
    const close = main.childNodes[main.childNodes.length - 1];
    const out = await trackSlotContent(Promise.resolve(fresh), close);
    expect(out).toBe(fresh);
    const order = main.childNodes.map((c) => (c.nodeType === 8 ? `<!--${c.data}-->` : `<${c.tagName.toLowerCase()}>`));
    expect(order).toEqual(['<!--vsk-slot-->', '<!--vsk:c:Page-->', '<section>', '<article>', '<!--vsk-slot-end-->']);
  });

  it('leaves attached (claimed-in-place) content alone', async () => {
    const doc = globalThis.document;
    const { main, section } = layoutDom(doc);
    const before = main.childNodes.slice();
    const out = await trackSlotContent(Promise.resolve(section), main.childNodes[main.childNodes.length - 1]);
    expect(out).toBe(section);
    expect(main.childNodes.length).toBe(before.length);
    expect(main.childNodes.every((c, i) => c === before[i])).toBe(true);
  });

  it('drops late content when the boundary detached (post-navigation) and reports', async () => {
    const doc = globalThis.document;
    const issues: HydrationIssue[] = [];
    onHydrationMismatch((i) => { issues.push(i); });
    try {
      const { main } = layoutDom(doc);
      const close = main.childNodes[main.childNodes.length - 1];
      close.remove(); // navigation replaced the DOM
      const fresh = el(doc, 'article');
      await trackSlotContent(Promise.resolve(fresh), close);
      expect(fresh.parentNode).toBe(null);
      expect(issues.some((i) => i.kind === 'leftover-marker')).toBe(true);
    } finally {
      onHydrationMismatch(null);
    }
  });
});

describe('layout slot audit', () => {
  it('passes a balanced, fully-claimed slot region', () => {
    const doc = globalThis.document;
    const { root } = layoutDom(doc);
    // Simulate claiming: remove the vsk: markers (walkers remove on adopt).
    for (const c of commentWalker(root)) {
      if (typeof c.data === 'string' && c.data.startsWith('vsk:')) c.remove();
    }
    const res = auditLayoutSlots(root);
    expect(res.ok).toBe(true);
    expect(res.unbalanced).toBe(0);
    expect(res.leftoverInSlot).toBe(0);
  });

  it('flags unbalanced boundaries', () => {
    const doc = globalThis.document;
    const main = el(doc, 'main', [marker(doc, 'vsk-slot'), el(doc, 'section')]);
    const root = el(doc, 'div', [main]);
    root._connected = true;
    const res = auditLayoutSlots(root);
    expect(res.ok).toBe(false);
    expect(res.unbalanced).toBe(1);
  });

  it('flags unclaimed markers surviving inside a slot', () => {
    const doc = globalThis.document;
    const { root } = layoutDom(doc);
    const res = auditLayoutSlots(root);
    expect(res.ok).toBe(false);
    expect(res.leftoverInSlot).toBe(1);
  });
});

delete globalThis.document;

console.log(`\nResults: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
