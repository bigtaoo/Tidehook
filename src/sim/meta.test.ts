import { describe, expect, it } from 'vitest';
import { B } from './balance';
import { applyMeta, metaLevel, metaPrice, metaUpgrade, pearlsFor } from './meta';
import { gameOver } from './monsters';
import { startGame } from './step';
import { newWorld } from './world';

describe("the harbour's upgrades", () => {
  it('a game starts with the levels owned', () => {
    const bare = startGame(4);
    const w = startGame(4, 0, { hull: 2, purse: 1, powder: 2, lodestone: 1, mend: 1, grip: 1 });
    expect(w.maxHp).toBe(bare.maxHp + 4);
    expect(w.hp).toBe(w.maxHp);
    expect(w.coins).toBe(bare.coins + 15);
    expect(w.mines).toBe(bare.mines + 2);
    // an unlock owns the shop card: its ability on, its level counted for the shop's price and max
    expect(w.up.magnet).toBe(bare.up.magnet + 1);
    expect(w.lv.magnet).toBe(1);
    expect(w.mend).toBe(1);
    expect(w.up.grip).toBe(bare.up.grip + 1);
    // the sea is the same: the levels touch no random stream
    expect(w.queue).toEqual(bare.queue);
    expect(w.items.map((it) => [it.d, it.w])).toEqual(bare.items.map((it) => [it.d, it.w]));
  });

  it('starting mines stop at what the dock can hold', () => {
    const w = newWorld(1);
    w.mines = B.mine.max - 1;
    applyMeta(w, { powder: 2 });
    expect(w.mines).toBe(B.mine.max);
  });

  it('reads a bad save as level 0 and caps it at the max', () => {
    const max = metaUpgrade('hull').max;
    expect(metaLevel({ hull: 99 }, 'hull')).toBe(max);
    expect(metaLevel({ hull: -3 }, 'hull')).toBe(0);
    expect(metaLevel({ hull: 1.5 }, 'hull')).toBe(0);
    const w = newWorld(1);
    applyMeta(w, { hull: 99, nonsense: 4 });
    expect(w.maxHp).toBe(B.dock.hp + 2 * max);
  });

  it('prices climb with each level and stop at the max', () => {
    const u = metaUpgrade('purse');
    expect(metaPrice({}, 'purse')).toBe(u.base);
    expect(metaPrice({ purse: 1 }, 'purse')).toBeGreaterThan(u.base);
    expect(metaPrice({ purse: u.max }, 'purse')).toBeNull();
    expect(() => metaPrice({}, 'nope')).toThrow();
  });

  it('a game brings home pearls for each wave it cleared', () => {
    const w = startGame(2);
    expect(pearlsFor(w)).toBe(0);
    w.wave = 14;
    gameOver(w);
    expect(pearlsFor(w)).toBe(13 * B.meta.perWave);
  });
});
