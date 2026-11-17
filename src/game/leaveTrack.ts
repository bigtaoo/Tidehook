// Where a sitting stops. The host counts sessions and playtime, so the game does not; what it can
// see and the host cannot is the shape of the stop (docs/01-tech-plan.md section 8):
// - `first_tap`, once: how long the player looked at the game before touching it, and from where.
//   A game that is never tapped is the clearest drop-off there is, and nothing else reports it;
// - `idle`, at most IDLE_CAP times: a long quiet stretch with the game live and the tab in front —
//   a player who is stuck or reading, not one who walked away (a hidden tab is paused and is not
//   counted);
// - `quit`, once, as the page goes: the place the player left from, the wave, the game number and
//   how long they had been quiet. It goes out in the capture phase, before the host's own handlers
//   flush their queue on the way out. A page hidden under an ad the game itself asked for is not a
//   player leaving (game/ads.ts holds the session while one plays), and since `quit` goes once a
//   sitting, counting that would spend it on the ad and leave the real stop unreported.
// Every field is bounded: the places are the words in PLACES, and the numbers are capped.

import type { Platform, TrackData } from '../platform/types';
import type { Session } from './session';

/** Quiet this long, with the game live and in front, is an `idle`. */
export const IDLE_MS = 25_000;
/** At most this many `idle` events a sitting: a stuck player is worth a few, not a stream. */
export const IDLE_CAP = 3;
/** Seconds and waves are sent as is up to here. */
const SECONDS_CAP = 7200;
const WAVE_CAP = 99;

/** Where in the game the player was, as a fixed word. */
export const PLACES = ['boot', 'ad', 'paused', 'play', 'shop', 'over', 'lobby', 'title'] as const;
export type Place = (typeof PLACES)[number];

type Win = Pick<Window, 'addEventListener'>;
type Doc = Pick<Document, 'addEventListener' | 'visibilityState'>;

/** A page with no window or document at all (the sim's tests): nothing is heard, nothing is sent. */
const NO_WIN: Win = { addEventListener() {} };
const NO_DOC: Doc = { addEventListener() {}, visibilityState: 'visible' };
const page = globalThis as { window?: Win; document?: Doc };

export class LeaveTrack {
  private lastTap: number;
  private taps = 0;
  private idles = 0;
  private quietMs = 0;
  private gone = false;
  private ready = false;

  constructor(
    private readonly platform: Platform,
    private readonly session: Session,
    private readonly t0: number,
    win: Win = page.window ?? NO_WIN,
    doc: Doc = page.document ?? NO_DOC,
  ) {
    this.lastTap = t0;
    // capture, and on both events: a page may be frozen straight out of hidden, with no pagehide
    win.addEventListener('pointerdown', () => this.tapped(), { capture: true, passive: true });
    win.addEventListener('keydown', () => this.tapped(), { capture: true, passive: true });
    win.addEventListener('pagehide', () => this.quit(), true);
    doc.addEventListener('visibilitychange', () => doc.visibilityState === 'hidden' && !session.hold && this.quit(), true);
  }

  /** The game is up and the player can play: the clock for `first_tap` starts here. */
  started(): void {
    this.ready = true;
  }

  /** One frame of `ms`, with whether the game was in live, visible play. */
  frame(ms: number, active: boolean): void {
    if (!active) {
      this.quietMs = 0;
      return;
    }
    this.quietMs += ms;
    if (this.quietMs < IDLE_MS || this.idles >= IDLE_CAP) return;
    this.idles++;
    this.quietMs = 0;
    this.platform.track('idle', { ...this.where(), seconds: Math.round(IDLE_MS / 1000) });
  }

  private tapped(): void {
    this.quietMs = 0;
    this.lastTap = Date.now();
    // a tap on the loading page is not a tap on the game
    if (!this.ready || this.taps++ > 0) return;
    this.platform.track('first_tap', { ...this.where(), seconds: this.since(this.t0) });
  }

  private quit(): void {
    if (this.gone) return;
    this.gone = true;
    this.platform.track('quit', {
      ...this.where(),
      seconds: this.since(this.t0),
      quiet: this.since(this.lastTap),
      tapped: this.taps > 0,
    });
  }

  /** Where the player is and how far they had got, as every event here carries it. */
  private where(): TrackData {
    const s = this.session;
    return {
      at: this.place(),
      wave: Math.min(WAVE_CAP, s.world.wave),
      game: Math.min(WAVE_CAP, Math.max(0, s.guide?.games ?? s.games)),
      mode: s.daily ? 'daily' : 'voyage',
    };
  }

  private place(): Place {
    const s = this.session;
    if (!this.ready) return 'boot';
    if (s.hold) return 'ad';
    if (s.mode === 'play') return s.paused ? 'paused' : s.shopping() ? 'shop' : 'play';
    return s.mode;
  }

  private since(from: number): number {
    return Math.min(SECONDS_CAP, Math.max(0, Math.round((Date.now() - from) / 1000)));
  }
}
