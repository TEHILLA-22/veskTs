/**
 * Dev-only runtime-error → HMR-payload resolver.
 *
 * HMR compile errors already report through the canonical `HmrErrorPayload`
 * (file + line/column + codeframe + tips/suggestions/nextSteps + stack,
 * rendered by the client's error overlay). SSR render failures and client
 * runtime failures historically did NOT: the dev server swallowed them into a
 * generic `<h1>500</h1>` page (or a raw `<pre>` stack dump), and the client
 * overlay showed compiled-bundle coordinates (`page-index.js:833`) that point
 * nowhere in user source.
 *
 * This module closes that gap. Given a thrown value (or a client-side
 * `{ message, stack }` report) plus the dev server's knowledge of the app
 * (route files, shared `components/`, route/component name maps), it resolves
 * the failure back to a `.vsk` file/line and returns the SAME payload shape
 * the HMR channel broadcasts — so SSR 500s and client `ReferenceError`s render
 * in the same overlay with the same codeframe + tips.
 *
 * Resolution strategy (best-effort, never throws):
 *   1. Errors that already carry a location (VeskError/acorn `.loc`,
 *      `.position`, `.line`) go straight through `buildErrorPayload`.
 *   2. `X is not defined` (and the `Cannot find name 'X'` / Safari
 *      `Can't find variable: X` variants): the identifier plus the
 *      `__components.Foo` frames in the stack name the exact `.vsk` files to
 *      scan; the first use of the identifier in the best candidate yields the
 *      line/column for the codeframe.
 *   3. Other errors with `__components.Foo` frames: the payload at least names
 *      the innermost `.vsk` file instead of the compiled bundle.
 *   4. Anything else: message + stack + generic tips, same as before — but in
 *      the HMR payload shape so the overlay still renders it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { buildCodeframe } from './error-codeframe';
import { buildErrorPayload, type HmrErrorPayload } from './hmr';

export interface RuntimeErrorContext {
  /** Absolute path of the app dir (`.../app`). Used to resolve sources for codeframes. */
  appDir: string;
  /** Absolute path of the project root (`.../`, parent of `app/`). Defaults to `resolve(appDir, '..')`. */
  projectDir?: string;
  /** Absolute `.vsk` files for the failing route (page first). Scanned for the failing identifier. */
  routeFiles?: string[];
  /** `componentName -> absolute .vsk path` for shared `components/` (from `scanComponents`). */
  componentMap?: Map<string, string>;
  /** `componentName -> absolute .vsk path` for route files (from `collectSources`). */
  routeSources?: Map<string, string>;
}

export interface ClientErrorReport {
  message?: unknown;
  stack?: unknown;
  /** Compiled-bundle URL/path from `window.onerror` — display fallback only, never the payload file. */
  filename?: unknown;
  line?: unknown;
  column?: unknown;
  /** VeskError-style code (e.g. `V0412`) when the client error carried one. */
  code?: unknown;
}

function isIdentStart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$';
}

function isIdentPart(ch: string): boolean {
  return isIdentStart(ch) || (ch >= '0' && ch <= '9');
}

function takeIdentifier(s: string): string | null {
  if (!s) return null;
  if (!isIdentStart(s.charAt(0))) return null;
  let i = 1;
  while (i < s.length && isIdentPart(s.charAt(i))) i++;
  return s.slice(0, i);
}

/**
 * Extract the undeclared identifier from `ReferenceError`-style messages:
 * `Menu is not defined`, `ReferenceError: Menu is not defined`,
 * `Cannot find name 'Menu'`, `Can't find variable: Menu`.
 */
export function extractUndefinedName(message: string): string | null {
  if (typeof message !== 'string' || !message) return null;
  const notDefined = message.indexOf(' is not defined');
  if (notDefined > 0) {
    const head = message.slice(0, notDefined);
    let i = head.length - 1;
    while (i >= 0 && isIdentPart(head.charAt(i))) i--;
    return takeIdentifier(head.slice(i + 1));
  }
  const findName = message.indexOf("Cannot find name '");
  if (findName >= 0) {
    const rest = message.slice(findName + "Cannot find name '".length);
    const end = rest.indexOf("'");
    if (end > 0) return takeIdentifier(rest.slice(0, end));
    return null;
  }
  const findVar = message.indexOf("Can't find variable:");
  if (findVar >= 0) {
    return takeIdentifier(message.slice(findVar + "Can't find variable:".length).trim());
  }
  return null;
}

