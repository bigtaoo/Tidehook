import { describe, expect, it } from 'vitest';
import { SafeStore } from '../../platform/types';
import { B } from '../../sim/balance';
import { Harbour } from './harbour';
import { harbourTip, TIP_AFTER } from './tip';

const fog = B.seas.findIndex((s) => s.id === 'fog');
const flatGame = (h: Harbour) => h.logGame({ wave: 1, games: 0, bay: 1 });

describe('the harbour tip', () => {
  it('counts flat games, and a best, a log entry or a purchase starts over', () => {
    const h = new Harbour(new SafeStore(null));
    h.logGame({ wave: 3, bay: 3 });
    expect(h.flat).toBe(0);
    flatGame(h);
    flatGame(h);
    expect(h.flat).toBe(2);
    h.logGame({ wave: 4, bay: 4 });
    expect(h.flat).toBe(0);
    flatGame(h);
    h.earn(1000);
    h.buy('hull');
    expect(h.flat).toBe(0);
  });

  it('keeps the count across visits', () => {
    const store = new SafeStore(null);
    const h = new Harbour(store);
    h.logGame({ wave: 3, bay: 3 });
    flatGame(h);
    expect(new Harbour(store).flat).toBe(1);
  });

  it('says nothing until the player is stuck, once something has been bought', () => {
    const h = new Harbour(new SafeStore(null));
    h.logGame({ wave: 3, bay: 3 });
    h.earn(1000);
    h.buy('hull');
    h.pearls = 0;
    for (let i = 1; i < TIP_AFTER; i++) flatGame(h);
    expect(harbourTip(h)).toBeNull();
    flatGame(h);
    expect(harbourTip(h)).toEqual({ kind: 'log' });
  });

  it('tells a player who has never bought anything that the pearls are to spend', () => {
    const h = new Harbour(new SafeStore(null));
    expect(harbourTip(h)).toBeNull(); // home with nothing: nothing to say
    const cheapest = Math.min(...B.meta.upgrades.map((u) => h.price(u.id) ?? Infinity));
    h.earn(cheapest);
    expect(h.flat).toBeLessThan(TIP_AFTER);
    expect(harbourTip(h)).toEqual({ kind: 'buy' }); // said on the first visit, not after two flat games
    h.buy(B.meta.upgrades.find((u) => h.price(u.id) === cheapest)!.id);
    expect(harbourTip(h)).toBeNull(); // and never again, however many pearls are in hand
    h.earn(1000);
    expect(harbourTip(h)).toBeNull();
  });

  it('points at a harder sea owned, then an affordable chart, an upgrade, a chart to save for', () => {
    const h = new Harbour(new SafeStore(null));
    h.logGame({ wave: B.seas[fog].needs, bay: B.seas[fog].needs });
    h.pearls = 0; // the log entries that wave met paid out
    const stuck = () => {
      for (let i = 0; i < TIP_AFTER; i++) flatGame(h);
    };
    stuck();
    expect(harbourTip(h)).toEqual({ kind: 'save', sea: fog, n: B.seas[fog].price });
    const cheapest = Math.min(...B.meta.upgrades.map((u) => h.price(u.id) ?? Infinity));
    h.earn(cheapest);
    expect(harbourTip(h)).toEqual({ kind: 'buy' });
    h.earn(B.seas[fog].price);
    expect(harbourTip(h)).toEqual({ kind: 'chart', sea: fog });
    h.buyChart(fog);
    h.pick(0);
    stuck();
    expect(harbourTip(h)).toEqual({ kind: 'sea', sea: fog });
  });
});
