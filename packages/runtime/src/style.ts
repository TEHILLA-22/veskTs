export type StyleInput = string | Record<string, unknown> | boolean | null | undefined;

function kebab(key: string): string {
	return key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

export function styleText(value: StyleInput): string {
	if (value == null || value === false) return '';
	if (typeof value === 'string') return value;
	if (typeof value !== 'object') return String(value);
	let out = '';
	for (const key in value) {
		const v = (value as Record<string, unknown>)[key];
		if (v == null || v === false) continue;
		out += `${kebab(key)}:${v};`;
	}
	return out;
}

export function applyStyle(el: Element, value: StyleInput): void {
	const node = el as HTMLElement & { __vskStyle?: Record<string, string> };
	if (value == null || value === false) {
		for (const key in node.__vskStyle || {}) node.style.removeProperty(key);
		node.__vskStyle = {};
		return;
	}
	if (typeof value === 'string') {
		node.__vskStyle = undefined;
		if (node.getAttribute('style') !== value) node.setAttribute('style', value);
		return;
	}
	if (typeof value !== 'object') return;
	const prev = node.__vskStyle || {};
	const next: Record<string, string> = {};
	for (const key in value) {
		const v = (value as Record<string, unknown>)[key];
		if (v == null || v === false) continue;
		next[kebab(key)] = String(v);
	}
	for (const key in prev) if (!(key in next)) node.style.removeProperty(key);
	for (const key in next) node.style.setProperty(key, next[key]);
	node.__vskStyle = next;
}
