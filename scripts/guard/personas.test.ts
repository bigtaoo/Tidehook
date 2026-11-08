// The balance guard: each scripted persona (src/sim/bot) plays the same fixed seeds, and the
// waves they reach must stay where the prototype put them (prototype/tools/sim2.js, 60 games:
// good 17, casual 9, spam 4, good-nofish 12). A change that moves a median out of its band, or
// makes skipping the fishing as good as fishing, fails here and needs a deliberate look.

import { describe, expect, test } from 'vitest';
import { playGame, type GameResult } from '../../src/sim/bot/bot';

const GAMES = 40;

/** Median (and quartiles) of the wave reached over GAMES fixed seeds. */
function play(name: string): { p25: number; p50: number; p75: number; games: GameResult[] } {
  const games = Array.from({ length: GAMES }, (_, i) => playGame(1 + i, name));
  const w = games.map((g) => g.wave).sort((a, b) => a - b);
  const q = (x: number) => w[Math.min(w.length - 1, Math.floor(x * w.length))];
  console.log(`${name.padEnd(14)} waves p25/50/75 ${q(0.25)} ${q(0.5)} ${q(0.75)}`);
  return { p25: q(0.25), p50: q(0.5), p75: q(0.75), games };
}

describe('persona medians', () => {
  const good = play('good');
  const casual = play('casual');
  const spam = play('spam');
  const goodNoFish = play('good-nofish');
  const casualNoFish = play('casual-nofish');

  test('a good player gets deep, a casual one to the middle, a spammer not far', () => {
    expect(good.p50).toBeGreaterThanOrEqual(15);
    expect(good.p50).toBeLessThanOrEqual(20);
    expect(casual.p50).toBeGreaterThanOrEqual(7);
    expect(casual.p50).toBeLessThanOrEqual(11);
    expect(spam.p50).toBeGreaterThanOrEqual(3);
    expect(spam.p50).toBeLessThanOrEqual(5);
  });

  test('fishing pays: skipping it is clearly worse', () => {
    expect(goodNoFish.p50).toBeLessThanOrEqual(good.p50 - 3);
    expect(casualNoFish.p50).toBeLessThan(casual.p50);
  });

  test('nobody runs into the game-time cap', () => {
    for (const g of [...good.games, ...casual.games]) expect(g.over || g.wave > 30).toBe(true);
  });
});
