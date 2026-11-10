// What the game tells the host about a sitting (Playgama's telemetry guide, v1.1.2), all through
// Platform.track: each wave as a progression step (started, completed, failed when the dock
// falls), the tutorial's steps, and a performance sample every 30 s of active play. Nothing
// about the player, and no session id of our own (the host keeps that).

import type { Platform } from '../platform/types';
import type { SimEvent } from '../sim/events';
import { seaOf } from '../sim/seas';
import { STEP_IDS } from './guide/guide';
import { PerfSampler } from './perf';
import type { Session } from './session';

export class Telemetry {
  private readonly perf: PerfSampler;
  /** Tutorial steps already sent (Guide.log only grows within a sitting). */
  private steps: number;
  private tutorialDone: boolean;
  /** The game whose end was cheered (a new best or a log entry), so it is cheered once. */
  private cheered = -1;

  constructor(
    private readonly platform: Platform,
    private readonly session: Session,
    build: string,
  ) {
    this.perf = new PerfSampler(build);
    this.steps = session.guide?.log.length ?? 0;
    this.tutorialDone = session.guide?.finished ?? true;
  }

  /** One frame: its length, whether the game was in active visible play, and its events. */
  frame(ms: number, active: boolean, events: readonly SimEvent[]): void {
    const s = this.session;
    const step = { step_id: 'wave', step_index: s.world.wave, sea: seaOf(s.world).id };
    for (const ev of events) {
      if (ev.e === 'waveStart') this.send('progression_started', step);
      else if (ev.e === 'waveClear') this.send('progression_completed', step);
      else if (ev.e === 'over') this.send('progression_failed', { ...step, reason: 'dock_fell' });
    }
    this.tutorial();
    if (s.mode === 'over' && !s.pending && this.cheered !== s.games) {
      this.cheered = s.games;
      if (s.last.record || s.last.log.length) this.platform.celebrate();
    }
    const sample = this.perf.frame(ms, active);
    if (sample) this.send('performance_sample', sample);
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
