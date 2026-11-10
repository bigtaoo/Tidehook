import { describe, expect, it } from 'vitest';
import { B } from './balance';
import { fire, onTarget, updateHook } from './hook';
import { toFp } from './math/fixed';
import { seaIndex } from './seas';
import { startGame } from './step';
import { clarity, drift, fogLine, gust, seen } from './weather';
import type { Item, World } from './world';

const fog = seaIndex('fog');
const storm = seaIndex('storm');

/** A world on `sea` with an empty lane, the hook swinging. */
function calm(sea: number): World {
  const w = startGame(4, 0, {}, sea);
  w.mons = [];
  w.items = [];
  w.phase = 'wave';
  return w;
}

describe('the weather', () => {
  it('hides only what is past the fog line, fading it over the band', () => {
    const bay = calm(0);
    expect(fogLine(bay)).toBe(0);
    expect(seen(bay, toFp(799))).toBe(true);
    const w = calm(fog);
    const line = B.crane.d + fogLine(w);
    expect(seen(w, line)).toBe(true);
    expect(seen(w, line + 1)).toBe(false);
    expect(clarity(w, line)).toBe(1000);
    expect(clarity(w, line + B.weather.fogBand / 2)).toBe(500);
    expect(clarity(w, line + B.weather.fogBand)).toBe(0);
  });

  it('does not slow the swing for a catch in the fog', () => {
    const w = calm(fog);
    const fish = (d: number): Item => ({ id: 1, kind: 'fish', chest: false, d, w: B.crane.w, r: toFp(14), val: 1, wt: 1, dropped: false, gold: false });
    w.items = [fish(B.crane.d + fogLine(w) - toFp(40))];
    expect(onTarget(w, 0)).toBe(true);
    w.items = [fish(B.crane.d + fogLine(w) + toFp(40))];
    expect(onTarget(w, 0)).toBe(false);
  });

  it('blows only in the storm, one way then the other over a gust', () => {
    const bay = calm(0);
    bay.tick = B.weather.gustTicks / 4;
    expect(gust(bay)).toBe(0);
    expect(drift(bay, toFp(100))).toBe(0);
    const w = calm(storm);
    w.tick = B.weather.gustTicks / 4;
    expect(gust(w)).toBe(B.seas[storm].wind);
    w.tick = (B.weather.gustTicks * 3) / 4;
    expect(gust(w)).toBe(-B.seas[storm].wind);
    w.tick = 0;
    expect(gust(w)).toBe(0);
  });

  it("bends a storm's cast with the gust and leaves the bay's straight", () => {
    const bent = (sea: number) => {
      const w = calm(sea);
      w.tick = B.weather.gustTicks / 4;
      expect(fire(w)).toBe(true);
      const ang = w.hook.ang;
      for (let i = 0; i < 10 && w.hook.st === 'out'; i++) updateHook(w);
      return w.hook.ang - ang;
    };
    expect(bent(0)).toBe(0);
    expect(bent(storm)).toBeGreaterThan(0);
  });
});
