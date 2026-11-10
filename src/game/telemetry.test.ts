import { describe, expect, it } from 'vitest';
import { StubPlatform } from '../platform/stub';
import { SafeStore } from '../platform/types';
import { gameOver } from '../sim/monsters';
import { Guide } from './guide/guide';
import { Harbour } from './meta/harbour';
import { PerfSampler, SAMPLE_MS } from './perf';
import { Session } from './session';
import { Telemetry } from './telemetry';

describe('PerfSampler', () => {
  it('samples active play only and drops the frame after a stop', () => {
    const p = new PerfSampler('b1');
    expect(p.frame(5000, false)).toBeNull();
    // the first active frame after a stop is the gap, not a frame
    expect(p.frame(900, true)).toBeNull();
    let out = null;
    for (let i = 0; !out && i < 5000; i++) out = p.frame(i % 100 === 99 ? 120 : 16, true);
    expect(out).not.toBeNull();
    const s = out as Record<string, number | string>;
    expect(s.active_ms).toBeGreaterThanOrEqual(SAMPLE_MS);
    expect(s.frame_time_max_ms).toBe(120);
    expect(s.frames_over_100ms).toBeGreaterThan(0);
    expect(s.frames_over_250ms).toBe(0);
    expect(s.frame_time_p50_ms).toBe(16);
    expect(s.build_version).toBe('b1');
  });
});

describe('Telemetry', () => {
  it('sends each wave as a progression step and cheers a game worth it once', () => {
    const p = new StubPlatform();
    const s = new Session({ seed: 3, speed: 1, autoplay: null }, null, new Harbour(new SafeStore(null)));
    const tel = new Telemetry(p, s, 'b');
    s.start();
    tel.frame(16, true, s.drain());
    gameOver(s.world);
    for (let i = 0; i < 10 && s.mode === 'play'; i++) s.update(16);
    s.last = { ...s.last, record: true };
    tel.frame(16, false, s.drain());
    tel.frame(16, false, []);
    expect(p.tracked.map(([e]) => e)).toEqual(['progression_started', 'progression_failed']);
    expect(p.tracked[1][1]).toMatchObject({ step_id: 'wave', step_index: 1, reason: 'dock_fell' });
    expect(p.calls.filter((c) => c === 'celebrate')).toHaveLength(1);
  });

  it("sends the tutorial's steps as they are done, skipped ones marked", () => {
    const p = new StubPlatform();
    const g = new Guide(new SafeStore(null));
    const s = new Session({ seed: 3, speed: 1, autoplay: null }, g);
    const tel = new Telemetry(p, s, 'b');
    g.skip();
    g.skip();
    tel.frame(16, false, []);
    const names = p.tracked.map(([e]) => e);
    expect(names.filter((e) => e === 'tutorial_step').length).toBeGreaterThan(0);
    expect(names.at(-1)).toBe('tutorial_completed');
    expect(p.tracked[0][1]).toMatchObject({ step_index: 1, skipped: true });
  });
});
