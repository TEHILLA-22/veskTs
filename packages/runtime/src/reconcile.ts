import { destroy_block } from '@vesk/runtime/src/ripple-blocks';
import type { Block } from '@vesk/runtime/src/ripple-runtime';
import type { ClaimByKeyOptions } from '@vesk/runtime/src/hydrate';

interface MapEntry {
	marker: Comment;
	effs: Block[];
}

export type KeyedClaimFn = (key: string, options?: ClaimByKeyOptions) => { el: Element } | null;
export type KeyedPeekFn = (key: string) => Element | null;

export interface KeyedHydrateWalker {
	peekKey?: KeyedPeekFn;
	claimByKey?: KeyedClaimFn;
}

export function reconcile<T>(
	anchor: Node,
	endAnchor: Node,
	items: T[],
	keyFn: (item: T, index: number) => string,
	createItem: (item: T, index: number, effs: Block[], root: Element | null) => void,
	claim?: KeyedClaimFn,
): (newItems: T[]) => void {
	const parent = anchor.parentNode as HTMLElement;
	const map = new Map<string, MapEntry>();

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const key = keyFn(item, i);
		const marker = document.createComment('k:' + key);
		const effs: Block[] = [];
		// When hydrated, the item's SSR root element (if any) is claimed here;
		// the marker is anchored to it so `removeRange`/`moveBefore` operate on
		// the claimed content instead of duplicating it.
		const c = claim ? claim(key) : null;
		parent.insertBefore(marker, c ? c.el : endAnchor);
		createItem(item, i, effs, c ? c.el : null);
		map.set(key, { marker, effs });
	}

	return (newItems: T[]) => {
		const newKeys = newItems.map(keyFn);
		const newSet = new Set(newKeys);

		for (const [key, { marker, effs }] of map) {
			if (!newSet.has(key)) {
				removeRange(marker, endAnchor);
				marker.remove();
				for (const e of effs) destroy_block(e);
				map.delete(key);
			}
		}

		let ref: Node = endAnchor;
		for (let i = newKeys.length - 1; i >= 0; i--) {
			const key = newKeys[i];
			let entry = map.get(key);
			if (entry) {
				if (entry.marker.nextSibling !== ref) {
					moveBefore(entry.marker, endAnchor, ref);
				}
				ref = entry.marker;
			} else {
				const marker = document.createComment('k:' + key);
				const effs: Block[] = [];
				parent.insertBefore(marker, ref);
				createItem(newItems[i], i, effs, null);
				map.set(key, { marker, effs });
				ref = marker;
			}
		}
	};
}

/**
 * Keyed-list hydration (claim-by-key). Positions the map's `anchor`/`endAnchor`
 * around the SSR-claimed item elements so the map region stays inside the
 * containing element, then hands off to `reconcile` with the walker's
 * `claimByKey` as the claim function. Items that never had SSR markers (the
 * list was empty or the client data grew) anchor at the end of the region and
 * render fresh. SSR↔client reorder adopts each item by key and moves it into
 * client order (node identity preserved — no content swapping, no twins);
 * only genuinely missing keys render fresh. RULE: NO DUPLICATION.
 */
export function reconcileHydrated<T>(
	anchor: Node,
	endAnchor: Node,
	items: T[],
	keyFn: (item: T, index: number) => string,
	createItem: (item: T, index: number, effs: Block[], root: Element | null) => void,
	walker: KeyedHydrateWalker,
	parent: Node,
): (newItems: T[]) => void {
	// Phase 1: adopt every item by key up front. Relocate moves out-of-order
	// nodes to the cursor, so afterwards adopted elements stand contiguous in
	// client order with node identity preserved. Anchors must be placed AFTER
	// this (phase 2): placing them first would strand moved nodes outside the
	// region and corrupt every later range operation.
	const claimed = new Map<string, Element>();
	for (let i = 0; i < items.length; i++) {
		const key = keyFn(items[i], i);
		if (claimed.has(key)) continue;
		const c = walker.claimByKey ? walker.claimByKey(key, { relocate: true }) : null;
		if (c) claimed.set(key, c.el);
	}

	// Phase 2: anchors around the adopted span, in client order.
	const orderedEls: Element[] = [];
	for (let i = 0; i < items.length; i++) {
		const el = claimed.get(keyFn(items[i], i));
		if (el && !orderedEls.includes(el)) orderedEls.push(el);
	}

	if (orderedEls.length > 0) {
		parent.insertBefore(anchor, orderedEls[0]);
		const last = orderedEls[orderedEls.length - 1];
		parent.insertBefore(endAnchor, last.nextSibling);
	} else {
		parent.appendChild(anchor);
		parent.appendChild(endAnchor);
	}

	return reconcile(anchor, endAnchor, items, keyFn, createItem, (key: string) => {
		const el = claimed.get(key);
		return el ? { el } : null;
	});
}

function removeRange(start: Node, end: Node): void {
	let n = start.nextSibling;
	while (n && n !== end && !(n.nodeType === 8 && n.nodeValue && n.nodeValue.startsWith('k:'))) {
		const next = n.nextSibling;
		n.remove();
		n = next;
	}
}

function moveBefore(marker: Node, endAnchor: Node, ref: Node): void {
	const nodes: Node[] = [];
	let n = marker.nextSibling;
	while (n && n !== endAnchor && !(n.nodeType === 8 && n.nodeValue && n.nodeValue.startsWith('k:'))) {
		nodes.push(n);
		n = n.nextSibling;
	}
	const parent = marker.parentNode as HTMLElement;
	parent.insertBefore(marker, ref);
	for (const node of nodes) parent.insertBefore(node, ref);
}