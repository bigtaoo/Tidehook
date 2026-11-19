// What the game tells the host about a sitting (Playgama's telemetry guide, v1.1.2), all through
// Platform.track: each wave as a progression step (started, completed, failed when the dock
// falls), the tutorial's steps, each harbour purchase, and a performance sample every 30 s of
// active play. Nothing about the player, and no session id of our own (the host keeps that); ads
// are the host's to count (the placements ride on Platform.rewarded and midgame).
//
// The dimensions, all bounded (docs/01-tech-plan.md section 8):
// - game: the player's game number over every sitting, 1 to GAME_CAP (GAME_CAP means that or more),
//   so "how many come back for a second and third game" reads straight off the funnel;
// - mode: 'daily' for the daily voyage (meta/daily.ts), else 'voyage', so the day's game, with no
//   upgrades and its own tide, stays out of the plain games' wave curve;
// - revive on a failure: 'offered' (the revive ad is on offer), 'used' (this game already had its
//   revive) or 'none' (no ad to offer);
// - lesson on the first game over ever: the tip the card showed (junk, cards, fish, near), which
//   says what new players lose to;
// - minutes on a failure and at a voyage's end: the game's play time in whole minutes (shop time
//   left out), capped at MINUTES_CAP, to see how long real games run (docs/04-content.md section
//   4.3). A game the captain takes home never fails, so without it here the only games we would
//   time are the ones somebody lost, and wave 30 is reached by the strong players whose length is
//   the open question;
// - harbour_complete: once, the purchase that leaves nothing in the harbour to buy - the last
//   upgrade level, the last chart or the last paint, whichever the captain comes to last - with
//   the game number, which says when the long-tail content runs out.
//
// A tutorial step carries the game it was done in and its seconds into that game (the step clock
// starts over with each game, game/guide/guide.ts), so "a step people take two or three games to
// reach" and "a step that takes a long minute" read apart from each other. The cast step also
// carries `freeze` (tap, released or none; see StepLog), which says whether the first cast's
// freeze is what got the first catch or whether people watched it run out.
//
// A sitting that opens inside a wave is a voyage picked up from storage (game/meta/resume.ts): the
// wave was started in an earlier sitting, so its `progression_started` went with that one and this
// sitting would send only the completion. The funnel counts those apart, and a wave completed more
// often than it was started reads as nonsense, so the wave is started again here, for this sitting.

import type { Platform } from '../platform/types';
import type { SimEvent } from '../sim/events';
import { seaOf } from '../sim/seas';
import { STEP_IDS } from './guide/guide';
import { B } from '../sim/balance';
import { LeaveTrack } from './leaveTrack';
import { PAINTS, freePaint } from './meta/paint';
import { PerfSampler } from './perf';
import type { Session } from './session';
import { TICK_RATE } from '../sim/math/fixed';

/** The game number is sent as is up to here; past it, as this. */
export const GAME_CAP = 20;
/** A game's minutes are sent as is up to here; past it, as this. */
export const MINUTES_CAP = 90;

export class Telemetry {
  private readonly perf: PerfSampler;
  /** Where the sitting stops: first_tap, idle, quit (game/leaveTrack.ts). */
  private readonly leave: LeaveTrack;
  /** Tutorial steps already sent (Guide.log only grows within a sitting). */
  private steps: number;
  private tutorialDone: boolean;
  /** The game whose end was cheered (a new best or a log entry), so it is cheered once. */
  private cheered = -1;
  /** The harbour's levels, charts and paints as last seen, to spot a purchase. */
  private owned: Record<string, number>;
  /** This sitting opened inside a wave, whose start belongs to an earlier one (see the top). */
  private resumed: boolean;

  constructor(
    private readonly platform: Platform,
    private readonly session: Session,
    build: string,
    t0: number = Date.now(),
  ) {
    this.perf = new PerfSampler(build);
    this.leave = new LeaveTrack(platform, session, t0);
    this.steps = session.guide?.log.length ?? 0;
    this.tutorialDone = session.guide?.finished ?? true;
    this.owned = this.holdings();
    const w = session.world;
    this.resumed = session.mode === 'play' && w.phase === 'wave' && w.tick > 0;
  }

  private wasEnd = false;

