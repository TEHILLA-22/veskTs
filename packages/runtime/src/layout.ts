import {
	createHydrateWalker,
	isVskMarkerText,
	reportHydrationIssue,
} from '@vesk/runtime/src/hydrate';
import type { HydrateWalker } from '@vesk/runtime/src/hydrate';

// ---------------------------------------------------------------------------
// Dedicated layout contract (Layout hydration ownership).
//
// A layout composes three independently-authored regions — chrome/nav, the
// page slot, footer — that SSR serializes as undifferentiated siblings inside
// one parent element. Hydrating all three off a single shared positional
// cursor means ANY single claim miss (a self-claiming Link in the nav, an
// async suspension in the page, a conditional) shifts every later claim into
// fresh-node fallback: fresh nodes append at region tails, so one miss twins
// the footer, and a late-resolving async page lands below the footer (or the
// page claims first and the layout stacks under it).
//
// Containment scoping (`subWalker(enclosingEl)`) is not the answer either: it
// bulk-transfers sibling markers rendered AFTER the slot (the footer) into
// the page's walk. The missing piece is boundary-delimited scoping, owned
// here:
//
//   * SSR wraps every `{props.children}` region in `<!--vsk-slot-->` …
//     `<!--vsk-slot-end-->` (server codegen). The texts deliberately lack the
//     `vsk:` prefix so the generic marker machinery (walkers, canary, audit)
//     ignores them; only this module reads them.
//   * `createLayoutSlot` transfers the slot range out of the shared walk and
//     hands back a walker scoped to the depth-0 markers. Nav/footer claims can
//     no longer drift into page markers and page claims can no longer steal
//     footer markers — including across `await` suspensions, because scope no
//     longer depends on claim timing, and across nesting (nested-slot
//     interiors are neutralized in the ancestor walk and re-scoped by the
//     inner layout from the live DOM).
//   * `track` anchors async slot content: a suspending child resolves to
//     nodes inserted BEFORE the slot-end boundary at its SSR position — never
//     appended at the tail, never dropped. A navigation that replaced the DOM
//     first (slot-end detached) drops the late content instead of duplicating
//     it into the new page.
// ---------------------------------------------------------------------------

/** SSR comment text opening a layout page-slot region. */
export const LAYOUT_SLOT_OPEN = 'vsk-slot';
/** SSR comment text closing a layout page-slot region (also the async anchor). */
export const LAYOUT_SLOT_CLOSE = 'vsk-slot-end';

export interface LayoutSlot {
	/** Walker scoped to the slot's SSR markers (or the shared walker when unscopable). */
	walker: HydrateWalker;
	/** True when the walker is scoped to slot boundaries (not the shared cursor). */
	scoped: boolean;
	/**
	 * Wire an async child hydrator result: resolved slot content is inserted
	 * at its SSR position (before the slot-end boundary). Returns a promise
	 * for the layout's `__pendingChild` chain.
	 */
	track(promise: unknown): unknown;
}

/**
 * Slot boundary identity. Server codegen stamps every pair with a unique id
 * (`vsk-slot:s7` … `vsk-slot-end:s7`); pre-boundary output uses the bare texts
 * (legacy, id `''`). Open/close are paired by EXACT id — never positionally —
 * so nested layouts and sibling slots cannot mis-scope each other. No regex:
 * prefix strip only.
 */
export interface SlotIdentity {
	/** '' for legacy bare boundaries, otherwise the stamped id. */
	id: string;
}

function slotIdentity(text: string | null | undefined, prefix: string): SlotIdentity | null {
	if (text === prefix) return { id: '' };
	if (typeof text !== 'string') return null;
	const want = prefix + ':';
	if (text.length > want.length && text.startsWith(want)) return { id: text.slice(want.length) };
	return null;
}

function slotOpenId(text: string | null | undefined): SlotIdentity | null {
	return slotIdentity(text, LAYOUT_SLOT_OPEN);
}

function slotCloseId(text: string | null | undefined): SlotIdentity | null {
	return slotIdentity(text, LAYOUT_SLOT_CLOSE);
}

function slotUsed(node: Comment): boolean {
	try {
		return (node as unknown as { __vsk_slot_used?: unknown }).__vsk_slot_used === true;
	} catch {
		return false;
	}
}

function markSlotUsed(node: Comment): void {
	try {
		(node as unknown as { __vsk_slot_used?: unknown }).__vsk_slot_used = true;
	} catch {
		// Expando unsupported — the pair may be re-scanned, which degrades to
		// the legacy shared-walker path, never to a wrong scope.
	}
}

