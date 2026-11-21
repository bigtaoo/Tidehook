import { describe, expect, it } from 'vitest';
import { StubPlatform } from '../platform/stub';
import { SafeStore } from '../platform/types';
import { BootTrack, errorKind } from './bootTrack';
import { IDLE_CAP, IDLE_MS, LeaveTrack } from './leaveTrack';
import { Harbour } from './meta/harbour';
import { Session } from './session';
import type { BootScreen } from '../boot/screen';

/** A window or document whose listeners can be fired by hand. */
function fakePage() {
  const on = new Map<string, (() => void)[]>();
  const page = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener(type: string, cb: unknown) {
      on.set(type, [...(on.get(type) ?? []), cb as () => void]);
    },
    removeEventListener(type: string, cb: unknown) {
      on.set(type, (on.get(type) ?? []).filter((f) => f !== cb));
    },
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 3,
    fire(type: string) {
      for (const cb of on.get(type) ?? []) cb();
    },
  };
  return page;
}

function session() {
  return new Session({ seed: 3, speed: 1, autoplay: null }, null, new Harbour(new SafeStore(null)));
}

describe('LeaveTrack', () => {
  it('sends first_tap once, from where the player was', () => {
    const p = new StubPlatform();
    const win = fakePage();
    const s = session();
    const leave = new LeaveTrack(p, s, Date.now(), win, fakePage());
    s.openLobby();
    // a tap before the game is up is the loading page's, and is not the first tap
    win.fire('pointerdown');
    expect(p.tracked).toHaveLength(0);
    leave.started();
    win.fire('pointerdown');
    win.fire('pointerdown');
    expect(p.tracked.map(([e]) => e)).toEqual(['first_tap']);
    expect(p.tracked[0][1]).toMatchObject({ at: 'lobby', game: 0, mode: 'voyage' });
  });

  it('does not spend the quit of a sitting on a page hidden under an ad', () => {
    const p = new StubPlatform();
    const doc = fakePage();
    const s = session();
    const leave = new LeaveTrack(p, s, Date.now(), fakePage(), doc);
    leave.started();
    s.start();
    s.hold = true;
    doc.visibilityState = 'hidden';
    doc.fire('visibilitychange');
    expect(p.tracked).toHaveLength(0);
    // the ad is over and the player really does leave: that is the stop worth reporting
    s.hold = false;
    doc.fire('visibilitychange');
    expect(p.tracked.map(([e]) => e)).toEqual(['quit']);
    expect(p.tracked[0][1]).toMatchObject({ at: 'play', paused: false });
  });

  it('says which screen a paused game left from, the shop or a wave', () => {
    const quitFrom = (shop: boolean) => {
      const p = new StubPlatform();
      const doc = fakePage();
      const s = session();
      new LeaveTrack(p, s, Date.now(), fakePage(), doc).started();
      s.start();
      if (shop) s.world.phase = 'shop';
      // losing focus pauses the game before the page hides, so most stops are paused ones
      s.pause();
      doc.visibilityState = 'hidden';
      doc.fire('visibilitychange');
      return p.tracked[0][1];
    };
    expect(quitFrom(false)).toMatchObject({ at: 'play', paused: true });
    expect(quitFrom(true)).toMatchObject({ at: 'shop', paused: true });
  });

  it('says how long the player was live on this screen and what they bought in this shop', () => {
    const p = new StubPlatform();
    const doc = fakePage();
    const s = session();
    const leave = new LeaveTrack(p, s, Date.now(), fakePage(), doc);
    leave.started();
    s.start();
    for (let i = 0; i < 20; i++) leave.frame(1000, true);
    // time away from the game is not time on the screen
    for (let i = 0; i < 20; i++) leave.frame(1000, false);
    leave.frame(0, true);
    s.world.phase = 'shop';
    s.world.coins = 1e9;
    s.world.cards = [{ id: 'grip', bought: false }, { id: 'heft', bought: false }] as typeof s.world.cards;
    leave.frame(3000, true);
    expect(s.buy(0) && s.buy(1)).toBe(true);
    leave.frame(4000, true);
    s.pause();
    doc.visibilityState = 'hidden';
    doc.fire('visibilitychange');
    expect(p.tracked.at(-1)).toEqual(['quit', expect.objectContaining({ at: 'shop', screen_s: 7, buys: 2 })]);
  });

  it('counts a quiet stretch of live play as idle, no more than IDLE_CAP times', () => {
    const p = new StubPlatform();
    const s = session();
    const leave = new LeaveTrack(p, s, Date.now(), fakePage(), fakePage());
    leave.started();
    s.start();
    // a hidden or paused game is not quiet, it is away
    for (let i = 0; i < 10; i++) leave.frame(IDLE_MS / 2, false);
    expect(p.tracked).toHaveLength(0);
    for (let i = 0; i < IDLE_CAP + 3; i++) leave.frame(IDLE_MS + 1, true);
    expect(p.tracked.map(([e]) => e)).toEqual(Array(IDLE_CAP).fill('idle'));
    expect(p.tracked[0][1]).toMatchObject({ at: 'play', wave: 1 });
  });

  it('sends one quit as the page goes, whichever way it goes', () => {
    const p = new StubPlatform();
    const win = fakePage();
    const doc = fakePage();
    const s = session();
    new LeaveTrack(p, s, Date.now() - 42_000, win, doc).started();
    doc.visibilityState = 'hidden';
    doc.fire('visibilitychange');
    win.fire('pagehide');
    expect(p.tracked.map(([e]) => e)).toEqual(['quit']);
    expect(p.tracked[0][1]).toMatchObject({ at: 'title', tapped: false, seconds: 42 });
  });
});

