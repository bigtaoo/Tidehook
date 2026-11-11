// A new player, played headless (Potion Siege's `npm run onboard`): it taps only when the aim line
// glows for the tutorial's step, does what the shop's hand points at, and otherwise plays like a
// beginner who has learnt the lesson (taps when the aim finds a monster, or a fish when the lane is
// empty). Its timing is sloppy: of each glow it catches half, taps late on some and lets the rest
// pass, so the steps must hold up through misses. The tutorial passes when that player meets every
// step, does not lose the first minute, is never left without a hint for long while a step waits,
// and can act within three seconds.

import { describe, expect, it } from 'vitest';
import { SafeStore } from '../../platform/types';
import { Session } from '../session';
import { FIRST_SEED } from './firstSeed';
import { aimFinds, FIRST_MS, Guide, HOLD_MS, STEP_IDS, type Want } from './guide';

const FRAME = 1000 / 60;
/** A beginner's reaction to the shop's hand, ms. */
const REACT_MS = 400;
/** How late a fumbled tap comes after the glow starts, ms: past a crab's window. */
const LATE_MS = 200;
/** Of each glow: this share is tapped on time, this share late, the rest let pass. */
const ON_TIME = 0.5;
const LATE = 0.3;

/** A small seeded generator, 0 to 1, so the runs repeat. */
function lcg(seed: number): () => number {
  let x = seed * 2654435761;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

/** Game time the run may take to meet every step. */
const CAP_MS = 8 * 60_000;
/** How long the player who only watches is watched for. */
const WATCH_MS = 120_000;

interface Run {
  guide: Guide;
  /** When the player first could act on a cue: its first tap or the first hand, ms. */
  firstActMs: number;
  longestGapMs: number;
  overMs: number;
  doneMs: number;
}

function play(seed: number): Run {
  const guide = new Guide(new SafeStore(null));
  const s = new Session({ seed, speed: 1, autoplay: null, firstSeed: FIRST_SEED }, guide);
  s.start();
  let ms = 0;
  let firstActMs = -1;
  let gap = 0;
  let longestGapMs = 0;
  let seen = 0;
  const rnd = lcg(seed);
  let glowing = false;
  let tapAt = -1;
  let overMs = -1;
  let doneMs = -1;
  while (ms < CAP_MS) {
    s.update(FRAME);
    ms += FRAME;
    if (s.mode === 'over') {
      overMs = ms;
      break;
    }
    const w = s.world;
    const cue = guide.cue;
    if (cue?.hand && firstActMs < 0) firstActMs = ms;
    // a lane step is waiting and the hook could act, but nothing points the way
    const waiting = cue && cue.target?.t !== 'shop' && w.phase === 'wave' && w.hook.st === 'swing';
    gap = waiting && !cue.hand ? gap + FRAME : 0;
    longestGapMs = Math.max(longestGapMs, gap);
    if (guide.finished) {
      doneMs = ms;
      break;
    }
    if (w.phase === 'shop') {
      if (!cue?.hand || cue.target?.t !== 'shop') continue;
      if ((seen += FRAME) < REACT_MS) continue;
      seen = 0;
      const p = cue.target.pick;
      if (p.t === 'card') s.buy(p.i);
      else if (p.t === 'repair') s.repair();
      else s.nextWave();
      continue;
    }
    if (w.hook.st !== 'swing') {
      glowing = false;
      tapAt = -1;
      continue;
    }
    const want: Want = cue?.want ?? (w.held || w.mons.length ? 'mon' : 'fish');
    const glow = aimFinds(w, want);
    if (glow && !glowing) {
      const r = rnd();
      tapAt = r < ON_TIME ? ms : r < ON_TIME + LATE ? ms + LATE_MS : -1;
    }
    glowing = glow;
    if (tapAt >= 0 && ms >= tapAt) {
      tapAt = -1;
      if (firstActMs < 0) firstActMs = ms;
      s.tap();
    }
  }
  return { guide, firstActMs, longestGapMs, overMs, doneMs };
}

describe('onboarding, played by a new player on the first seed', () => {
  const runs = [1, 2, 3].map(play);

  it('meets every step', () => {
    for (const r of runs) expect(STEP_IDS.filter((x) => !r.guide.done.has(x))).toEqual([]);
  });

  it('does not lose the first minute', () => {
    for (const r of runs) expect(r.overMs < 0 || r.overMs > 60_000).toBe(true);
  });

  it('lets the player act within three seconds', () => {
    for (const r of runs) {
      expect(r.firstActMs).toBeGreaterThan(0);
      expect(r.firstActMs).toBeLessThanOrEqual(3000);
    }
  });

  it('points the way within three seconds for a player who just watches', () => {
    const guide = new Guide(new SafeStore(null));
    const s = new Session({ seed: 1, speed: 1, autoplay: null, firstSeed: FIRST_SEED }, guide);
    s.start();
    let ms = 0;
    while (ms < 3000 && !guide.cue?.hand) {
      s.update(FRAME);
      ms += FRAME;
    }
    expect(guide.cue?.hand).toBe(true);
    expect(guide.cue?.step).toBe('cast');
  });

  it('never leaves a waiting step without a hint for more than 3.5 s', () => {
    for (const r of runs) expect(r.longestGapMs).toBeLessThanOrEqual(3500);
  });

  // the one metric the portals measure is "played a full minute / visits", so the player who only
  // watches the first game must still be alive at the end of it, with something to look at
  it('never loses, and always points somewhere, for a player who only watches', () => {
    for (const seed of [1, 2, 3]) {
      const guide = new Guide(new SafeStore(null));
      const s = new Session({ seed, speed: 1, autoplay: null, firstSeed: FIRST_SEED }, guide);
      s.start();
      let ms = 0;
      let gap = 0;
      let handGap = 0;
      let worstHand = 0;
      while (ms < WATCH_MS && s.mode !== 'over') {
        s.update(FRAME);
        ms += FRAME;
        gap = guide.cue ? 0 : gap + FRAME;
        handGap = guide.cue?.hand ? 0 : handGap + FRAME;
        worstHand = Math.max(worstHand, handGap);
        expect(gap).toBe(0);
      }
      expect([s.mode === 'over', Math.round(ms)]).toEqual([false, Math.round(WATCH_MS)]);
      // only the 0.6 s before the first hand of all; the hold (and then the shop) keeps the rest
      expect(worstHand).toBeLessThan(FIRST_MS + 2 * FRAME);
    }
  });

  // the watcher above parks in the shop, where the sea cannot reach them. This one presses the
  // button the hand points at and so really sails, without ever casting: the hold is all that
  // stands between them and the first wave.
  it('keeps the dock whole for half a minute for a player who only presses the button', () => {
    for (const seed of [1, 2, 3]) {
      const guide = new Guide(new SafeStore(null));
      const s = new Session({ seed, speed: 1, autoplay: null, firstSeed: FIRST_SEED }, guide);
      s.start();
      let ms = 0;
      let firstHitMs = -1;
      while (ms < 60_000 && s.mode !== 'over') {
        s.update(FRAME);
        ms += FRAME;
        if (firstHitMs < 0 && s.world.hp < s.world.maxHp) firstHitMs = ms;
        if (s.world.phase === 'shop') s.nextWave();
      }
      // still afloat at the minute the portals count, and nothing touched the dock while the
      // first step's hold was on (HOLD_MS); without it the first hit lands at 24 s
      expect(s.mode).not.toBe('over');
      expect(firstHitMs).toBeGreaterThan(HOLD_MS);
    }
  });

  it('logs when each step showed and was done', () => {
    const log = runs[0].guide.log;
    expect(log.map((l) => l.step).sort()).toEqual([...STEP_IDS].sort());
    for (const l of log) expect(l.doneS).toBeGreaterThanOrEqual(l.shownS);
  });
});
