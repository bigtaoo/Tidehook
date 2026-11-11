import { describe, expect, it } from 'vitest';
import type { Graphics } from 'pixi.js';
import { PipRow } from './pips';

const shown = (r: PipRow) => (r.children as Graphics[]).filter((g) => g.visible);

describe('PipRow', () => {
  it('reuses its graphics instead of making one a frame', () => {
    const row = new PipRow();
    for (let frame = 0; frame < 5; frame++) {
      row.begin();
      for (let i = 0; i < 12; i++) row.put(i * 10, 0, 3, i > 8);
      row.end();
    }
    expect(row.children).toHaveLength(12);
    expect(shown(row)).toHaveLength(12);
  });

  it('hides the pips a shorter row leaves over', () => {
    const row = new PipRow();
    row.begin();
    for (let i = 0; i < 12; i++) row.put(i * 10, 0, 3, false);
    row.end();
    row.begin();
    row.put(0, 0, 3, false);
    row.end();
    expect(row.children).toHaveLength(12);
    expect(shown(row)).toHaveLength(1);
  });

  it('places and sizes a pip, and gives the heavy ones the other shape', () => {
    const row = new PipRow();
    row.begin();
    row.put(20, 40, 2.5, false);
    row.put(30, 40, 2.5, true);
    row.end();
    const [a, b] = row.children as Graphics[];
    expect([a.x, a.y, a.scale.x]).toEqual([20, 40, 2.5]);
    expect(b.x).toBe(30);
    expect(a.context).not.toBe(b.context);
  });

  it('shares one context per shape across every pip of that shape', () => {
    const row = new PipRow();
    row.begin();
    for (let i = 0; i < 6; i++) row.put(i * 10, 0, 3, i % 2 === 0);
    row.end();
    const ctx = (row.children as Graphics[]).map((g) => g.context);
    expect(new Set(ctx).size).toBe(2);
  });
});