  /** One frame: its length, whether the game was in active visible play, and its events. */
  frame(ms: number, active: boolean, events: readonly SimEvent[]): void {
    this.leave.frame(ms, active);
    const s = this.session;
    const game = this.game();
    const step = { step_id: 'wave', step_index: s.world.wave, sea: seaOf(s.world).id, game, mode: s.daily ? 'daily' : 'voyage' };
    if (this.resumed) {
      this.resumed = false;
      this.send('progression_started', step);
    }
    for (const ev of events) {
      if (ev.e === 'waveStart') this.send('progression_started', step);
      else if (ev.e === 'waveClear') this.send('progression_completed', step);
      else if (ev.e === 'over') {
        const fail: Record<string, string | number | boolean> = { ...step, reason: 'dock_fell', revive: s.pending ? 'offered' : s.revived ? 'used' : 'none', minutes: this.minutes() };
        const lesson = s.guide?.lesson;
        if (lesson) fail.lesson = lesson.slice(lesson.lastIndexOf('.') + 1);
        this.send('progression_failed', fail);
      }
    }
    // the voyage's end offered the way home (game/session.ts): which way the captain went
    const atEnd = s.atVoyageEnd();
    if (this.wasEnd && !atEnd) this.send('voyage_end', { ...step, choice: s.mode === 'over' && s.last.home ? 'home' : 'sail_on', minutes: this.minutes() });
    this.wasEnd = atEnd;
    this.tutorial();
    if (s.mode === 'lobby') this.purchases(game);
    if (s.mode === 'over' && !s.pending && this.cheered !== s.games) {
      this.cheered = s.games;
      if (s.last.record || s.last.log.length) this.platform.celebrate();
    }
    const sample = this.perf.frame(ms, active);
    if (sample) this.send('performance_sample', sample);
  }

  /** The game is up and can be played: the first-tap clock starts (game/leaveTrack.ts). */
  started(): void {
    this.leave.started();
  }

  /** The game's play time in whole minutes, capped (see the top of the file). */
  private minutes(): number {
    return Math.min(MINUTES_CAP, Math.floor(this.session.world.tick / TICK_RATE / 60));
  }

  /** The player's game number, capped (see the top of the file). */
  private game(): number {
    const s = this.session;
    return this.capped(s.guide?.games ?? s.games);
  }

  /** A game number as it is sent: at least 1, capped (see the top of the file). */
  private capped(n: number): number {
    return Math.min(GAME_CAP, Math.max(1, n));
  }

  /** What the harbour holds: each upgrade's level, each chart and each paint, by id.
   *
   *  Paint (meta/paint.ts) was left out of here, and so was missing from both numbers this file
   *  draws from it. The ten paints are the harbour's longest tail - the pearl sink for a captain
   *  with everything else bought - and not one of their purchases was sent, so the funnel showed
   *  the sink that ends the game as having no takers at all. Worse, `complete` read "nothing left
   *  to buy" off the upgrades and the charts alone, so harbour_complete went out on the last
   *  upgrade with ten paints still on the shelf, and the one number that says when the content
   *  runs out said it early, by as long as the whole tail takes. Neither miscount broke anything
   *  the player could see. */
  private holdings(): Record<string, number> {
    const h = this.session.harbour;
    if (!h) return {};
    const out: Record<string, number> = {};
    for (const u of B.meta.upgrades) out[u.id] = h.level(u.id);
    B.seas.forEach((sea, i) => {
      if (i > 0) out[`chart_${sea.id}`] = h.owns(i) ? 1 : 0;
    });
    for (const paint of PAINTS) {
      if (!freePaint(paint.id)) out[`paint_${paint.id}`] = h.hasPaint(paint.id) ? 1 : 0;
    }
    return out;
  }

  /** One `harbour_purchase` per level or chart bought since the last look. */
  private purchases(game: number): void {
    const now = this.holdings();
    let bought = false;
    for (const [id, level] of Object.entries(now)) {
      for (let l = (this.owned[id] ?? 0) + 1; l <= level; l++) {
        this.send('harbour_purchase', { item_id: id, level: l, game });
        bought = true;
      }
    }
    this.owned = now;
    if (bought && this.complete()) this.send('harbour_complete', { game });
  }

  /** Nothing left to buy: every upgrade at its top level, every chart owned, every paint bought. */
  private complete(): boolean {
    const h = this.session.harbour;
    return !!h && B.meta.upgrades.every((u) => h.price(u.id) === null) && B.seas.every((_, i) => h.owns(i)) && PAINTS.every((p) => h.hasPaint(p.id));
  }

  private tutorial(): void {
    const g = this.session.guide;
    if (!g) return;
    for (; this.steps < g.log.length; this.steps++) {
      const l = g.log[this.steps];
      const data: Record<string, string | number | boolean> = { step_id: l.step, step_index: STEP_IDS.indexOf(l.step as (typeof STEP_IDS)[number]) + 1, game: this.capped(l.game), seconds: l.doneS, skipped: l.doneS < 0 };
      if (l.freeze) data.freeze = l.freeze;
      this.send('tutorial_step', data);
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