/**
 * Component names from a compiled render stack, innermost frame first:
 * `__components.SiteHeader`, `__components["SiteHeader"]`, `__components['Home']`.
 */
export function extractComponentNames(stack: string): string[] {
  const names: string[] = [];
  if (typeof stack !== 'string' || !stack) return names;
  const marker = '__components';
  let i = 0;
  while (i < stack.length) {
    const at = stack.indexOf(marker, i);
    if (at < 0) break;
    let j = at + marker.length;
    let name: string | null = null;
    if (stack.charAt(j) === '.') {
      name = takeIdentifier(stack.slice(j + 1));
      j += (name ? name.length : 0) + 1;
    } else if (stack.charAt(j) === '[') {
      const quote = stack.charAt(j + 1);
      if (quote === '"' || quote === "'") {
        const end = stack.indexOf(quote, j + 2);
        if (end > j + 2) {
          const raw = stack.slice(j + 2, end);
          name = takeIdentifier(raw) !== null && takeIdentifier(raw) === raw ? raw : null;
          j = end + 1;
        }
      }
    }
    if (name && !names.includes(name)) names.push(name);
    i = j > at ? j : at + 1;
  }
  return names;
}

export interface StackFrame {
  /** Path or URL as it appears in the stack frame (may be a bundle URL). */
  path: string;
  line: number;
  column: number;
}

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.vsk']);

function scanFrameLocation(seg: string): { path: string; line: number; column: number } | null {
  if (!seg) return null;
  let i = seg.length;
  let column = 0;
  let digits = 0;
  while (i > 0 && seg.charCodeAt(i - 1) >= 48 && seg.charCodeAt(i - 1) <= 57) {
    column = (seg.charCodeAt(i - 1) - 48) * Math.pow(10, digits) + column;
    digits++;
    i--;
  }
  if (digits === 0 || i === 0 || seg.charAt(i - 1) !== ':') return null;
  i--;
  let line = 0;
  digits = 0;
  while (i > 0 && seg.charCodeAt(i - 1) >= 48 && seg.charCodeAt(i - 1) <= 57) {
    line = (seg.charCodeAt(i - 1) - 48) * Math.pow(10, digits) + line;
    digits++;
    i--;
  }
  if (digits === 0 || i === 0 || seg.charAt(i - 1) !== ':') return null;
  i--;
  const path = seg.slice(0, i);
  if (!path) return null;
  return { path, line, column: column + 1 };
}

/**
 * Parse V8-style stack lines into `path:line:col` frames (1-based column,
 * matching the codeframe caret). Supports both parenthesized frames
 * (`at fn (/abs/file.ts:12:5)`) and bare path frames (`at file.ts:12:5`).
 */
export function extractSourceFrames(stack: string | undefined | null): StackFrame[] {
  const frames: StackFrame[] = [];
  if (typeof stack !== 'string' || !stack) return frames;
  for (const raw of stack.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('at ')) continue;
    let seg = line.slice(3).trim();
    if (seg.startsWith('async ')) seg = seg.slice(6).trim();
    const close = seg.lastIndexOf(')');
    if (close >= 0) {
      const open = seg.lastIndexOf('(', close);
      if (open >= 0) seg = seg.slice(open + 1, close);
    }
    const loc = scanFrameLocation(seg);
    if (loc) frames.push(loc);
  }
  return frames;
}

function isInsideRoot(absPath: string, root: string): boolean {
  if (!root) return false;
  const base = root.endsWith('/') ? root : root + '/';
  if (absPath === root) return true;
  return absPath.startsWith(base);
}

const GENERATED_SEGMENTS = ['node_modules', '.vesk'];

function isGeneratedPath(absPath: string): boolean {
  for (const seg of GENERATED_SEGMENTS) {
    if (absPath.split('/').includes(seg)) return true;
  }
  if (absPath.includes('/_vesk/static/')) return true;
  if (absPath.includes('/dist/')) return true;
  return false;
}

/**
 * First stack frame that names a real source file inside the project
 * (`.ts`/`.tsx`/`.js`/`.vsk`, existing on disk, not node_modules/dist/.vesk
 * or the dev bundle). Innermost (topmost) real frame is the throw site —
 * e.g. `ReferenceError` inside `lib/helper.ts` imported by a `.vsk` page.
 */
