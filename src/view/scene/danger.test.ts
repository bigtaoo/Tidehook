import { describe, expect, it } from 'vitest';
import { B } from '../../sim/balance';
import { spawn } from '../../sim/monsters';
import { startGame } from '../../sim/step';
import { DANGER_TICKS, dockEta, inDanger, lowDock } from './danger';

describe('the dock warning', () => {
  it('a monster far out is not due; one at the crane is', () => {
    const w = startGame(3);
    spawn(w, 'grunt');
    const m = w.mons[w.mons.length - 1];
    expect(inDanger(m)).toBe(false);
    m.d = B.crane.d + B.crane.reach + m.r + m.speed * (DANGER_TICKS - 5);
    m.w = B.crane.w;
    expect(dockEta(m)).toBeLessThan(DANGER_TICKS);
    expect(inDanger(m)).toBe(true);
    m.stun = 10;
    expect(inDanger(m)).toBe(false);
  });

  it('the dock warns at 30% and under, not when fallen', () => {
    const w = startGame(3);
    w.maxHp = 10;
    w.hp = 4;
    expect(lowDock(w)).toBe(false);
    w.hp = 3;
    expect(lowDock(w)).toBe(true);
    w.hp = 0;
    expect(lowDock(w)).toBe(false);
  });
});
