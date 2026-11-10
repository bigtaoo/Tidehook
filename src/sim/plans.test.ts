// The harbour's blueprints and the cards behind them (docs/04-content.md section 3).

import { describe, expect, it } from 'vitest';
import { B } from './balance';
import { ALL_PLANS, applyMeta } from './meta';
import { kill, spawn } from './monsters';
import { offered, rollShop } from './shop';
import { startGame } from './step';
import { newWorld } from './world';

const LOCKED = B.upgrades.filter((u) => u.locked).map((u) => u.id);

describe('blueprints', () => {
  it('every locked card has a blueprint, and every blueprint a locked card', () => {
    const plans = B.meta.upgrades.filter((u) => u.unlock).map((u) => u.unlock);
    expect([...plans].sort()).toEqual([...LOCKED].sort());
    expect(Object.keys(ALL_PLANS)).toHaveLength(LOCKED.length);
  });

  it('the shop never offers a locked card without its blueprint', () => {
    const w = startGame(7);
    for (let i = 0; i < 200; i++) {
      rollShop(w);
      for (const c of w.cards) expect(LOCKED).not.toContain(c.id);
    }
  });

  it('a blueprint lets the shop offer its card', () => {
    const w = startGame(7, 0, { planTar: 1 });
    expect(offered(w, B.upgrades.find((u) => u.id === 'tar')!)).toBe(true);
    expect(offered(w, B.upgrades.find((u) => u.id === 'blast')!)).toBe(false);
    let seen = false;
    for (let i = 0; i < 200 && !seen; i++) {
      rollShop(w);
      seen = w.cards.some((c) => c.id === 'tar');
    }
    expect(seen).toBe(true);
  });

  it('the wider stall lays out one more card', () => {
    const w = startGame(3, 0, { stall: 1 });
    rollShop(w);
    expect(w.cards).toHaveLength(B.shop.cards + 1);
  });
});

describe('the cards behind them', () => {
  it('salvage leaves junk behind every so many monsters sunk', () => {
    const w = newWorld(5);
    applyMeta(w, {});
    w.up.salvage = 1;
    w.items = [];
    const every = B.salvage.every - 1;
    for (let i = 0; i < every * 2; i++) kill(w, spawn(w, 'grunt'), false);
    expect(w.items.filter((o) => o.kind === 'junk')).toHaveLength(2);
    // crushed on the dock: nothing left in the water
    for (let i = 0; i < every; i++) kill(w, spawn(w, 'grunt'), true);
    expect(w.items.filter((o) => o.kind === 'junk')).toHaveLength(2);
  });
});
