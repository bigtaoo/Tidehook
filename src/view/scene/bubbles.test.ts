// The sea's bubbles (bubbles.ts): decoration only, so what is tested is that they stay out of the
// way - on the water, never on the dock, faint, and still while the game is held.

import { describe, expect, it } from 'vitest';
import type { Graphics } from 'pixi.js';
import { B } from '../../sim/balance';
import { LANE_LEN, LANE_WIDTH } from '../../sim/lane';
import { FP } from '../../sim/math/fixed';
import { fieldFor, toLane } from '../orient';
import { Bubbles } from './bubbles';

const DOCK = B.dock.edge / FP;

/** Every bubble's place back in lane units, and how bright it is drawn. */
function spots(b: Bubbles, f = fieldFor(false)) {
  return (b.children as Graphics[]).map((g) => ({ ...toLane(f, g.x, g.y), alpha: g.alpha, r: g.scale.x }));
}

describe('Bubbles', () => {
  for (const wide of [false, true]) {
    it(`keeps them on the open water, never on the dock (${wide ? 'landscape' : 'portrait'})`, () => {
      const f = fieldFor(wide);
      const b = new Bubbles(f);
      for (let frame = 0; frame < 400; frame++) {
        b.update(1000 / 60);
        for (const s of spots(b, f)) {
          expect(s.d).toBeGreaterThan(DOCK);
          expect(s.d).toBeLessThan(LANE_LEN);
          expect(s.w).toBeGreaterThanOrEqual(0);
          expect(s.w).toBeLessThanOrEqual(LANE_WIDTH);
          expect(s.alpha).toBeLessThanOrEqual(0.3);
        }
      }
    });
  }

  it('makes its graphics once and keeps them, however long the sea runs', () => {
    const b = new Bubbles(fieldFor(false));
    const n = b.children.length;
    expect(n).toBeGreaterThan(0);
    for (let frame = 0; frame < 2000; frame++) b.update(1000 / 60);
    expect(b.children).toHaveLength(n);
  });

  it('holds still while the game is held', () => {
    const b = new Bubbles(fieldFor(false));
    b.update(1000 / 60);
    const before = JSON.stringify(spots(b));
    for (let frame = 0; frame < 30; frame++) b.update(0);
    expect(JSON.stringify(spots(b))).toBe(before);
  });

  it('swells and fades over a life instead of blinking in', () => {
    const b = new Bubbles(fieldFor(false), 1);
    b.update(0);
    const seen: { alpha: number; r: number }[] = [];
    for (let frame = 0; frame < 300; frame++) {
      b.update(1000 / 60);
      seen.push(spots(b)[0]);
    }
    // somewhere in there it is at its brightest, and it is dimmer at both ends of a life
    const top = Math.max(...seen.map((s) => s.alpha));
    expect(top).toBeGreaterThan(0.1);
    expect(Math.min(...seen.map((s) => s.alpha))).toBeLessThan(top / 2);
    expect(Math.max(...seen.map((s) => s.r))).toBeGreaterThan(Math.min(...seen.map((s) => s.r)));
  });
});
