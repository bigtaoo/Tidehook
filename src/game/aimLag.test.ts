import { describe, expect, it } from 'vitest';
import { B } from '../sim/balance';
import { muldiv } from '../sim/math/fixed';
import { cosB, normBrad, sinB } from '../sim/math/trig';
import { eventAge } from './input';
import { Session } from './session';

const FRAME = 1000 / 60;

/** A game in its first wave with the hook swinging, partway through a tick. */
function swinging(lagMs?: number): Session {
  const s = new Session({ seed: 3, speed: 1, autoplay: null, lagMs });
  s.tap();
  for (let t = 0; t < 700; t += FRAME) s.update(FRAME);
  s.update(FRAME / 2);
  expect(s.world.hook.st).toBe('swing');
  return s;
}

/** The aim `back` brads of swing phase ago. */
function angBack(s: Session, back: number): number {
  return muldiv(s.world.up.swing, sinB(normBrad(s.world.hook.ph - back)), 1000);
}

describe('a tap aims where the player saw the hook', () => {
  it('casts along the aim as drawn, the lag before it', () => {
    const s = swinging(50);
    // the part of a tick the view is behind, the lag and the 10 ms the event waited
    const want = angBack(s, Math.round((1 - s.alpha + ((50 + 10) * 30) / 1000) * B.hook.swingRate));
    expect(want).not.toBe(s.world.hook.ang);
    s.tap(10);
    expect(s.world.hook.st).toBe('out');
    expect(s.world.hook.ang).toBe(want);
    // the rope starts on the cast's angle
    expect(s.prevHook.ang).toBe(s.world.hook.ang);
  });

  it('looks back at most five ticks', () => {
    const s = swinging(150);
    const want = angBack(s, B.hook.swingRate * 5);
    s.tap(100);
    expect(s.world.hook.ang).toBe(want);
  });

  it('throws junk along the same aim, and the swing goes on unbroken', () => {
    const s = swinging(50);
    const junk = s.world.items.find((it) => it.kind === 'junk');
    expect(junk).toBeDefined();
    s.world.held = junk!;
    const { ph, ang } = s.world.hook;
    const want = angBack(s, Math.round((1 - s.alpha + 1.5) * B.hook.swingRate));
    s.tap();
    expect(s.world.shots[0].ud).toBe(cosB(want));
    expect(s.world.hook.ph).toBe(ph);
    expect(s.world.hook.ang).toBe(ang);
  });

  it('casts along the sim aim when no lag is set (tests, bots)', () => {
    const s = swinging();
    const ang = s.world.hook.ang;
    s.tap();
    expect(s.world.hook.ang).toBe(ang);
  });

  it('caps an event age', () => {
    expect(eventAge(90, 100)).toBe(10);
    expect(eventAge(200, 100)).toBe(0);
    expect(eventAge(0, 1000)).toBe(100);
  });
});
