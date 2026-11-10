// The novice guard: every player's game opens on a slow tide (src/sim/tide.ts, docs/02-onboarding.md
// section 6) and a beginner is meant to lose it at about the length of the recorded first long
// round (recordings/, some 8 minutes to wave 14), then spend the pearls in the harbour (section 7)
// and go further next time. The novice persona is pinned to the recorded human rounds of a bare
// game (a practised tester: waves 4–7 in 4–7 minutes). A good player's game with the tide must
// still end (noviceGood.test.ts, its own file so it runs alongside).

import { describe, expect, test } from 'vitest';
import { B } from '../../src/sim/balance';
import { minutes } from './minutes';

/** A harbour some five games in: the cheap levels of everything. */
const HARBOUR = { hull: 2, purse: 2, powder: 1, mend: 1 };

describe('novice games', () => {
  const bare = minutes('novice', 0, {}, 'bare');
  const first = minutes('novice', B.tide.waves, {}, 'first');
  const later = minutes('novice', B.tide.waves, HARBOUR, 'harbour');

  test('the novice persona plays like the recorded rounds in a bare game', () => {
    expect(bare.wave).toBeGreaterThanOrEqual(5);
    expect(bare.wave).toBeLessThanOrEqual(7);
  });

  test('a beginner loses the first game at about eight minutes', () => {
    expect(first.p25).toBeGreaterThanOrEqual(5);
    expect(first.p50).toBeGreaterThanOrEqual(6.5);
    expect(first.p50).toBeLessThanOrEqual(11);
  });

  test("the harbour's upgrades carry a game further", () => {
    expect(later.p50).toBeGreaterThan(first.p50 + 1);
    expect(later.wave).toBeGreaterThan(first.wave);
  });
});
