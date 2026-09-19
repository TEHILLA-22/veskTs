/**
 * Object `style` support tests.
 *
 * A `style` attribute whose value is an object literal (e.g.
 * `style={{ opacity: 1, transform: 'translateY(0)' }}`) must be applied as
 * CSS properties, not stringified to `[object Object]`. Server serialises it
 * to a CSS text attribute; client applies it through the runtime `applyStyle`
 * helper (diffing keys so removed properties are cleared).
 *
 * Run with: npx tsx packages/compiler/src/style-object.test.ts
 */
import { render } from '@vesk/compiler/src/server-codegen';
import { compileClient } from '@vesk/compiler/src/client-codegen';

let passed = 0;
let failed = 0;

function describe(name, fn) { console.log(`\n${name}`); fn(); }

function it(name, fn) {
	try { fn(); passed++; console.log(`  ✓ ${name}`); }
	catch (e) { failed++; console.log(`  ✗ ${name}`); console.log(`    ${e.message}`); }
}

function expect(value) {
	return {
		toBe(expected) { if (value !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`); },
		not: {
			toBe(expected) { if (value === expected) throw new Error(`Expected NOT ${JSON.stringify(expected)}`); },
			toContain(sub) { if (String(value).includes(sub)) throw new Error(`Expected NOT to contain ${JSON.stringify(sub)}`); },
		},
		toContain(sub) { if (!String(value).includes(sub)) throw new Error(`Expected to contain ${JSON.stringify(sub)} in ${JSON.stringify(value)}`); },
	};
}

describe('Server — object style serialisation', () => {
	it('serialises an object style to CSS text', () => {
		const html = render(`component App { return <div style={{ opacity: 1, transform: 'translateY(0)' }}>hi</div>; }`, 'App');
		expect(html).toContain('style="opacity:1;transform:translateY(0);"');
		expect(html).not.toContain('[object Object]');
	});

	it('converts camelCase keys to kebab-case', () => {
		const html = render(`component App { return <div style={{ paddingTop: '4px', backgroundColor: 'red' }}>hi</div>; }`, 'App');
		expect(html).toContain('style="padding-top:4px;background-color:red;"');
	});

	it('skips null/undefined/false property values', () => {
		const html = render(`component App { return <div style={{ opacity: null, color: false, display: 'block' }}>hi</div>; }`, 'App');
		expect(html).toContain('style="display:block;"');
	});

	it('renders a reactive object style branch', () => {
		const html = render(`component App {
			const &[shown] = track(false)
			return <div style={shown ? { opacity: 1 } : { transitionDelay: '120ms' }}>hi</div>;
		}`, 'App');
		expect(html).toContain('style="transition-delay:120ms;"');
		expect(html).not.toContain('[object Object]');
	});

	it('still renders a string style as-is', () => {
		const html = render(`component App { return <div style="color: red">hi</div>; }`, 'App');
		expect(html).toContain('style="color: red"');
	});
});

describe('Client — object style via applyStyle', () => {
	it('emits an applyStyle effect for object style (normal)', () => {
		const code = compileClient(`component App client { <div style={{ opacity: 1 }}>hi</div> }`, null, { forceClient: true });
		expect(code).toContain('applyStyle');
		expect(code).not.toContain("setAttribute('style', String(");
	});

	it('emits an applyStyle effect for object style (hydrate)', () => {
		const code = compileClient(`component App client { <div style={{ opacity: 1 }}>hi</div> }`, null, { hydrate: true, forceClient: true });
		expect(code).toContain('applyStyle');
	});

	it('imports applyStyle from the runtime', () => {
		const code = compileClient(`component App client { <div style={{ opacity: 1 }}>hi</div> }`, null, { forceClient: true });
		expect(code).toContain('applyStyle');
		expect(code).toContain("from '@vesk/runtime'");
	});

	it('keeps string styles on setAttribute', () => {
		const code = compileClient(`component App client { <div style="color: red">hi</div> }`, null, { forceClient: true });
		expect(code).toContain('setAttribute("style"');
	});
});

console.log(`\nResults: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
