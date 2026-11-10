// Game feel (docs/04-content.md section 3.10): the big moments land. A boss or kraken sunk stops
// the sea for a beat and runs it slow for a moment after; a brute sunk, or a long streak, a
// shorter beat. Blasts, booms and leaks shake the sea (never the HUD or the shop). Only the view's
// clock is touched: the sim still steps whole ticks, so a game plays out the same. Calm motion
// (game/settings.ts) turns all of it off.

import type { SimEvent } from '../../sim/events';
import type { Container } from 'pixi.js';

/** A stop: `freeze` ms of nothing, then `slow` ms at `rate` of the clock. */
interface Stop {
  freeze: number;
  slow: number;
  rate: number;
}

const BOSS: Stop = { freeze: 110, slow: 450, rate: 0.35 };
const BRUTE: Stop = { freeze: 55, slow: 0, rate: 1 };
const STREAK: Stop = { freeze: 40, slow: 0, rate: 1 };
/** The streak that earns a beat, and every one past it. */
const STREAK_FROM = 4;
/** Shake strength in design pixels per event; it fades by half every HALF_MS. */
const SHAKE: Partial<Record<SimEvent['e'], number>> = { mine: 10, blast: 8, boom: 12, burst: 6, leak: 7 };
const BOSS_SHAKE = 18;
const HALF_MS = 70;
const MAX_SHAKE = 22;

export class Feel {
  private freeze = 0;
  private slow = 0;
  private rate = 1;
  private shake = 0;
  private t = 0;
  /** Calm motion: no stops, no shake. */
  calm = false;

  /** Takes in a frame's events. */
  observe(events: readonly SimEvent[]): void {
    if (this.calm) return;
    for (const ev of events) {
      if (ev.e === 'kill' && (ev.kind === 'boss' || ev.kind === 'kraken')) {
        this.stop(BOSS);
        this.kick(BOSS_SHAKE);
      } else if (ev.e === 'kill' && ev.kind === 'brute') this.stop(BRUTE);
      else if (ev.e === 'combo' && ev.n >= STREAK_FROM) this.stop(STREAK);
      const s = SHAKE[ev.e];
      if (s) this.kick(s);
    }
  }

  /** The ms of `frameMs` the sim gets to run: none while frozen, a share while slow. */
  clock(frameMs: number): number {
    if (this.freeze > 0) {
      this.freeze -= frameMs;
      if (this.freeze >= 0) return 0;
      frameMs = -this.freeze;
      this.freeze = 0;
    }
    if (this.slow > 0) {
      this.slow -= frameMs;
      return frameMs * this.rate;
    }
    return frameMs;
  }

  /** Moves `sea` by this frame's shake, back to `x`, `y` once it has died down. */
  apply(sea: Container, x: number, y: number, frameMs: number): void {
    this.t += frameMs;
    this.shake *= Math.pow(0.5, frameMs / HALF_MS);
    if (this.shake < 0.5) this.shake = 0;
    const a = this.shake;
    sea.position.set(x + a * Math.sin(this.t * 0.091), y + a * Math.cos(this.t * 0.077));
  }

  /** Forgets every stop and shake (a new game, the lobby). */
  reset(): void {
    this.freeze = this.slow = this.shake = 0;
    this.rate = 1;
  }

  private stop(s: Stop): void {
    this.freeze = Math.max(this.freeze, s.freeze);
    if (s.slow > 0) {
      this.slow = Math.max(this.slow, s.slow);
      this.rate = s.rate;
    }
  }

  private kick(n: number): void {
    this.shake = Math.min(MAX_SHAKE, this.shake + n);
  }
}
