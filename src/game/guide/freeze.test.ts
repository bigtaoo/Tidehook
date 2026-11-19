// The first cast's freeze (Guide.freeze, Session.frozen): the lane stands still on a fish until the
// player taps, that tap catches it, and a player who only watches is let go when the hold ends.

import { describe, expect, it } from 'vitest';
import { SafeStore } from '../../platform/types';
import { Session } from '../session';
import { FIRST_SEED } from './firstSeed';
import { aimFinds, Guide, HOLD_MS } from './guide';

const FRAME = 1000 / 60;

function fresh(daily = false): { s: Session; guide: Guide } {
  const guide = new Guide(new SafeStore(null));
  const s = new Session({ seed: 1, speed: 1, autoplay: null, firstSeed: FIRST_SEED }, guide);
  s.start();
  if (daily) guide.begin(false);
  return { s, guide };
}

/** Frames until the freeze comes on, or -1 within `capMs`. */
function untilFrozen(s: Session, capMs = 10_000): number {
  for (let ms = 0; ms < capMs; ms += FRAME) {
    s.update(FRAME);
    if (s.frozen) return ms;
  }
  return -1;
}

describe('the first cast freeze', () => {
  it('stops the lane on a fish within a few seconds', () => {
    const { s } = fresh();
    const at = untilFrozen(s);
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(5000);
    const tick = s.world.tick;
    for (let i = 0; i < 120; i++) s.update(FRAME);
    expect(s.world.tick).toBe(tick);
    expect(aimFinds(s.world, 'fish')).toBe(true);
  });

  it('lets the tap catch the fish, then plays on', () => {
    const { s, guide } = fresh();
    untilFrozen(s);
    s.tap();
    expect(s.frozen).toBe(false);
    for (let ms = 0; ms < 8000 && !guide.done.has('cast'); ms += FRAME) s.update(FRAME);
    expect(guide.done.has('cast')).toBe(true);
    const tick = s.world.tick;
    for (let i = 0; i < 60; i++) s.update(FRAME);
    expect(s.world.tick).toBeGreaterThan(tick);
    expect(s.frozen).toBe(false);
  });

  it('lets a player who only watches go when the hold ends', () => {
    const { s } = fresh();
    untilFrozen(s);
    for (let ms = 0; ms < HOLD_MS + 1000; ms += FRAME) s.update(FRAME);
    expect(s.frozen).toBe(false);
  });

  it('never freezes the daily voyage', () => {
    const { s } = fresh(true);
    expect(untilFrozen(s)).toBe(-1);
  });
});
