// The first game's seed for a new player (Potion Siege's lesson, docs/02-onboarding.md section 3):
// one chosen so a fish lies across the middle of the swing, close in, so the first cast lands
// within a swing or two. firstSeed.test.ts holds the pick to that.

import { rayFirst } from '../../sim/ray';
import { startGame } from '../../sim/step';
import { toFp } from '../../sim/math/fixed';

export const FIRST_SEED = 5;

/** A fish the first cast should reach no further out than this, FP. */
export const FIRST_FISH_LEN = toFp(360);
/** Aims sampled across the middle half of the swing. */
const SAMPLES = 41;

/** How much of the middle half of the swing aims at a fish (not junk) close in, permille. */
export function firstSeedScore(seed: number): number {
  const w = startGame(seed);
  const half = Math.trunc(w.up.swing / 2);
  let hits = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const ang = -half + Math.trunc((2 * half * i) / (SAMPLES - 1));
    const r = rayFirst(w, ang, false);
    if (r && r.o.t === 'item' && r.o.item.kind === 'fish' && r.len <= FIRST_FISH_LEN) hits++;
  }
  return Math.trunc((hits * 1000) / SAMPLES);
}