const screen = (at = 0.5): BootScreen => ({ t0: Date.now() - 3000, at: () => at, started() {}, set() {}, fail() {}, done() {} });

describe('BootTrack', () => {
  it('sends one load with what the host is', () => {
    const p = new StubPlatform();
    const win = fakePage();
    const track = new BootTrack(p, screen(), 'b7', win, fakePage());
    track.loaded({ games: 4 });
    track.loaded({ games: 5 });
    expect(p.tracked.map(([e]) => e)).toEqual(['load']);
    expect(p.tracked[0][1]).toMatchObject({ platform: 'stub', build_version: 'b7', screen_w: 390, screen_h: 844, dpr: 3, games: 4 });
    expect((p.tracked[0][1] as { load_ms: number }).load_ms).toBeGreaterThanOrEqual(3000);
  });

  it('reports a page left during boot, and then nothing more', () => {
    const p = new StubPlatform();
    const doc = fakePage();
    const track = new BootTrack(p, screen(0.42), 'b7', fakePage(), doc);
    track.stage('art');
    doc.visibilityState = 'hidden';
    doc.fire('visibilitychange');
    track.loaded();
    expect(p.tracked.map(([e]) => e)).toEqual(['boot_left']);
    expect(p.tracked[0][1]).toMatchObject({ stage: 'art', percent: 42 });
  });

  it('reports a page going away while it is still on the screen', () => {
    // pagehide is the one event a page going for good is promised, and unloading fires it before
    // the page is hidden; weighing the visibility here lost the player who gave up on the loading
    // page, which is the whole of what this event is for
    const p = new StubPlatform();
    const win = fakePage();
    const doc = fakePage();
    const track = new BootTrack(p, screen(0.3), 'b7', win, doc);
    track.stage('gpu');
    win.fire('pagehide');
    expect(p.tracked.map(([e]) => e)).toEqual(['boot_left']);
    expect(p.tracked[0][1]).toMatchObject({ stage: 'gpu', percent: 30 });
    // and the hidden event that may follow it adds nothing
    doc.visibilityState = 'hidden';
    doc.fire('visibilitychange');
    expect(p.tracked).toHaveLength(1);
  });

  it('does not call a tab coming back to the front a page left', () => {
    const p = new StubPlatform();
    const doc = fakePage();
    const track = new BootTrack(p, screen(), 'b7', fakePage(), doc);
    doc.fire('visibilitychange');
    expect(p.tracked).toHaveLength(0);
    track.loaded();
    expect(p.tracked.map(([e]) => e)).toEqual(['load']);
  });

  it('reports a failure by stage and kind, never by message', () => {
    const p = new StubPlatform();
    let failed = false;
    const track = new BootTrack(p, { ...screen(), fail: () => (failed = true) }, 'b7', fakePage(), fakePage());
    track.stage('gpu');
    track.failed(new TypeError('WebGL unsupported at https://host/path?token=abc'));
    expect(failed).toBe(true);
    expect(p.tracked).toEqual([['boot_error', { stage: 'gpu', kind: 'webgl', error_name: 'TypeError' }]]);
  });

  it('knows the three kinds of failure apart', () => {
    expect(errorKind(new Error('Failed to fetch dynamically imported module'))).toBe('fetch');
    expect(errorKind(new Error('WebGL context lost'))).toBe('webgl');
    expect(errorKind('something else entirely')).toBe('other');
  });
});
