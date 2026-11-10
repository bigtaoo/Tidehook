// How long the harbour's content lasts a new player (docs/04-content.md section 1): the novice
// persona's career, game after game, until everything is bought; then, with all of it bought,
// every sea is still playable (the career stops at the last chart, so it never sails the last sea).

import { expect, test } from 'vitest';
import { B } from '../../src/sim/balance';
import { playGame } from '../../src/sim/bot/bot';
import { career, formatCareer } from '../career/career';

/** The median wave a fully bought-up novice reaches on any sea, at the least. */
const SEA_FLOOR = 7;
const SEEDS = 9;

test('the content lasts a new player three hours, and no sea is a wall', () => {
  const c = career('novice');
  console.log(formatCareer('novice', c).join('\n'));
  expect(c.done ?? Infinity).toBeGreaterThanOrEqual(180);
  B.seas.forEach((s, sea) => {
    const waves = Array.from({ length: SEEDS }, (_, k) => playGame(7000 + k, 'novice', 1000, 3600, B.tide.waves, c.lv, sea).wave).sort((a, b) => a - b);
    console.log(`novice, everything bought, on ${s.id}: waves ${waves.join(',')}`);
    expect(waves[SEEDS >> 1], s.id).toBeGreaterThanOrEqual(SEA_FLOOR);
  });
});
