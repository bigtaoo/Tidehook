import { describe, expect, it } from 'vitest';
import { toFp } from './math/fixed';
import { gameOver, spawn } from './monsters';
import { revive, REVIVE_PUSH, REVIVE_STUN } from './revive';
import { reroll, rerollCost } from './shop';
import { startGame } from './step';

describe('revive', () => {
  it('patches a fallen dock to half, pushes the edge back out and dazes everything', () => {
    const w = startGame(3);
    w.mons = [];
    const near = spawn(w, 'grunt');
    near.d = toFp(120);
    const far = spawn(w, 'grunt');
    far.d = toFp(600);
    gameOver(w);
    expect(revive(w)).toBe(true);
    expect([w.phase, w.hp]).toEqual(['wave', Math.ceil(w.maxHp / 2)]);
    expect([near.d, far.d]).toEqual([toFp(REVIVE_PUSH), toFp(600)]);
    expect([near.stun, far.stun]).toEqual([REVIVE_STUN, REVIVE_STUN]);
    expect(w.events.at(-1)).toEqual({ e: 'revive', hp: w.hp });
  });

  it('does nothing while the game is still on', () => {
    const w = startGame(3);
    const hp = w.hp;
    expect(revive(w)).toBe(false);
    expect([w.phase, w.hp]).toEqual(['wave', hp]);
  });
});

describe('free reroll', () => {
  it('deals new cards in the shop without paying or raising the price', () => {
    const w = startGame(5);
    w.phase = 'shop';
    w.coins = 0;
    const cost = rerollCost(w);
    expect(reroll(w)).toBe(false);
    expect(reroll(w, true)).toBe(true);
    expect([w.coins, w.rerolls, rerollCost(w)]).toEqual([0, 0, cost]);
    w.phase = 'wave';
    expect(reroll(w, true)).toBe(false);
  });
});
