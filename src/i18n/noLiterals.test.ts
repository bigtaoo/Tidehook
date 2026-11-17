import { describe, expect, it } from 'vitest';

// No words the player reads are written in the code: they all come from a table through t()
// (i18n/index.ts), or a missing one is a compile error rather than an English word on a German
// screen. Nothing at build time catches a literal handed to a Button or a Text, so the source is
// read here, the way the storage keys are (src/saveKeys.test.ts): a `text:` or `label:` given a
// string must be empty or a table's key path, never words.

const sources = import.meta.glob<string>('../**/*.ts', { query: '?raw', import: 'default', eager: true });

/** A key path ('shop.buy'), not words: what a widget is allowed to be handed as a string. */
const key = (s: string) => s === '' || /^[a-z][\w]*(\.[\w]+)+$/.test(s);

describe('no written-in words', () => {
  it('hands no widget words of its own', () => {
    const found: string[] = [];
    for (const [path, text] of Object.entries(sources)) {
      if (path.endsWith('.test.ts') || path.includes('/i18n/')) continue;
      for (const m of text.matchAll(/\b(?:text|label):\s*'([^']*)'/g)) if (!key(m[1])) found.push(`${path.slice(3)}: ${m[0]}`);
    }
    expect(found).toEqual([]);
  });

  it('knows words when it sees them', () => {
    expect(key('')).toBe(true);
    expect(key('guide.cast')).toBe(true);
    expect(key('Blueprints')).toBe(false);
    expect(key('Mines {n}')).toBe(false);
  });
});
