import { describe, expect, it } from 'vitest';
import { buildId } from './buildId.mjs';
import { countLines, lengthErrors } from './fileLength.mjs';
import { overBudget } from './size.mjs';
import { unzip, zip } from './zip.mjs';

describe('file length', () => {
  it('counts lines as an editor numbers them', () => {
    expect(countLines('a\nb\n')).toBe(2);
    expect(countLines('a\nb')).toBe(2);
  });

  it('flags a file over the limit and keeps baseline files from growing', () => {
    expect(lengthErrors([['a.ts', 3]], {}, 2)).toEqual(['a.ts: 3 lines, over 2']);
    expect(lengthErrors([['a.ts', 2]], {}, 2)).toEqual([]);
    expect(lengthErrors([['a.ts', 5]], { 'a.ts': 4 }, 2)[0]).toMatch(/grew/);
    expect(lengthErrors([], { 'a.ts': 4 }, 2)[0]).toMatch(/gone/);
  });
});

describe('bundle size', () => {
  it('passes under the budget and complains over it', () => {
    expect(overBudget(4_999_999)).toBe('');
    expect(overBudget(5_000_001)).toMatch(/over the 5 MB budget/);
  });
});

describe('build id', () => {
  it('is version+sha, dirty when tracked files changed, the version alone without git', () => {
    expect(buildId((a) => (a.startsWith('rev-parse') ? 'abc1234' : ''), '1.0.0')).toBe('1.0.0+abc1234');
    expect(buildId((a) => (a.startsWith('rev-parse') ? 'abc1234' : ' M x'), '1.0.0')).toBe('1.0.0+abc1234-dirty');
    expect(buildId(() => '', '1.0.0')).toBe('1.0.0');
  });
});

describe('zip', () => {
  it('reads back what it wrote, the same bytes for the same files', () => {
    const entries = [
      { name: 'index.html', data: Buffer.from('<!doctype html>'.repeat(50)) },
      { name: 'assets/ä.js', data: Buffer.from([0, 1, 2, 255]) },
      { name: 'empty.txt', data: Buffer.alloc(0) },
    ];
    const buf = zip(entries);
    expect(unzip(buf)).toEqual(entries);
    expect(zip(entries).equals(buf)).toBe(true);
  });

  it('refuses a backslash path or a directory entry', () => {
    expect(() => zip([{ name: 'assets\\a.js', data: Buffer.alloc(1) }])).toThrow(/bad zip entry/);
    expect(() => zip([{ name: 'assets/', data: Buffer.alloc(0) }])).toThrow(/bad zip entry/);
  });
});
