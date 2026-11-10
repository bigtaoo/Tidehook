// What the game tells the host about a sitting (Playgama's telemetry guide, v1.1.2), all through
// Platform.track: each wave as a progression step (started, completed, failed when the dock
// falls), the tutorial's steps, each harbour purchase, and a performance sample every 30 s of
// active play. Nothing about the player, and no session id of our own (the host keeps that); ads
// are the host's to count (the placements ride on Platform.rewarded and midgame).
//
// The dimensions, all bounded (docs/01-tech-plan.md section 8):
// - game: the player's game number over every sitting, 1 to GAME_CAP (GAME_CAP means that or more),
//   so "how many come back for a second and third game" reads straight off the funnel;
// - revive on a failure: 'offered' (the revive ad is on offer), 'used' (this game already had its
//   revive) or 'none' (no ad to offer);
// - lesson on the first game over ever: the tip the card showed (junk, cards, fish, near), which
//   says what new players lose to.

import type { Platform } from '../platform/types';
import type { SimEvent } from '../sim/events';
import { seaOf } from '../sim/seas';
import { STEP_IDS } from './guide/guide';
import { B } from '../sim/balance';
import { PerfSampler } from './perf';
import type { Session } from './session';

/** The game number is sent as is up to here; past it, as this. */
export const GAME_CAP = 20;

export class Telemetry {
  private readonly perf: PerfSampler;
  /** Tutorial steps already sent (Guide.log only grows within a sitting). */
  private steps: number;
  private tutorialDone: boolean;
  /** The game whose end was cheered (a new best or a log entry), so it is cheered once. */
  private cheered = -1;
  /** The harbour's levels and charts as last seen, to spot a purchase. */
  private owned: Record<string, number>;

  constructor(
    private readonly platform: Platform,
    private readonly session: Session,
    build: string,
  ) {
    this.perf = new PerfSampler(build);
    this.steps = session.guide?.log.length ?? 0;
    this.tutorialDone = session.guide?.finished ?? true;
    this.owned = this.holdings();
  }

  /** One frame: its length, whether the game was in active visible play, and its events. */
  frame(ms: number, active: boolean, events: readonly SimEvent[]): void {
    const s = this.session;
    const game = this.game();
    const step = { step_id: 'wave', step_index: s.world.wave, sea: seaOf(s.world).id, game };
    for (const ev of events) {
      if (ev.e === 'waveStart') this.send('progression_started', step);
      else if (ev.e === 'waveClear') this.send('progression_completed', step);
      else if (ev.e === 'over') {
        const fail: Record<string, string | number | boolean> = { ...step, reason: 'dock_fell', revive: s.pending ? 'offered' : s.revived ? 'used' : 'none' };
        const lesson = s.guide?.lesson;
        if (lesson) fail.lesson = lesson.slice(lesson.lastIndexOf('.') + 1);
        this.send('progression_failed', fail);
      }
    }
    this.tutorial();
    if (s.mode === 'lobby') this.purchases(game);
    if (s.mode === 'over' && !s.pending && this.cheered !== s.games) {
      this.cheered = s.games;
      if (s.last.record || s.last.log.length) this.platform.celebrate();
    }
    const sample = this.perf.frame(ms, active);
    if (sample) this.send('performance_sample', sample);
  }

  /** The player's game number, capped (see the top of the file). */
  private game(): number {
    const s = this.session;
    return Math.min(GAME_CAP, Math.max(1, s.guide?.games ?? s.games));
  }

  /** What the harbour holds: each upgrade's level and each chart, by id. */
  private holdings(): Record<string, number> {
    const h = this.session.harbour;
    if (!h) return {};
    const out: Record<string, number> = {};
    for (const u of B.meta.upgrades) out[u.id] = h.level(u.id);
    B.seas.forEach((sea, i) => {
      if (i > 0) out[`chart_${sea.id}`] = h.owns(i) ? 1 : 0;
    });
    return out;
  }

  /** One `harbour_purchase` per level or chart bought since the last look. */
  private purchases(game: number): void {
    const now = this.holdings();
    for (const [id, level] of Object.entries(now)) {
      for (let l = (this.owned[id] ?? 0) + 1; l <= level; l++) this.send('harbour_purchase', { item_id: id, level: l, game });
    }
    this.owned = now;
  }

  private tutorial(): void {
    const g = this.session.guide;
    if (!g) return;
    for (; this.steps < g.log.length; this.steps++) {
      const l = g.log[this.steps];
      this.send('tutorial_step', { step_id: l.step, step_index: STEP_IDS.indexOf(l.step as (typeof STEP_IDS)[number]) + 1, seconds: l.doneS, skipped: l.doneS < 0 });
    }
    if (!this.tutorialDone && g.finished) {
      this.tutorialDone = true;
      this.send('tutorial_completed', {});
    }
  }

  private send(event: string, data: Record<string, string | number | boolean>): void {
    this.platform.track(event, data);
  }
}
