import { describe, expect, it } from 'vitest';
import { B } from './balance';
import { addCounts, bestCounts, counts, goalValue, newlyMet } from './goals';
import { newWorld } from './world';

describe("the captain's log", () => {
  it('has unique ids and goals that rise along each chain', () => {
    expect(new Set(B.goals.map((g) => g.id)).size).toBe(B.goals.length);
    const last = new Map<string, number>();
    for (const g of B.goals) {
      const chain = `${g.kind}.${g.stat}`;
      expect(g.n).toBeGreaterThan(last.get(chain) ?? 0);
      expect(g.pearls).toBeGreaterThan(0);
      last.set(chain, g.n);
    }
  });

  it("asks only for what a game counts", () => {
    const c = counts(newWorld(1));
    const seas = B.seas.map((s) => s.id);
    for (const g of B.goals) expect(g.stat in c || seas.includes(g.stat) || seas.some((s) => g.stat === `${s}Voyage`)).toBe(true);
  });

  it('keeps bests and totals apart', () => {
    const a = { wave: 6, kills: 40, games: 1 };
    const b = { wave: 4, kills: 30, games: 1 };
    const best = bestCounts(bestCounts({}, a), b);
    const totals = addCounts(addCounts({}, a), b);
    expect(best).toEqual({ wave: 6, kills: 40, games: 1 });
    expect(totals).toEqual({ wave: 10, kills: 70, games: 2 });
    const wave8 = B.goals.find((g) => g.id === 'game.wave.8')!;
    expect(goalValue(wave8, best, totals)).toBe(6);
    expect(newlyMet([], best, totals).map((g) => g.id)).toEqual(['game.wave.5']);
    expect(newlyMet(['game.wave.5'], best, totals)).toEqual([]);
  });
});
