import { describe, expect, it } from 'vitest';
import { liftable } from '../../sim/monsters';
import { startGame } from '../../sim/step';
import type { Monster } from '../../sim/world';
import { pips } from './look';

describe('hit point pips', () => {
  it('marks the ones over the grip as heavy, the last ones first', () => {
    expect(pips(2, 2)).toEqual({ n: 2, heavy: 0 });
    expect(pips(3, 2)).toEqual({ n: 3, heavy: 1 });
    expect(pips(6, 2)).toEqual({ n: 6, heavy: 4 });
    expect(pips(1, 4)).toEqual({ n: 1, heavy: 0 });
    // capped at 12 drawn, all heavy when even the 12 are over the grip
    expect(pips(20, 2)).toEqual({ n: 12, heavy: 12 });
    expect(pips(14, 10)).toEqual({ n: 12, heavy: 4 });
  });

  it('shows no heavy pip exactly when the hook can lift the monster', () => {
    const w = startGame(1);
    for (let grip = 1; grip <= 10; grip++) {
      w.up.grip = grip;
      for (let hp = 1; hp <= 15; hp++) {
        expect(pips(hp, grip).heavy === 0).toBe(liftable(w, { hp } as Monster));
      }
    }
  });
});