interface SlotRange {
	/** Depth-0 markers: owned by the slot walker built for this scope. */
	markers: Comment[];
	/**
	 * Every `vsk:` marker in the range, including nested-slot interiors:
	 * neutralized in the ancestor walk so its positional cursor can never
	 * trip on (or adopt) page-region markers — regardless of claim timing
	 * (async pages resolve after the layout already claimed past the slot).
	 * Nested scopes re-scan the live DOM and own their interiors exclusively.
	 */
	all: Comment[];
	end: Comment;
}

/**
 * Locate the unconsumed slot boundary pair that are direct children of
 * `parentEl` and collect the `vsk:` markers between them in document order.
 *
 * Open/close pair by EXACT boundary id (legacy bare boundaries pair
 * positionally, as before). An id-stamped open with no same-id close — or a
 * legacy open facing only id-stamped closes (version skew) — refuses to scope
 * (null) rather than risk a wrong range. Nested layout slots inside the range
 * are skipped via a depth counter, so an outer slot never captures an inner
 * layout's page markers (each layout scopes its own pair when its slot runs).
 * Returns null when the SSR output predates slot boundaries (legacy) or the
 * pair is unbalanced.
 */
function findSlotRange(parentEl: Element): SlotRange | null {
	let open: Comment | null = null;
	let openId: SlotIdentity | null = null;
	let close: Comment | null = null;
	try {
		// Walk the entire subtree of parentEl (not just direct children) so a
		// layout whose slot lives inside a nested <main> (DocsLayout:
		// outer <div> → <div.flex> → <main>) is still found. The old
		// direct-children scan missed those and fell back to the shared walk
		// (257-marker hydration drift on /docs).
		const walker = document.createTreeWalker(parentEl, 128, {
			acceptNode: (node) => {
				const t = (node as Comment).textContent;
				if (slotOpenId(t) !== null || slotCloseId(t) !== null) return 1;
				return 2;
			},
		});
		// Nesting depth while seeking the close: a nested slot pair inside
		// our range must not donate its close to us. Bare boundaries
		// (`vsk-slot` … `vsk-slot-end`) carry no id, so without depth the
		// first inner close would prematurely end the outer range and
		// mis-scope the page. Distinct ids pair by exact id AND depth.
		let nest = 0;
		while (walker.nextNode()) {
			const c = walker.currentNode as unknown as { nodeType: number; textContent?: string | null };
			const t = c.textContent;
			if (open === null) {
				const id = slotOpenId(t);
				if (id !== null && !slotUsed(c as unknown as Comment)) {
					open = c as unknown as Comment;
					openId = id;
				}
			} else {
				if (slotOpenId(t) !== null && !slotUsed(c as unknown as Comment)) {
					nest++;
					continue;
				}
				const id = slotCloseId(t);
				if (id === null || slotUsed(c as unknown as Comment)) continue;
				if (id.id === (openId as SlotIdentity).id && nest === 0) {
					// Ensure close is after open in document order and still
					// inside parentEl (TreeWalker guarantees this, but verify
					// via isConnected/contains for detached-navigation safety).
					try {
						if (!(parentEl as unknown as { contains?: (n: unknown) => boolean }).contains?.(c as unknown)) continue;
					} catch {}
					close = c as unknown as Comment;
					break;
				}
				if (nest > 0) nest--;
			}
		}
	} catch {
		return null;
	}
	if (!open || !close) return null;

	// Document-order walk from `open` to `close`, collecting vsk markers at
	// nesting depth 0 for the slot walker, and every vsk marker in range for
	// ancestor neutralization (see `SlotRange.all`). A nested `vsk-slot` …
	// `vsk-slot-end` pair (inner layout) increments depth so its interior
	// markers stay owned by the inner scope.
	const markers: Comment[] = [];
	const all: Comment[] = [];
	let depth = 0;
	let node: unknown = null;
	try {
		node = (open as unknown as { nextSibling: unknown }).nextSibling;
	} catch {
		return null;
	}
	let guard = 0;
	while (node !== null && node !== (close as unknown) && guard++ < 100000) {
		let next: unknown = null;
		let descend: unknown = null;
		try {
			const n = node as { nodeType: number; textContent?: string | null; nextSibling: unknown; firstChild: unknown };
			next = n.nextSibling;
			descend = n.firstChild;
			if (n.nodeType === 8) {
				if (slotOpenId(n.textContent) !== null) {
					depth++;
				} else if (slotCloseId(n.textContent) !== null) {
					if (depth === 0) break; // unbalanced: a close with no open — stop, don't over-capture
					depth--;
				} else if (isVskMarkerText(n.textContent)) {
					all.push(n as unknown as Comment);
					// Depth-0 only: nested `vsk-slot` interiors stay owned by
					// the inner layout's own scope (see the nested test in
					// layout.test.ts). The ancestor walk is neutralized for
					// the whole range via `all` + `takeMarkers` regardless.
					if (depth === 0) markers.push(n as unknown as Comment);
				}
			}
		} catch {
			return null;
		}
		// Preorder: descend first, else advance; climb past exhausted parents.
		if (descend !== null && descend !== undefined) {
			node = descend;
		} else {
			let cur: unknown = node;
			let nxt: unknown = next;
			while (nxt === null || nxt === undefined) {
				let parent: unknown = null;
				try {
					parent = (cur as { parentNode: unknown }).parentNode;
				} catch {
					return null;
				}
				if (parent === null || parent === undefined || parent === (parentEl as unknown)) break;
				if (parent === (close as unknown)) {
					nxt = null;
					cur = null;
					break;
				}
				try {
					nxt = (parent as { nextSibling: unknown }).nextSibling;
				} catch {
					return null;
				}
				cur = parent;
			}
			if (cur === null) break;
			node = nxt;
		}
	}
	if (node !== (close as unknown)) return null; // never reached the close — unbalanced, refuse to scope
	markSlotUsed(open);
	markSlotUsed(close);
	return { markers, all, end: close };
}

