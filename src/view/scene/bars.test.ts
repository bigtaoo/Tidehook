// The health display for a monster too deep for a row of pips (look.ts bars, pips.ts drawBar).
// The complaint it answers: a boss carrying a chest "cannot be killed" - it could, but twelve pips
// were the most ever drawn, so the first twenty-eight hits on a wave-5 boss changed nothing on
// screen and the fight read as hopeless.

import { describe, expect, it } from 'vitest';
import { B } from '../../sim/balance';
import { toFp } from '../../sim/math/fixed';
import { spawn } from '../../sim/monsters';
import { startGame, step } from '../../sim/step';
import type { Item, Monster, World } from '../../sim/world';
import { bars, MAX_PIPS, pips } from './look';

/** How full the bar reads, counting the layers under the top one: a number that must fall with
 *  every hit for the player to see that they are getting somewhere. */
const read = (b: { left: number; fill: number }) => b.left - 1 + b.fill;

/** A monster of `kind` as it spawns at `wave`. */
function at(wave: number, kind: Monster['kind']): Monster {
  const w = startGame(1);
  w.wave = wave;
  return spawn(w, kind);
}

describe('the layered health bar', () => {
  it('reads full at full health, however deep', () => {
    for (let hp0 = 1; hp0 <= 200; hp0++) {
      const b = bars(hp0, hp0);
      expect([hp0, b.fill]).toEqual([hp0, 1]);
      expect(b.left).toBeGreaterThanOrEqual(1);
    }
  });

  it('reads empty at no health, with one layer left', () => {
    for (const hp0 of [1, 13, 39, 116]) expect(bars(0, hp0)).toMatchObject({ left: 1, fill: 0 });
  });

  it('falls on every single point of damage', () => {
    for (const hp0 of [13, 28, 39, 53, 67, 81, 116, 500]) {
      let prev = read(bars(hp0, hp0));
      for (let hp = hp0 - 1; hp >= 0; hp--) {
        const now = read(bars(hp, hp0));
        expect([hp0, hp, now < prev]).toEqual([hp0, hp, true]);
        prev = now;
      }
    }
  });

  it('keeps a layer shallow enough to see the weakest hit in the game', () => {
    // a layer is a pip row's worth at most, so a hook bounce (1 point) moves the top sheet by at
    // least a twelfth of it, however deep the monster
    for (const hp0 of [13, 39, 116, 500, 10_000]) {
      const b = bars(hp0, hp0);
      expect([hp0, b.size <= MAX_PIPS, b.left]).toEqual([hp0, true, Math.ceil(hp0 / MAX_PIPS)]);
    }
  });

  it('shows a wave-5 boss losing health where a row of pips showed nothing', () => {
    const m = at(5, 'boss');
    expect(m.hp).toBeGreaterThan(MAX_PIPS);
    // the pips the player had: unchanged for the first hits, all twelve of them steel
    expect(pips(m.hp, 0)).toEqual(pips(m.hp - 1, 0));
    expect(bars(m.hp, m.hp0).fill).toBeGreaterThan(bars(m.hp - 1, m.hp0).fill);
  });

  it('gives every monster of the game a bar that moves on one point of damage', () => {
    for (const kind of Object.keys(B.monsters) as Monster['kind'][]) {
      for (const wave of [1, 5, 10, 20, 30, 40]) {
        const m = at(wave, kind);
        if (m.hp <= MAX_PIPS) continue;
        expect([kind, wave, read(bars(m.hp - 1, m.hp0)) < read(bars(m.hp, m.hp0))]).toEqual([kind, wave, true]);
      }
    }
  });
});

describe('full health in the simulation', () => {
  it('remembers what a monster spawned with', () => {
    for (const wave of [1, 5, 20]) {
      const m = at(wave, 'boss');
      expect([wave, m.hp0]).toEqual([wave, m.hp]);
    }
  });

  it('grows with a glutton, so its bar never reads over full', () => {
    const w: World = startGame(1);
    w.items = [];
    w.queue = [];
    w.mons = [];
    const m = spawn(w, 'glutton');
    m.d = toFp(400);
    m.w = B.crane.w;
    w.mons.push(m);
    const was = m.hp0;
    const it: Item = { id: w.nextId++, kind: 'fish', chest: false, d: m.d, w: m.w, r: B.catch.fishRadius, val: 7, wt: 1, dropped: false, gold: false };
    w.items.push(it);
    for (let t = 0; t < 600 && m.full === 0; t++) step(w);
    expect(m.full).toBe(1);
    expect(m.hp).toBeGreaterThan(was);
    expect(m.hp0).toBe(m.hp);
    expect(bars(m.hp, m.hp0).fill).toBe(1);
  });
});
