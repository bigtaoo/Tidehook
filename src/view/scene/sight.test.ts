import { describe, expect, it } from 'vitest';
import { B } from '../../sim/balance';
import { LANE_LEN, LANE_WIDTH } from '../../sim/lane';
import { FP, toFp } from '../../sim/math/fixed';
import { BRAD_FULL } from '../../sim/math/trig';
import { spawn } from '../../sim/monsters';
import { startGame, step } from '../../sim/step';
import { throwJunk } from '../../sim/throw';
import type { World } from '../../sim/world';
import { laneExit, throwSight } from './sight';

function emptyLane(): World {
  const w = startGame(1);
  w.items = [];
  w.queue = [];
  w.mons = [];
  return w;
}

describe('throw sight', () => {
  it('reaches to the edge of the lane', () => {
    expect(laneExit(0)).toBeCloseTo(LANE_LEN - B.crane.d / FP);
    // 45° to the right: out of the side long before the far end
    expect(laneExit(BRAD_FULL / 8)).toBeCloseTo((LANE_WIDTH - B.crane.w / FP) / Math.SQRT1_2);
    expect(laneExit(-BRAD_FULL / 8)).toBeCloseTo(B.crane.w / FP / Math.SQRT1_2);
  });

  it('marks a monster exactly when a throw now would hit it, and stops where they meet', () => {
    for (let off = 0; off <= 60; off += 4) {
      const w = emptyLane();
      const mon = spawn(w, 'grunt');
      mon.d = toFp(700);
      mon.w = B.crane.w + toFp(off);
      const sight = throwSight(w, 0);
      throwJunk(w, 0);
      const hp = mon.hp;
      let landed = -1;
      for (let i = 0; i < 60 && w.shots.length > 0; i++) {
        const shot = w.shots[0];
        step(w);
        if (mon.hp < hp || !w.mons.includes(mon)) {
          landed = (shot.d - B.crane.d) / FP;
          break;
        }
      }
      expect(sight.m !== null, `offset ${off}`).toBe(landed >= 0);
      // the sight walks the shot's own steps (sim/lead.ts), so they meet the monster within one
      if (sight.m) expect(Math.abs(landed - sight.len)).toBeLessThanOrEqual(B.throw.step / FP + 1);
      if (!sight.m) expect(sight.len).toBeCloseTo(laneExit(0));
    }
  });
});