function insertDetachedSlotContent(value: unknown, anchor: Comment): void {
	let parent: unknown = null;
	try {
		parent = (anchor as unknown as { parentNode: unknown }).parentNode;
		if (!parent) return;
	} catch {
		return;
	}
	const nodes: Array<{ nodeType: number; parentNode: unknown }> = [];
	if (value && typeof value === 'object') {
		const v = value as { nodeType?: unknown; parentNode?: unknown; length?: unknown };
		if (v.nodeType === 11 || v.nodeType === 1) nodes.push(v as { nodeType: number; parentNode: unknown });
		else if (typeof v.length === 'number') {
			for (let i = 0; i < (v.length as number); i++) {
				const n = (v as unknown as Array<{ nodeType?: unknown; parentNode?: unknown }>)[i];
				if (n && (n.nodeType === 11 || n.nodeType === 1)) nodes.push(n as { nodeType: number; parentNode: unknown });
			}
		} else return;
	} else return;
	for (const n of nodes) {
		if (n === (anchor as unknown)) continue;
		let attached: unknown = null;
		try {
			attached = n.parentNode;
		} catch {
			continue;
		}
		// Only place detached content. Attached nodes were claimed in place —
		// moving them would reorder live DOM on a hunch.
		if (attached !== null && attached !== undefined) continue;
		try {
			(parent as { insertBefore(n: unknown, ref: unknown): void }).insertBefore(n, anchor);
		} catch {
			// A failed insert must not strand the render; the audit reports it.
		}
	}
}

/**
 * Anchor an async slot child: when the hydrator promise resolves, detached
 * slot content is inserted BEFORE the slot-end boundary (its SSR position).
 * When the boundary is gone (a navigation replaced the DOM while suspended),
 * the late content is dropped — hydrating replaced DOM is how duplicates are
 * born. Resolution value and errors pass through untouched.
 */
export function trackSlotContent(promise: unknown, anchor: Comment | null): unknown {
	if (!promise || typeof (promise as { then?: unknown }).then !== 'function' || !anchor) return promise;
	return (promise as Promise<unknown>).then(
		(value) => {
			let live = false;
			try {
				live = !!anchor.parentNode && (anchor as unknown as { isConnected?: unknown }).isConnected !== false;
			} catch {
				live = false;
			}
			if (live) insertDetachedSlotContent(value, anchor);
			else {
				reportHydrationIssue({
					kind: 'leftover-marker',
					detail: 'async layout slot resolved after its SSR boundary detached (navigation replaced the DOM); late slot content dropped instead of duplicated.',
				});
			}
			return value;
		},
		(error) => {
			throw error;
		}
	);
}

/**
 * Build the slot scope for a layout `{children}` invocation.
 *
 * Transfers the whole slot range — depth-0 markers plus nested-slot
 * interiors — out of the shared walk (`takeMarkers`), then hands back a
 * walker scoped to the depth-0 markers only. Nav/footer claims can no longer
 * drift into page markers and page claims can no longer steal footer markers,
 * including across `await` suspensions (scope never depends on claim timing)
 * and across nesting levels (an inner scope re-scans the live DOM and owns
 * its interior exclusively). Falls back to the shared walker (legacy
 * behavior) when boundaries are absent, unbalanced, already consumed, or the
 * walker cannot transfer — a fallback degrades to today's semantics, never to
 * a wrong scope.
 */
