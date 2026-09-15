/**
 * Shared `vesk.config.{ts,js}` loader for the CLI and the production server.
 *
 * TS configs are transpiled to ESM and evaluated from a temp module rooted
 * inside the project (`.vesk/`) so bare package imports (`@vesk/plugin-*`)
 * resolve against the project's own `node_modules`. `@vesk/compiler` imports
 * are stripped and the helpers injected via `globalThis.__vesk_inject` so the
 * running CLI/adapter's own compiler build is used regardless of which version
 * the project has installed.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { defineConfig, definePlugin, preset, validateConfig } from '@vesk/compiler/src/config';
import type { VeskConfig } from '@vesk/compiler/src/types';

export async function loadVeskConfig(projectDir: string): Promise<VeskConfig | undefined> {
  const jsPath = join(projectDir, 'vesk.config.js');
  const tsPath = join(projectDir, 'vesk.config.ts');
  let configPath: string | null = null;
  if (existsSync(jsPath)) configPath = jsPath;
  else if (existsSync(tsPath)) configPath = tsPath;
  if (!configPath) return undefined;

  let raw: unknown;
  if (configPath.endsWith('.ts')) {
    const { transpile } = await import('typescript');
    const src = readFileSync(configPath, 'utf-8');
    let js = transpile(src, { module: 99, target: 99 });

    const inject: Record<string, unknown> = { defineConfig, definePlugin, preset };
    const projectRequire = createRequire(join(projectDir, 'package.json'));
    const importRe =
      /import\s+(?:(?:\*\s*as\s+([\w$]+))|([\w$]+(?:\s*,\s*\{[^}]*\})?)|(\{[^}]*\}))\s+from\s+['"]([^'"]+)['"]\s*;?/g;
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(js)) !== null) {
      const nsName = m[1];
      const defPart = m[2];
      const namedPart = m[3];
      const specifier = m[4];
      if (specifier === '@vesk/compiler') continue;
      const mod = await import(pathToFileURL(projectRequire.resolve(specifier)).href);
      if (nsName) {
        inject[nsName] = mod;
      } else if (defPart) {
        const defaultName = defPart.split(',')[0].trim();
        inject[defaultName] = (mod as { default?: unknown }).default ?? mod;
        const open = defPart.indexOf('{');
        if (open !== -1) {
          for (const n of defPart.slice(open).matchAll(/(\w+)/g)) inject[n[1]] = (mod as Record<string, unknown>)[n[1]];
        }
      } else if (namedPart) {
        for (const n of namedPart.matchAll(/(\w+)/g)) inject[n[1]] = (mod as Record<string, unknown>)[n[1]];
      }
    }
    js = js.replace(importRe, '');

    const injectKeys = Object.keys(inject);
    js = `const {${injectKeys.join(',')}} = globalThis.__vesk_inject;\n` + js;

    const tmpFile = join(projectDir, '.vesk', 'config.loader.tmp.mjs');
    mkdirSync(dirname(tmpFile), { recursive: true });
    writeFileSync(tmpFile, js, 'utf-8');
    (globalThis as Record<string, unknown>).__vesk_inject = inject;
    try {
      const mod = await import(`${pathToFileURL(tmpFile).href}?t=${Date.now()}`);
      raw = (mod as { default?: unknown }).default;
    } finally {
      delete (globalThis as Record<string, unknown>).__vesk_inject;
    }
  } else {
    const mod = await import(`${pathToFileURL(configPath).href}?t=${Date.now()}`);
    raw = (mod as { default?: unknown }).default;
  }

  if (typeof raw === 'function') raw = (raw as () => unknown)();
  const config = (typeof defineConfig === 'function' ? defineConfig(raw as VeskConfig) : raw) as VeskConfig;
  if (typeof validateConfig === 'function') validateConfig(config);
  return config;
}