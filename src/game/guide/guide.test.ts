import { describe, expect, it } from 'vitest';
import { SafeStore } from '../../platform/types';
import { CALM_D } from '../../sim/monsters';
import { startGame, step } from '../../sim/step';
import type { World } from '../../sim/world';
import { Session } from '../session';
import { FIRST_MS, Guide, HOLD_MS, REST_MS, SKIP_MS, STEP_IDS } from './guide';
import { GUIDE_KEY, loadGuide } from './store';

const FRAME = 1000 / 60;

function fresh(): { store: SafeStore; g: Guide } {
  const store = new SafeStore(null);
  return { store, g: new Guide(store) };
}

/** Plays `ms` of frames on a session with the guide, no taps. */
function run(s: Session, ms: number): void {
  for (let t = 0; t < ms; t += FRAME) s.update(FRAME);
}

describe('Guide', () => {
  it('starts a new player on the cast step, with no monsters until the first catch', () => {
    const { g } = fresh();
    expect(g.fresh).toBe(true);
    const s = new Session({ seed: 5, speed: 1, autoplay: null }, g);
    s.start();
    expect(s.world.calm).toBe(1);
    run(s, 8000);
    expect(s.world.mons.length).toBe(0);
    expect(g.cue?.step).toBe('cast');
    expect(g.cue?.text).toBe('guide.cast');
    expect(g.cue?.want).toBe('fish');
  });

  it('lets a hold go after HOLD_MS, and keeps the cue', () => {
    const { g } = fresh();
    const s = new Session({ seed: 5, speed: 1, autoplay: null }, g);
    s.start();
    run(s, HOLD_MS - 500);
    expect(s.world.calm).toBe(1);
    run(s, 1000);
    expect(s.world.calm).toBe(0);
    expect(g.cue?.step).toBe('cast');
  });

  it('shows the hand only after FIRST_MS, and rests it REST_MS after a tap', () => {
    const { g } = fresh();
    const s = new Session({ seed: 5, speed: 1, autoplay: null }, g);
    s.start();
    run(s, FIRST_MS - 100);
    expect(g.cue?.hand).toBe(false);
    run(s, 200);
    expect(g.cue?.hand).toBe(true);
    s.tap();
    // the hook flies out and back: no hand while it is not swinging, and none for REST_MS
    run(s, 300);
    expect(g.cue?.hand ?? false).toBe(false);
    let back = 0;
    for (let t = 0; t < 10_000 && !g.cue?.hand; t += FRAME) {
      s.update(FRAME);
      back = t;
    }
    expect(back).toBeGreaterThanOrEqual(REST_MS - 300 - FRAME);
  });

  it('finishes steps by doing them, in any order, and never on a spat catch', () => {
    const { g } = fresh();
    const w = startGame(5);
    g.observe([{ e: 'coins', amount: 3, spat: true }], w);
    expect(g.done.has('cast')).toBe(false);
    g.observe([{ e: 'coins', amount: 3, spat: false }], w);
    expect(g.done.has('cast')).toBe(true);
    expect(g.calm()).toBe(2);
    g.observe([{ e: 'throw' }], w);
    expect(g.done.has('throw') && g.done.has('junk')).toBe(true);
    g.observe([{ e: 'kill', id: 1, kind: 'grunt', crushed: false, d: 0, w: 0 }], w);
    expect(g.calm()).toBe(0);
    for (const wave of [2, 3, 4]) g.observe([{ e: 'waveStart', wave }], w);
    expect(g.finished).toBe(true);
    expect(g.log.map((l) => l.step)).toEqual(['cast', 'throw', 'junk', 'crab', 'shop']);
  });

  it('points at throwing while junk is held, and at junk when a turtle comes', () => {
    const { g } = fresh();
    const w = startGame(5);
    g.observe([{ e: 'coins', amount: 3, spat: false }, { e: 'kill', id: 1, kind: 'grunt', crushed: false, d: 0, w: 0 }], w);
    g.update(w, true, FRAME);
    expect(g.cue).toBeNull();
    w.mons.push({ ...structuredClone(anyMonster(w)), kind: 'brute' });
    g.update(w, true, FRAME);
    expect(g.cue?.step).toBe('junk');
    w.held = w.items.find((it) => it.kind === 'junk') ?? null;
    expect(w.held).not.toBeNull();
    g.observe([{ e: 'held' }], w);
    g.update(w, true, FRAME);
    expect(g.cue?.step).toBe('throw');
    expect(g.cue?.want).toBe('mon');
  });

  it('skips only on a second press within SKIP_MS', () => {
    const { store, g } = fresh();
    const w = startGame(5);
    expect(g.skip()).toBe(false);
    expect(g.skipArmed).toBe(true);
    g.update(w, true, SKIP_MS + 100);
    expect(g.skipArmed).toBe(false);
    expect(g.skip()).toBe(false);
    g.update(w, true, 500);
    expect(g.skip()).toBe(true);
    expect(g.finished).toBe(true);
    expect(g.cue).toBeNull();
    expect(loadGuide(store).done).toEqual(expect.arrayContaining([...STEP_IDS]));
    expect(g.log.every((l) => l.doneS === -1)).toBe(true);
  });

  it('saves the steps and games, and an old player gets no guide and no hold', () => {
    const { store, g } = fresh();
    g.begin();
    for (const s of STEP_IDS) g.observe(eventFor(s), startGame(1));
    const again = new Guide(store);
    expect(again.fresh).toBe(false);
    expect(again.finished).toBe(true);
    expect(again.games).toBe(1);
    const s = new Session({ seed: 9, speed: 1, autoplay: null }, again);
    s.start();
    run(s, 5000);
    expect(s.world.calm).toBe(0);
    expect(again.cue).toBeNull();
  });

  it('reads bad saves as a new player', () => {
    for (const raw of ['{', 'null', '[]', '{"done":7,"games":-2}', '{"done":["cast",3],"games":1.5}']) {
      const store = new SafeStore(null);
      store.setItem(GUIDE_KEY, raw);
      const save = loadGuide(store);
      expect(save.games).toBe(0);
      expect(save.done.every((d) => typeof d === 'string')).toBe(true);
    }
  });

  it('explains the shop on the first visit only', () => {
    const { g } = fresh();
    g.begin();
    expect(g.shopTeach).toBe(true);
    g.observe([{ e: 'waveStart', wave: 2 }], startGame(1));
    expect(g.shopTeach).toBe(false);
    const old = fresh().g;
    for (const s of STEP_IDS) old.observe(eventFor(s), startGame(1));
    expect(old.shopTeach).toBe(false);
  });

  it('keeps the shop explained once across a reload', () => {
    const { store, g } = fresh();
    g.begin();
    g.observe([{ e: 'waveStart', wave: 2 }], startGame(1));
    const again = new Guide(store);
    again.begin();
    expect(again.shopTeach).toBe(false);
  });

  it('answers once true for each one-time hint, kept across saves', () => {
    const { store, g } = fresh();
    expect(g.has('event')).toBe(false);
    expect(g.once('event')).toBe(true);
    expect(g.has('event')).toBe(true);
    expect(g.once('event')).toBe(false);
    expect(new Guide(store).once('event')).toBe(false);
    expect(new Guide(store).finished).toBe(false);
  });

  it('tags the Top pick for the first three games only', () => {
    const { g } = fresh();
    for (let i = 0; i < 3; i++) g.begin();
    expect(g.tagOn).toBe(true);
    g.begin();
    expect(g.tagOn).toBe(false);
  });

  it('picks one lesson for the first game over, and none after', () => {
    const cases: [string, (w: World, g: Guide) => void][] = [
      ['guide.lesson.junk', (_w, g) => g.observe([{ e: 'leak', kind: 'brute', dmg: 2 }], _w)],
      ['guide.lesson.cards', () => undefined],
      ['guide.lesson.fish', (w) => ((w.lv = { power: 1 }), (w.st.eaten = 4))],
      ['guide.lesson.near', (w) => (w.lv = { power: 1 })],
    ];
    for (const [want, set] of cases) {
      const { g } = fresh();
      g.begin();
      const w = startGame(2);
      set(w, g);
      g.observe([{ e: 'over', wave: 2 }], w);
      expect(g.lesson).toBe(want);
      g.begin();
      expect(g.lesson).toBeNull();
      g.observe([{ e: 'over', wave: 3 }], w);
      expect(g.lesson).toBeNull();
    }
  });
});

describe('World.calm', () => {
  it('2 lets one monster on at a time and stops it at CALM_D', () => {
    const w = startGame(4);
    w.calm = 2;
    for (let i = 0; i < 30 * 40; i++) {
      step(w);
      expect(w.mons.length).toBeLessThanOrEqual(1);
    }
    expect(w.mons.length).toBe(1);
    // it may overshoot by the last step it took
    expect(w.mons[0].d).toBeGreaterThanOrEqual(CALM_D - 4000);
    expect(w.hp).toBe(w.maxHp);
  });
});

function anyMonster(w: World): World['mons'][number] {
  const s = startGame(w.seed);
  for (let i = 0; i < 30 * 30 && !s.mons.length; i++) step(s);
  return s.mons[0];
}

function eventFor(s: string): Parameters<Guide['observe']>[0] {
  if (s === 'cast') return [{ e: 'coins', amount: 1, spat: false }];
  if (s === 'crab') return [{ e: 'kill', id: 1, kind: 'grunt', crushed: false, d: 0, w: 0 }];
  if (s === 'throw' || s === 'junk') return [{ e: 'throw' }];
  return [2, 3, 4].map((wave) => ({ e: 'waveStart' as const, wave }));
}