export function createLayoutSlot(
	walker: HydrateWalker,
	parentEl: Element | null
): LayoutSlot {
	const fallback: LayoutSlot = {
		walker,
		scoped: false,
		track: (promise: unknown) => trackSlotContent(promise, null),
	};
	if (!walker || !parentEl) return fallback;
	let range: SlotRange | null = null;
	try {
		range = findSlotRange(parentEl);
	} catch {
		return fallback;
	}
	if (!range) {
		reportHydrationIssue({
			kind: 'untyped-marker',
			detail: 'layout slot has no SSR slot boundaries (legacy output or unbalanced markers); hydrating the page on the shared walker — ordering is best-effort.',
		});
		return fallback;
	}
	if (typeof walker.takeMarkers !== 'function') {
		reportHydrationIssue({
			kind: 'untyped-marker',
			detail: 'layout slot walker cannot transfer markers; hydrating the page on the shared walker — ordering is best-effort.',
		});
		return { walker, scoped: false, track: (promise: unknown) => trackSlotContent(promise, range!.end) };
	}
	try {
		walker.takeMarkers(range.all);
	} catch {
		return fallback;
	}
	let slotWalker: HydrateWalker;
	try {
		slotWalker = createHydrateWalker(parentEl as unknown as HTMLElement, range.markers);
	} catch {
		return fallback;
	}
	const end = range.end;
	return {
		walker: slotWalker,
		scoped: true,
		track: (promise: unknown) => trackSlotContent(promise, end),
	};
}

// ---------------------------------------------------------------------------
// Strict slot audit: every slot boundary pair must be balanced, and no `vsk:`
// marker may survive inside a slot range after hydration — a leftover there is
// page content the client never claimed (the twin/duplication surface).
// Runs from the router after the layout chain hydrates (full strategy only;
// deferred strategies hydrate the slot later by design).
// ---------------------------------------------------------------------------

const _SHOW_COMMENT = 128;
const _FILTER_ACCEPT = 1;
const _FILTER_SKIP = 2;

export interface LayoutSlotAudit {
	ok: boolean;
	unbalanced: number;
	leftoverInSlot: number;
}

/** Verify slot boundary balance and slot-region claim completeness. */
export function auditLayoutSlots(container: HTMLElement): LayoutSlotAudit {
	let unbalanced = 0;
	let leftoverInSlot = 0;
	try {
		const walker = document.createTreeWalker(container, _SHOW_COMMENT, {
			acceptNode: (node) => {
				const t = (node as Comment).textContent;
				if (slotOpenId(t) !== null || slotCloseId(t) !== null || isVskMarkerText(t)) return _FILTER_ACCEPT;
				return _FILTER_SKIP;
			},
		});
		// Open-id stack: id-stamped pairs must close in LIFO order with the
		// exact id; legacy bare boundaries pair blindly (as before). Any id
		// mismatch names the diverging slot instead of silently mis-scoping.
		const stack: string[] = [];
		while (walker.nextNode()) {
			const c = walker.currentNode as Comment;
			const t = c.textContent;
			const open = slotOpenId(t);
			if (open !== null) {
				stack.push(open.id);
				continue;
			}
			const close = slotCloseId(t);
			if (close !== null) {
				if (stack.length === 0) {
					unbalanced++;
					reportHydrationIssue({
						kind: 'marker-skew',
						detail: 'layout slot close without a matching open — SSR/client slot structure diverges; slot content may misorder.',
					});
					continue;
				}
				const top = stack.pop() as string;
				if (top !== '' && close.id !== '' && top !== close.id) {
					unbalanced++;
					reportHydrationIssue({
						kind: 'marker-skew',
						detail: `layout slot id mismatch: open "${top}" closed by "${close.id}" — SSR/client slot structure diverges; slot content may misorder.`,
					});
				}
				continue;
			}
			if (stack.length > 0 && isVskMarkerText(t)) leftoverInSlot++;
		}
		if (stack.length > 0) {
			unbalanced++;
			reportHydrationIssue({
				kind: 'marker-skew',
				detail: 'layout slot open without a matching close — SSR/client slot structure diverges; slot content may misorder.',
			});
		}
		if (leftoverInSlot > 0) {
			reportHydrationIssue({
				kind: 'leftover-marker',
				detail: `${leftoverInSlot} hydration marker(s) survived inside a layout slot region; the page rendered differently than SSR — duplication risk.`,
			});
		}
	} catch {
		// Audit must never break rendering.
	}
	return { ok: unbalanced === 0 && leftoverInSlot === 0, unbalanced, leftoverInSlot };
}
