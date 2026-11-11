import { describe, expect, it } from 'vitest';
import { Redraw } from './redraw';

describe('Redraw', () => {
  it('draws while there is something to show', () => {
    const r = new Redraw();
    expect([r.needed(true), r.needed(true), r.needed(true)]).toEqual([true, true, true]);
  });

  it('wipes the layer once, then leaves it alone', () => {
    const r = new Redraw();
    r.needed(true);
    expect(r.needed(false)).toBe(true);
    expect([r.needed(false), r.needed(false)]).toEqual([false, false]);
  });

  it('skips a layer that was never busy', () => {
    const r = new Redraw();
    expect([r.needed(false), r.needed(false)]).toEqual([false, false]);
  });

  it('comes back when the layer fills again', () => {
    const r = new Redraw();
    r.needed(false);
    expect(r.needed(true)).toBe(true);
    expect(r.needed(false)).toBe(true);
    expect(r.needed(false)).toBe(false);
  });
});
