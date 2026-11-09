import { describe, expect, it } from 'vitest';
import { startGame } from '../../sim/step';
import { FIRST_SEED, firstSeedScore } from './firstSeed';

describe('FIRST_SEED', () => {
  it('lays a fish close in across most of the middle of the swing', () => {
    expect(firstSeedScore(FIRST_SEED)).toBeGreaterThanOrEqual(750);
  });

  it('beats a typical seed by a wide margin', () => {
    const scores = Array.from({ length: 40 }, (_, i) => firstSeedScore(100 + i)).sort((a, b) => a - b);
    expect(firstSeedScore(FIRST_SEED)).toBeGreaterThan(scores[20] + 200);
  });

  it('starts on wave 1 like any other game', () => {
    const w = startGame(FIRST_SEED);
    expect(w.wave).toBe(1);
    expect(w.phase).toBe('wave');
  });
});
