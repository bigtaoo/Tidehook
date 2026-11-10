import { describe, expect, it } from 'vitest';
import { B } from './balance';
import { updateHook } from './hook';
import { muldiv, toFp } from './math/fixed';
import { BRAD_FULL, normBrad, sinB } from './math/trig';
import { rayFirst } from './ray';
import { spawn } from './monsters';
import { startGame } from './step';
import type { World } from './world';

/** A grunt straight out from the crane, `d` world units down the lane. */
function ahead(w: World, d: number): void {
  const m = spawn(w, 'grunt');
  m.d = toFp(d);
  m.w = B.crane.w;
}

/** A lane with only the crane, aiming straight out, junk in hand or not. */
function lane(held: boolean): World {
  const w = startGame(1);
  w.queue = [];
  w.mons = [];
  const junk = w.items.find((it) => it.kind === 'junk') ?? null;
  w.items = [];
  w.held = held ? junk : null;
  w.hook.ph = 0;
  w.hook.ang = 0;
  return w;
}

describe('the swing slows while a tap would land', () => {
  const slow = muldiv(B.hook.swingRate, B.throw.aimSlow, 1000);

  it('slows with junk in hand and a monster under the aim', () => {
    const w = lane(true);
    ahead(w, 600);
    updateHook(w);
    expect(w.hook.rate).toBe(slow);
    expect(w.hook.ph).toBe(slow);
    expect(w.hook.rate).toBeLessThan(B.hook.swingRate);
  });

  it('slows a little for a cast on a fish, not on a monster', () => {
    const w = lane(false);
    const fish = startGame(1).items.find((it) => it.kind === 'fish');
    if (!fish) throw new Error('no fish to place');
    fish.d = toFp(400);
    fish.w = B.crane.w;
    w.items = [fish];
    updateHook(w);
    expect(w.hook.rate).toBe(muldiv(B.hook.swingRate, B.hook.aimSlow, 1000));
    expect(B.hook.aimSlow).toBeGreaterThan(B.throw.aimSlow);
    const mon = lane(false);
    ahead(mon, 600);
    updateHook(mon);
    expect(mon.hook.rate).toBe(B.hook.swingRate);
  });

  it('keeps full speed with nothing to hit', () => {
    const clear = lane(true);
    updateHook(clear);
    expect(clear.hook.rate).toBe(B.hook.swingRate);
  });

  it('gives a far monster several times as long under the aim', () => {
    /** Ticks the aim sits on a grunt 700 out on its first pass over it, slowed or not. */
    const pass = (slowed: boolean) => {
      const w = lane(true);
      ahead(w, 700);
      // from the far left of the swing, across the middle
      w.hook.ph = (BRAD_FULL * 3) / 4;
      let n = 0;
      for (let i = 0; i < 400; i++) {
        if (slowed) updateHook(w);
        else {
          w.hook.ph = normBrad(w.hook.ph + B.hook.swingRate);
          w.hook.ang = muldiv(w.up.swing, sinB(w.hook.ph), 1000);
        }
        if (rayFirst(w, w.hook.ang, true, B.throw.radius)?.o.t === 'mon') n++;
        else if (n > 0) break;
      }
      return n;
    };
    expect(pass(true)).toBeGreaterThanOrEqual(3 * pass(false));
  });
});
