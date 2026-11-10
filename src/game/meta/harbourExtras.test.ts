import { describe, expect, it } from 'vitest';
import { SafeStore } from '../../platform/types';
import { BF } from '../../sim/balanceFun';
import { sunkKey } from '../../sim/goals';
import { Harbour, HARBOUR_KEY, streakPearls } from './harbour';
import { FREE_PAINT, paintPrice, wornColors } from './paint';

describe('the paint', () => {
  it('starts with the free rope and hook worn, and charges more for each paint bought', () => {
    const store = new SafeStore(null);
    const h = new Harbour(store);
    expect(h.wear).toEqual(FREE_PAINT);
    expect(h.buyPaint('red')).toBe(false);
    h.earn(10_000);
    expect(h.paintPrice).toBe(paintPrice(0));
    expect(h.buyPaint('red')).toBe(true);
    expect(h.pearls).toBe(10_000 - paintPrice(0));
    expect(h.wear.rope).toBe('red');
    expect(h.paintPrice).toBe(paintPrice(1));
    expect(paintPrice(1)).toBeGreaterThan(paintPrice(0));
    expect(h.buyPaint('red')).toBe(false);
    expect(h.buyPaint('hemp')).toBe(false);
    expect(h.buyPaint('jade')).toBe(true);
    expect(h.wear).toEqual({ rope: 'red', hook: 'jade' });
    const again = new Harbour(store);
    expect(again.paints).toEqual(['red', 'jade']);
    expect(again.wear).toEqual({ rope: 'red', hook: 'jade' });
  });

  it('wears only paint owned or free, and on its own part', () => {
    const h = new Harbour(new SafeStore(null));
    expect(h.wearPaint('gold')).toBe(false);
    h.earn(10_000);
    h.buyPaint('gold');
    expect(h.wearPaint('hemp')).toBe(true);
    expect(h.wear.rope).toBe('hemp');
    expect(h.wearPaint('gold')).toBe(true);
    expect(h.wear).toEqual({ rope: 'gold', hook: 'steel' });
  });

  it('drops saved paint not owned, unknown or on the wrong part', () => {
    const store = new SafeStore(null);
    store.setItem(HARBOUR_KEY, JSON.stringify({ pearls: 5, paints: ['red', 'nope', 'hemp', 3], wear: { rope: 'blue', hook: 'red' } }));
    const h = new Harbour(store);
    expect(h.paints).toEqual(['red']);
    expect(h.wear).toEqual(FREE_PAINT);
  });

  it('colours the free rope and hook for no harbour', () => {
    expect(wornColors(undefined)).toEqual(wornColors(FREE_PAINT));
    expect(wornColors({ rope: 'tar' }).rope).not.toBe(wornColors(undefined).rope);
  });
});

describe('the daily streak', () => {
  it('grows a day at a time, pays once a day and starts again after a gap', () => {
    const store = new SafeStore(null);
    const h = new Harbour(store);
    expect(h.streakOn('2026-11-10')).toEqual({ n: 1, today: false, pearls: streakPearls(1) });
    expect(h.sailDaily('2026-11-10')).toEqual({ n: 1, pearls: streakPearls(1) });
    expect(h.sailDaily('2026-11-10')).toEqual({ n: 1, pearls: 0 });
    expect(h.streakOn('2026-11-10').today).toBe(true);
    expect(h.sailDaily('2026-11-11').n).toBe(2);
    expect(new Harbour(store).streak).toEqual({ day: '2026-11-11', n: 2 });
    expect(h.sailDaily('2026-11-13')).toEqual({ n: 1, pearls: streakPearls(1) });
    expect(h.pearls).toBe(streakPearls(1) * 2 + streakPearls(2));
  });

  it('stops growing its pearls at the cap', () => {
    expect(streakPearls(BF.streak.cap + 5)).toBe(streakPearls(BF.streak.cap));
    expect(streakPearls(2)).toBe(BF.streak.per * 2);
  });
});

describe('the codex', () => {
  it('pays for each kind the first time one is sunk', () => {
    const h = new Harbour(new SafeStore(null));
    h.logGame({ [sunkKey('grunt')]: 3, [sunkKey('darter')]: 1, games: 1 });
    expect(h.lastCodex).toBe(2 * BF.codex.pearls);
    expect(h.pearls).toBe(2 * BF.codex.pearls);
    h.logGame({ [sunkKey('grunt')]: 2, [sunkKey('ray')]: 1, games: 1 });
    expect(h.lastCodex).toBe(BF.codex.pearls);
    h.logGame({ [sunkKey('grunt')]: 2, games: 1 });
    expect(h.lastCodex).toBe(0);
  });
});