export function firstSourceFileFrame(
  stack: string | undefined | null,
  projectRoot: string,
): StackFrame | null {
  for (const frame of extractSourceFrames(stack)) {
    let p = frame.path;
    if (p.startsWith('file://')) p = p.slice('file://'.length);
    if (!p.startsWith('/')) continue; // bundle URLs (http://) and relative frames
    const ext = p.slice(p.lastIndexOf('.')).split(':')[0].toLowerCase();
    if (!SOURCE_EXTENSIONS.has(ext)) continue;
    if (isGeneratedPath(p)) continue;
    if (!isInsideRoot(p, projectRoot)) continue;
    try {
      if (!existsSync(p)) continue;
    } catch {
      continue;
    }
    return { ...frame, path: p };
  }
  return null;
}

/**
 * First use of an identifier in a `.vsk` source file (1-based line/column).
 * Import lines are skipped — an undeclared name's *use* site is the error site.
 */
export function findIdentifierUsage(src: string, name: string): { line: number; column: number } | null {
  if (typeof src !== 'string' || !src || typeof name !== 'string' || !takeIdentifier(name) || takeIdentifier(name) !== name) {
    return null;
  }
  const lines = src.split('\n');
  for (let ln = 0; ln < lines.length; ln++) {
    const text = lines[ln];
    if (/^\s*import[\s('"]/.test(text)) continue;
    let idx = text.indexOf(name);
    while (idx >= 0) {
      const before = idx > 0 ? text.charAt(idx - 1) : '';
      const after = idx + name.length < text.length ? text.charAt(idx + name.length) : '';
      if (!isIdentPart(before) && !isIdentPart(after)) {
        return { line: ln + 1, column: idx + 1 };
      }
      idx = text.indexOf(name, idx + 1);
    }
  }
  return null;
}

function projectOf(ctx: RuntimeErrorContext): string {
  return ctx.projectDir || resolve(ctx.appDir, '..');
}

/** Display path for a payload: app-relative (`page.vsk`), else project-relative (`components/X.vsk`). */
export function displayPath(absPath: string, ctx: RuntimeErrorContext): string {
  const appRel = relative(ctx.appDir, absPath);
  if (appRel && !appRel.startsWith('..')) return appRel || absPath;
  const projRel = relative(projectOf(ctx), absPath);
  if (projRel && !projRel.startsWith('..')) return projRel;
  return absPath;
}

function readIfFile(absPath: string): string | null {
  try {
    if (!existsSync(absPath)) return null;
    return readFileSync(absPath, 'utf-8');
  } catch {
    return null;
  }
}

function resolveComponentFile(name: string, ctx: RuntimeErrorContext): string | null {
  const fromRoutes = ctx.routeSources?.get(name);
  if (fromRoutes) {
    const abs = resolve(ctx.appDir, fromRoutes);
    if (readIfFile(abs) !== null) return abs;
  }
  const fromShared = ctx.componentMap?.get(name);
  if (fromShared) {
    const abs = resolve(projectOf(ctx), fromShared);
    if (readIfFile(abs) !== null) return abs;
    if (readIfFile(fromShared) !== null) return fromShared;
  }
  return null;
}

/** Ordered absolute candidate files: stack-named components first, then route files. */
export function candidateFiles(message: string, stack: string | undefined, ctx: RuntimeErrorContext): string[] {
  const out: string[] = [];
  const push = (abs: string): void => {
    if (!abs || out.includes(abs)) return;
    if (readIfFile(abs) === null) return;
    out.push(abs);
  };
  if (stack) {
    for (const name of extractComponentNames(stack)) {
      const f = resolveComponentFile(name, ctx);
      if (f) push(f);
    }
  }
  for (const f of ctx.routeFiles || []) push(f);
  return out.slice(0, 12);
}

function withCodeframe(payload: HmrErrorPayload, absPath: string, line: number, column: number): HmrErrorPayload {
  if (!payload.codeframe) {
    const src = readIfFile(absPath);
    if (src) {
      const cf = buildCodeframe(src, line, column);
      if (cf) {
        cf.file = payload.file || cf.file;
        payload.codeframe = cf;
      }
    }
  }
  return payload;
}

/**
 * Resolve a server-side throw to the HMR payload shape. Never throws — on any
 * failure returns the message + stack + generic tips (the old behavior, but in
 * the overlay-renderable shape).
 */
export function resolveRuntimeErrorPayload(err: unknown, ctx: RuntimeErrorContext): HmrErrorPayload {
  const rec = (typeof err === 'object' && err !== null ? err : null) as Record<string, unknown> | null;
  const message = rec && typeof rec.message === 'string' && rec.message
    ? rec.message
    : err instanceof Error ? err.message : String(err ?? 'Unknown error');
  const stack = rec && typeof rec.stack === 'string' && rec.stack
    ? rec.stack
    : err instanceof Error && err.stack ? err.stack : undefined;
  const code = rec && typeof rec.code === 'string' && rec.code ? rec.code
    : err instanceof Error && typeof (err as { code?: unknown }).code === 'string'
      ? (err as { code?: string }).code
      : undefined;

  const candidates = candidateFiles(message, stack, ctx);
  const firstFile = candidates.length > 0 ? displayPath(candidates[0], ctx) : 'app';

  // Errors that already carry a location keep full fidelity.
  const direct = buildErrorPayload(err, firstFile, { appDir: ctx.appDir });
  if (direct.line !== null) return direct;

  // A stack frame naming a real source file (`.ts` imported into a `.vsk`,
  // a `.ts` api/middleware module, etc.) is the exact throw site — point the
  // payload there instead of scanning `__components` bundle coords.
  const frame = firstSourceFileFrame(stack, projectOf(ctx));
  if (frame) {
    const payload = buildErrorPayload(
      { message: direct.message || message, stack, line: frame.line, column: frame.column, ...(code ? { code } : {}) },
      displayPath(frame.path, ctx),
      { appDir: ctx.appDir },
    );
    return withCodeframe(payload, frame.path, frame.line, frame.column);
  }

  const name = extractUndefinedName(direct.message || message);
  if (name) {
    for (const abs of candidates) {
      const src = readIfFile(abs);
      if (!src) continue;
      const use = findIdentifierUsage(src, name);
      if (!use) continue;
      const payload = buildErrorPayload(
        { message: direct.message || message, stack, line: use.line, column: use.column, ...(code ? { code } : {}) },
        displayPath(abs, ctx),
        { appDir: ctx.appDir },
      );
      return withCodeframe(payload, abs, use.line, use.column);
    }
  }

  // No pinpoint: still name the innermost .vsk file instead of the bundle.
  if (candidates.length > 0) {
    return buildErrorPayload(err, displayPath(candidates[0], ctx), { appDir: ctx.appDir });
  }
  return direct;
}

/**
 * Resolve a client-side `{ message, stack }` report (compiled-bundle
 * coordinates) to the HMR payload shape. Same core as the server path, but
 * stack-named components outrank route files — the throw site is named by the
 * `__components.Foo` frames, as in `ReferenceError: Menu is not defined` from
 * `__components.SiteHeader` inside `__components.Home`.
 */
export function resolveClientErrorReport(report: ClientErrorReport, ctx: RuntimeErrorContext): HmrErrorPayload {
  const raw = (report || {}) as Record<string, unknown>;
  const message = typeof raw.message === 'string' && raw.message ? raw.message.slice(0, 5000) : 'Unknown error';
  const stack = typeof raw.stack === 'string' ? raw.stack.slice(0, 20000) : undefined;
  const code = typeof raw.code === 'string' && raw.code ? raw.code : undefined;
  return resolveRuntimeErrorPayload({ message, stack, ...(code ? { code } : {}) }, ctx);
}

/** `file:line:col` (or `file`, or `''`) for one-line terminal logs. */
export function formatErrorLocation(payload: HmrErrorPayload): string {
  const file = payload.file || '';
  if (payload.line != null) {
    return `${file}:${payload.line}${payload.column != null ? `:${payload.column}` : ''}`;
  }
  return file;
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Standalone dev 500 page in the overlay's visual language (file header,
 * message, codeframe with caret, TIPS/SUGGESTIONS/NEXT STEPS, collapsible
 * stack). The HTML keeps a `</body>` so callers can run `injectDevScripts`
 * over it — the HMR client then pops the same payload as an overlay on load.
 */
export function renderDevErrorPage(
  payload: HmrErrorPayload,
  opts?: { status?: number; url?: string },
): string {
  const status = opts?.status ?? 500;
  const url = opts?.url ? escapeHtml(opts.url) : '';
  const file = payload.file ? escapeHtml(payload.file) : 'unknown file';
  const code = payload.code ? escapeHtml(payload.code) : '';
  const loc = payload.line != null
    ? `:${payload.line}${payload.column != null ? `:${payload.column}` : ''}`
    : '';
  const message = escapeHtml(payload.message || 'Unknown error');

  let codeHtml = '';
  const frame = payload.codeframe;
  if (frame && Array.isArray(frame.code) && frame.code.length > 0) {
    let maxNo = 0;
    for (const l of frame.code) if (l.no > maxNo) maxNo = l.no;
    const gutterW = String(maxNo).length;
    const pad = (n: number): string => {
      let s = String(n);
      while (s.length < gutterW) s = ' ' + s;
      return s;
    };
    const rows: string[] = [];
    for (const l of frame.code) {
      const marker = l.isError ? '&gt;' : '&nbsp;';
      rows.push(
        `<div${l.isError ? ' class="err"' : ''}>${marker} <span class="ln">${pad(l.no)}</span> ${escapeHtml(l.text)}</div>`,
      );
      if (l.isError && frame.column != null && frame.column > 0) {
        rows.push(`<div class="caret">${' '.repeat(gutterW + 3 + Math.max(0, frame.column - 1)).replace(/ /g, '&nbsp;')}^</div>`);
      }
    }
    codeHtml = `<div class="code">${rows.join('\n')}</div>`;
  }

  const list = (title: string, items?: string[]): string => {
    if (!items || items.length === 0) return '';
    return `<div class="sec"><div class="sec-t">&gt; ${escapeHtml(title)}</div>` +
      items.slice(0, 6).map((t) => `<div class="item">${escapeHtml(t)}</div>`).join('') + '</div>';
  };
  const lists = list('TIPS', payload.tips) + list('SUGGESTIONS', payload.suggestions) + list('NEXT STEPS', payload.nextSteps);
  const stack = payload.stack
    ? `<details class="stack"><summary>Stack trace</summary><pre>${escapeHtml(payload.stack)}</pre></details>`
    : '';

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + status + ' — Vesk dev</title>' +
    '<style>' +
    'body{background:#000;color:#e8e8e8;font-family:ui-monospace,Menlo,Consolas,monospace;margin:0;padding:32px;}' +
    '.panel{max-width:900px;margin:0 auto;border:1px solid #e8e8e8;}' +
    '.head{border-bottom:1px solid #e8e8e8;padding:12px 16px;font-weight:700;letter-spacing:.08em;}' +
    '.body{padding:16px;}' +
    '.file{font-weight:700;margin-bottom:8px;}' +
    '.msg{margin:8px 0 16px;white-space:pre-wrap;}' +
    '.code{background:#0a0a0a;border:1px solid #333;padding:12px;white-space:pre;overflow-x:auto;margin-bottom:16px;}' +
    '.code .ln{color:#888;}' +
    '.code .err{background:#3d0a0a;}' +
    '.code .caret{color:#ff5555;}' +
    '.sec{margin:12px 0;}' +
    '.sec-t{font-weight:700;margin-bottom:4px;}' +
    '.item{padding-left:16px;color:#ccc;}' +
    '.stack{margin-top:16px;color:#999;}' +
    '.stack pre{white-space:pre-wrap;font-size:12px;}' +
    '.foot{border-top:1px solid #e8e8e8;padding:8px 16px;color:#888;font-size:12px;letter-spacing:.08em;}' +
    '</style></head><body>' +
    '<div class="panel"><div class="head">&gt; SSR ERROR — ' + status + '</div>' +
    '<div class="body">' +
    `<div class="file">${code ? code + ' — ' : ''}${file}${loc}</div>` +
    (url ? `<div class="file" style="font-weight:400;color:#888;">${url}</div>` : '') +
    `<div class="msg">${message}</div>` +
    codeHtml + lists + stack +
    '</div><div class="foot">VESK DEV — FIX THE FILE AND SAVE TO RELOAD</div></div>' +
    '</body></html>';
}
