import { describe, expect, it } from 'vitest';
import { StubPlatform } from '../platform/stub';
import { SafeStore } from '../platform/types';
import { gameOver } from '../sim/monsters';
import { Guide } from './guide/guide';
import { B } from '../sim/balance';
import { TICK_RATE } from '../sim/math/fixed';
import { BF } from '../sim/balanceFun';
import { Harbour, HARBOUR_KEY } from './meta/harbour';
import { PerfSampler, SAMPLE_MS } from './perf';
import { Session } from './session';
import { MINUTES_CAP, Telemetry } from './telemetry';

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
    expect(p.tracked[1][1]).toMatchObject({ step_id: 'wave', step_index: 1, reason: 'dock_fell', game: 1, revive: 'none', mode: 'voyage' });
    expect(p.calls.filter((c) => c === 'celebrate')).toHaveLength(1);
  });

  it("marks the daily voyage's waves apart from a plain voyage's", () => {
    const p = new StubPlatform();
    const s = new Session({ seed: 3, speed: 1, autoplay: null }, null, new Harbour(new SafeStore(null)));
    const tel = new Telemetry(p, s, 'b');
    s.openLobby();
    s.sailDaily('2026-11-10');
    tel.frame(16, true, s.drain());
    expect(p.tracked[0]).toEqual(['progression_started', expect.objectContaining({ mode: 'daily' })]);
  });

  it("sends the tutorial's steps as they are done, skipped ones marked", () => {
    const p = new StubPlatform();
    const g = new Guide(new SafeStore(null));
    const s = new Session({ seed: 3, speed: 1, autoplay: null }, g);
    const tel = new Telemetry(p, s, 'b');
    g.begin();
    g.begin();
    g.skip();
    g.skip();
    tel.frame(16, false, []);
    const names = p.tracked.map(([e]) => e);
    expect(names.filter((e) => e === 'tutorial_step').length).toBeGreaterThan(0);
    expect(names.at(-1)).toBe('tutorial_completed');
    expect(p.tracked[0][1]).toMatchObject({ step_index: 1, skipped: true, game: 2 });
  });

  it("marks a failure with the revive's state and the first lesson, and sends each purchase", () => {
    const p = new StubPlatform();
    const store = new SafeStore(null);
    const harbour = new Harbour(store);
    const s = new Session({ seed: 3, speed: 1, autoplay: null }, new Guide(store), harbour);
    s.canRevive = () => true;
    const tel = new Telemetry(p, s, 'b');
    s.start();
    s.update(16);
    tel.frame(16, true, s.drain());
    gameOver(s.world);
    s.update(50);
    tel.frame(16, false, s.drain());
    const fail = p.tracked.find(([e]) => e === 'progression_failed');
    expect(fail?.[1]).toMatchObject({ game: 1, revive: 'offered' });
    expect(typeof fail?.[1].lesson).toBe('string');

    s.giveUp();
    harbour.earn(1000);
    s.openLobby();
    expect(s.buyChart(1)).toBe(false);
    expect(s.buyMeta('hull') && s.buyMeta('hull')).toBe(true);
    tel.frame(16, false, []);
    tel.frame(16, false, []);
    const buys = p.tracked.filter(([e]) => e === 'harbour_purchase').map(([, d]) => d);
    expect(buys).toEqual([
      { item_id: 'hull', level: 1, game: 1 },
      { item_id: 'hull', level: 2, game: 1 },
    ]);
  });

  it("times a voyage taken home, which never fails and so would otherwise go untimed", () => {
    const p = new StubPlatform();
    const s = new Session({ seed: 3, speed: 1, autoplay: null }, null, new Harbour(new SafeStore(null)));
    const tel = new Telemetry(p, s, 'b');
    s.start();
    const w = s.world;
    w.wave = BF.voyage.wave;
    w.queue = [];
    w.mons = [];
    for (let i = 0; i < 600 && !s.atVoyageEnd(); i++) {
      s.update(16);
      tel.frame(16, true, s.drain());
    }
    expect(s.atVoyageEnd()).toBe(true);
    w.tick = 23 * 60 * TICK_RATE;
    expect(s.home()).toBe(true);
    tel.frame(16, false, s.drain());
    const end = p.tracked.find(([e]) => e === 'voyage_end');
    expect(end?.[1]).toMatchObject({ choice: 'home', minutes: 23, step_index: BF.voyage.wave, mode: 'voyage' });
    // and nothing calls it a failure: the dock is still standing
    expect(p.tracked.map(([e]) => e)).not.toContain('progression_failed');
  });

  it('sends the minutes on a failure and harbour_complete once, on the last purchase', () => {
    const p = new StubPlatform();
    const store = new SafeStore(null);
    const lv = Object.fromEntries(B.meta.upgrades.map((u) => [u.id, u.max]));
    lv.hull -= 1;
    store.setItem(HARBOUR_KEY, JSON.stringify({ pearls: 10_000, lv, charts: B.seas.slice(1).map((sea) => sea.id) }));
    const harbour = new Harbour(store);
    const s = new Session({ seed: 3, speed: 1, autoplay: null }, null, harbour);
    const tel = new Telemetry(p, s, 'b');
    s.start();
    s.world.tick = 125 * 60 * TICK_RATE;
    gameOver(s.world);
    s.update(50);
    tel.frame(16, false, s.drain());
    expect(p.tracked.find(([e]) => e === 'progression_failed')?.[1].minutes).toBe(MINUTES_CAP);
    s.openLobby();
    expect(s.buyMeta('hull')).toBe(true);
    tel.frame(16, false, []);
    tel.frame(16, false, []);
    expect(p.tracked.filter(([e]) => e === 'harbour_complete').map(([, d]) => d)).toEqual([{ game: 1 }]);
  });
});
