import { describe, expect, it } from 'vitest';
import { SafeStore } from '../../platform/types';
import { B } from '../../sim/balance';
import { metaUpgrade } from '../../sim/meta';
import { Harbour, HARBOUR_KEY } from './harbour';

describe('the harbour', () => {
  it('buys with pearls and keeps the levels in the store', () => {
    const store = new SafeStore(null);
    const h = new Harbour(store);
    expect(h.pearls).toBe(0);
    expect(h.buy('hull')).toBe(false);
    h.earn(100);
    const p = h.price('hull') as number;
    expect(h.buy('hull')).toBe(true);
    expect(h.pearls).toBe(100 - p);
    expect(h.level('hull')).toBe(1);
    const again = new Harbour(store);
    expect(again.pearls).toBe(100 - p);
    expect(again.levels).toEqual({ hull: 1 });
  });

  it('stops at the max', () => {
    const h = new Harbour(new SafeStore(null));
    h.earn(1_000_000);
    const max = metaUpgrade('grip').max;
    for (let i = 0; i < max; i++) expect(h.buy('grip')).toBe(true);
    expect(h.price('grip')).toBeNull();
    expect(h.buy('grip')).toBe(false);
  });

  it('reads bad data as an empty harbour, and wild levels within bounds', () => {
    const store = new SafeStore(null);
    store.setItem(HARBOUR_KEY, '{oops');
    expect(new Harbour(store).pearls).toBe(0);
    store.setItem(HARBOUR_KEY, JSON.stringify({ pearls: -5, lv: { hull: 99, what: 3 } }));
    const h = new Harbour(store);
    expect(h.pearls).toBe(0);
    expect(h.levels).toEqual({ hull: B.meta.upgrades.find((u) => u.id === 'hull')?.max });
  });

  it("writes the captain's log once, pays its pearls and keeps it", () => {
    const store = new SafeStore(null);
    const h = new Harbour(store);
    const met = h.logGame({ wave: 10, kills: 70, games: 1 });
    const ids = met.map((g) => g.id);
    expect(ids).toEqual(expect.arrayContaining(['game.wave.5', 'game.wave.8', 'game.wave.10', 'game.kills.60']));
    expect(ids).not.toContain('total.games.5');
    expect(h.pearls).toBe(met.reduce((s, g) => s + g.pearls, 0));
    // a worse game meets nothing new, but its kills count toward the totals
    expect(h.logGame({ wave: 3, kills: 10, games: 1 })).toEqual([]);
    const again = new Harbour(store);
    expect(again.done).toEqual(ids);
    expect(again.best.wave).toBe(10);
    expect(again.totals).toMatchObject({ kills: 80, games: 2 });
    for (let i = 0; i < 2; i++) again.logGame({ games: 1 });
    expect(again.logGame({ games: 1 }).map((g) => g.id)).toEqual(['total.games.5']);
  });

  it('reads a bad log as an empty one', () => {
    const store = new SafeStore(null);
    store.setItem(HARBOUR_KEY, JSON.stringify({ pearls: 5, lv: {}, best: { wave: 'x', kills: -1, mined: 4 }, totals: 7, done: ['a', 3] }));
    const h = new Harbour(store);
    expect(h.best).toEqual({ mined: 4 });
    expect(h.totals).toEqual({});
    expect(h.done).toEqual(['a']);
  });

  it('sells a sea chart once the sea before it is sailed far enough, and sails there', () => {
    const store = new SafeStore(null);
    const h = new Harbour(store);
    h.earn(10_000);
    expect(h.owns(0)).toBe(true);
    expect(h.chartPrice(1)).toBeNull();
    expect(h.buyChart(1)).toBe(false);
    h.logGame({ wave: B.seas[1].needs, bay: B.seas[1].needs, games: 1 });
    expect(h.chartPrice(1)).toBe(B.seas[1].price);
    expect(h.chartPrice(2)).toBeNull();
    expect(h.buyChart(1)).toBe(true);
    expect(h.sea).toBe(1);
    expect(h.chartPrice(1)).toBeNull();
    expect(h.pick(2)).toBe(false);
    expect(h.pick(0)).toBe(true);
    expect(h.pick(1)).toBe(true);
    const again = new Harbour(store);
    expect(again.sea).toBe(1);
    expect(again.charts).toEqual([B.seas[1].id]);
  });

  it('sails the home bay when the saved sea is not owned', () => {
    const store = new SafeStore(null);
    store.setItem(HARBOUR_KEY, JSON.stringify({ pearls: 0, lv: {}, sea: 'storm', charts: ['nowhere'] }));
    const h = new Harbour(store);
    expect(h.sea).toBe(0);
    expect(h.charts).toEqual([]);
  });
});
