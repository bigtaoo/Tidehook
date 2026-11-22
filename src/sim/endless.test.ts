// The endless shop (docs/04-content.md section 2): a long game always has cards to choose from,
// at prices that rise with the catch instead of running away from it.

import { describe, expect, it } from 'vitest';
import { B, ENDLESS } from './balance';
import { BF } from './balanceFun';
import { ALL_PLANS } from './meta';
import { cappedLeft, dealable, dealSize, price, priceAt, rollShop } from './shop';
import { startGame } from './step';

const ENDLESS_IDS = ['grip', 'heft', 'barb', 'planks'];

describe('the endless shop', () => {
  it('has the core cards and the planks without a cap, rising by a few coins a level', () => {
    for (const id of ENDLESS_IDS) {
      const u = B.upgrades.find((x) => x.id === id)!;
      expect(u.max).toBe(ENDLESS);
      expect(u.step).toBeGreaterThan(0);
      expect(priceAt(u, 30) - priceAt(u, 29)).toBe(u.step);
    }
  });

  it('still deals a full hand once every capped card is bought', () => {
    const w = startGame(4, 0, ALL_PLANS);
    w.wave = 40;
    for (const u of B.upgrades) if (!u.step) w.lv[u.id] = u.max;
    expect(cappedLeft(w)).toBe(false);
    expect(dealable(w).map((u) => u.id).sort()).toEqual([...ENDLESS_IDS].sort());
    rollShop(w);
    expect(w.cards.filter((c) => !B.upgrades.find((u) => u.id === c.id)!.rare)).toHaveLength(4);
  });

  it('lays out a fourth card from the wave the deal grows', () => {
    const w = startGame(5);
    w.wave = B.shop.moreFrom - 1;
    expect(dealSize(w)).toBe(B.shop.cards);
    w.wave = B.shop.moreFrom;
    expect(dealSize(w)).toBe(B.shop.cards + 1);
  });

  it('never lays out five, stall or not', () => {
    const w = startGame(5);
    w.stall = 1;
    w.wave = 1;
    expect(dealSize(w)).toBe(B.shop.cards + 1);
    w.wave = B.shop.moreFrom;
    expect(dealSize(w)).toBe(B.shop.cards + 1);
    // nor with a rare card on top, whatever the luck
    for (let seed = 1; seed <= 200; seed++) {
      const r = startGame(seed);
      r.stall = 1;
      r.wave = BF.rare.from + 10;
      rollShop(r);
      expect(r.cards.length).toBeLessThanOrEqual(B.shop.cards + 1);
    }
  });

  it('keeps no capped card past a few hundred coins', () => {
    for (const u of B.upgrades) if (!u.step && !u.rare) expect(priceAt(u, u.max - 1), u.id).toBeLessThanOrEqual(120);
  });

  it('prices an endless card up with the wave late on, and a capped card not at all', () => {
    const w = startGame(5);
    const grip = B.upgrades.find((u) => u.id === 'grip')!;
    const capped = B.upgrades.find((u) => !u.step && !u.rare)!;
    w.wave = B.shop.endlessFrom;
    expect(price(w, 'grip')).toBe(priceAt(grip, 0));
    w.wave = B.shop.endlessFrom + 10;
    const scale = 1000 + Math.floor((B.catch.valuePerWave * B.shop.endlessByWave) / 1000) * 10;
    expect(price(w, 'grip')).toBe(Math.round((priceAt(grip, 0) * scale) / 1000));
    expect(price(w, capped.id)).toBe(priceAt(capped, 0));
  });
});
