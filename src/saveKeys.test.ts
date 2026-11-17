import { describe, expect, it } from 'vitest';
import { SAVE_KEYS } from './saveKeys';

// A key that a module keeps but the list does not know about is lost on the portal, where only the
// listed keys are read at boot (saveKeys.ts). Nothing catches that at build time, and in dev the
// browser's own store hides it, so the source itself is scanned: every `'tidehook.…'` literal
// declared under src must be in SAVE_KEYS.

const sources = import.meta.glob<string>('./**/*.ts', { query: '?raw', import: 'default', eager: true });

/** The storage keys declared anywhere under src, as `[file, key]`. */
function declared(): [string, string][] {
  const out: [string, string][] = [];
  for (const [path, text] of Object.entries(sources)) {
    if (path.endsWith('.test.ts')) continue;
    for (const m of text.matchAll(/_KEY\s*=\s*'(tidehook\.[\w.]+)'/g)) out.push([path.slice(2), m[1]]);
  }
  return out;
}

describe('save keys', () => {
  it('finds the keys the game keeps', () => {
    const keys = declared().map(([, k]) => k);
    expect(keys).toContain('tidehook.harbour');
    expect(keys.length).toBeGreaterThanOrEqual(SAVE_KEYS.length);
  });

  it('lists every key a module declares', () => {
    const missing = declared().filter(([, k]) => !SAVE_KEYS.includes(k));
    expect(missing.map(([f, k]) => `${f}: ${k} is not in SAVE_KEYS`)).toEqual([]);
  });

  it('holds no key twice and none that no module declares', () => {
    const keys = declared().map(([, k]) => k);
    expect([...new Set(SAVE_KEYS)]).toEqual([...SAVE_KEYS]);
    expect(SAVE_KEYS.filter((k) => !keys.includes(k))).toEqual([]);
  });
});
