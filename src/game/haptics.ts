// The phone's buzz (navigator.vibrate where there is one): a tick for a catch landed, a pulse for
// a long streak, a heavier one for a boss sunk, and a double knock when a monster gets through to
// the dock. Only listens to the sim's events, like the sound; off with the setting (game/settings.ts),
// and never more often than MIN_GAP_MS but for the big ones.

import type { SimEvent } from '../sim/events';

export type Buzz = (pattern: number | number[]) => void;

/** The patterns, ms (on, off, on...). */
const CATCH = 12;
const STREAK = 25;
const BOSS = [60, 40, 90];
const LEAK = [35, 50, 35];
/** The streak that buzzes, and every one past it. */
const STREAK_FROM = 3;
/** Small buzzes closer than this are dropped, ms. */
const MIN_GAP_MS = 120;

/** The gestures that let a page buzz, the same ones that unlock the sound (audio/engine.ts). */
const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;

/** The buzz the browser offers, or null (a desktop, an iPhone's Safari).
 *
 *  Stays quiet until the player has touched the page once: the tutorial's first game starts on its
 *  own (docs/02-onboarding.md), so a monster can reach the dock before anyone has tapped, and a
 *  phone that buzzed then would be buzzing at nothing the player did — Chrome blocks the call and
 *  logs an error besides. */
export function webBuzz(nav: Navigator | undefined, win: Pick<Window, 'addEventListener' | 'removeEventListener'>): Buzz | null {
  if (!nav || typeof nav.vibrate !== 'function') return null;
  let touched = false;
  const go = () => {
    touched = true;
    for (const e of GESTURES) win.removeEventListener(e, go, true);
  };
  for (const e of GESTURES) win.addEventListener(e, go, true);
  return (p) => {
    if (!touched) return;
    try {
      nav.vibrate(p);
    } catch {
      /* a host frame without the permission */
    }
  };
}

export class Haptics {
  private last = -Infinity;

  constructor(
    private readonly buzz: Buzz | null,
    private readonly enabled: () => boolean,
  ) {}

  /** Whether this device can buzz at all (the setting is shown only then). */
  get able(): boolean {
    return this.buzz !== null;
  }

  /** Buzzes for a frame's events; `now` in ms. Returns the pattern played, or null. */
  events(evs: readonly SimEvent[], now: number): number | number[] | null {
    if (!this.buzz || !this.enabled()) return null;
    let big: number[] | null = null;
    let small: number | null = null;
    for (const ev of evs) {
      if (ev.e === 'kill' && (ev.kind === 'boss' || ev.kind === 'kraken')) big = BOSS;
      else if (ev.e === 'leak') big = big ?? LEAK;
      else if (ev.e === 'combo' && ev.n >= STREAK_FROM) small = STREAK;
      else if (ev.e === 'coins' && !ev.spat) small = small ?? CATCH;
    }
    const p = big ?? (small !== null && now - this.last >= MIN_GAP_MS ? small : null);
    if (p === null) return null;
    this.last = now;
    this.buzz(p);
    return p;
  }
}
