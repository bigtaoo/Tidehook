// State hashing for the determinism tests (after Potion Siege's sim/hash.ts): walks the world in
// a fixed field order and folds every value into a 32-bit FNV-1a. The per-tick event list is
// skipped. A non-integer anywhere in the state is a bug (the sim is integer-only) and throws, so
// tests catch a float creeping in.

import type { World } from './world';

const SKIP = new Set(['events']);

export function hashWorld(w: World): number {
  let h = 0x811c9dc5;
  const num = (v: number, path: string) => {
    if (!Number.isSafeInteger(v)) throw new Error(`non-integer in world state at ${path}: ${v}`);
    // two 32-bit halves, so values past 2^32 are folded in whole
    h = Math.imul(h ^ (v >>> 0), 0x01000193);
    h = Math.imul(h ^ (Math.floor(v / 4294967296) >>> 0), 0x01000193);
  };
  const str = (v: string) => {
    for (let i = 0; i < v.length; i++) h = Math.imul(h ^ v.charCodeAt(i), 0x01000193);
  };
  const walk = (v: unknown, path: string): void => {
    if (typeof v === 'number') return num(v, path);
    if (typeof v === 'boolean') return num(v ? 1 : 0, path);
    if (typeof v === 'string') return str(v);
    if (v === null || v === undefined) return num(-1, path);
    if (Array.isArray(v)) {
      num(v.length, path);
      v.forEach((x, i) => walk(x, `${path}[${i}]`));
      return;
    }
    if (typeof v === 'object') {
      // a Prng hashes by its cursor
      const peek = (v as { peek?: () => number }).peek;
      if (typeof peek === 'function') return num(peek.call(v), path);
      for (const k of Object.keys(v).sort()) {
        if (SKIP.has(k)) continue;
        str(k);
        walk((v as Record<string, unknown>)[k], `${path}.${k}`);
      }
    }
  };
  walk(w, 'world');
  return h >>> 0;
}
