import { describe, expect, it } from 'vitest';
import { SafeStore } from '../../platform/types';
import { hashWorld } from '../../sim/hash';
import { step } from '../../sim/step';
import { Session, type SessionOptions } from '../session';
import { Resume, RUN_KEY } from './resume';

const OPTS: SessionOptions = { seed: 77, speed: 1, autoplay: null };

/** A session a few seconds into its first wave, with something in the water. */
function afloat(): Session {
  const s = new Session(OPTS);
  s.start();
  s.nextWave();
  for (let i = 0; i < 200; i++) {
    s.tap();
    step(s.world);
  }
  return s;
}

describe('resume', () => {
  it('brings a voyage back tick for tick', () => {
    const store = new SafeStore(null);
    const a = afloat();
    a.world.coins = 123;
    new Resume(store).save(a);

    const b = new Session(OPTS);
    expect(new Resume(store).restore(b)).toBe(true);
    expect(b.mode).toBe('play');
    // paused, so nothing moves while the player is still looking at the screen
    expect(b.paused).toBe(true);
    expect(b.games).toBe(a.games);
    expect(b.world.wave).toBe(a.world.wave);
    expect(b.world.coins).toBe(123);
    expect(hashWorld(b.world)).toBe(hashWorld(a.world));

    // and it plays on the same: the same spawns, the same catches, the same coins
    for (let i = 0; i < 600; i++) {
      step(a.world);
      step(b.world);
    }
    expect(b.world.tick).toBe(a.world.tick);
    expect(hashWorld(b.world)).toBe(hashWorld(a.world));
  });

  it('keeps the voyage while it runs and drops it once the game is over', () => {
    const store = new SafeStore(null);
    const r = new Resume(store);
    const s = afloat();
    r.frame(s, 0);
    expect(store.getItem(RUN_KEY)).toBeTruthy();
    s.mode = 'over';
    r.frame(s, 1);
    expect(store.getItem(RUN_KEY)).toBe('');
    expect(new Resume(store).restore(new Session(OPTS))).toBe(false);
  });

  it('saves again when the wave turns over, not on every frame', () => {
    const store = new SafeStore(null);
    const r = new Resume(store);
    const s = afloat();
    r.frame(s, 0);
    const first = store.getItem(RUN_KEY);
    s.world.coins += 50;
    r.frame(s, 1);
    expect(store.getItem(RUN_KEY)).toBe(first);
    s.world.phase = 'shop';
    r.frame(s, 2);
    expect(store.getItem(RUN_KEY)).not.toBe(first);
  });

  it("restores nothing from a bot's run, an empty store or a save it cannot read", () => {
    const store = new SafeStore(null);
    new Resume(store).save(afloat());
    const bot = new Session({ ...OPTS, autoplay: 'good' });
    expect(new Resume(store).restore(bot)).toBe(false);
    for (const bad of ['', 'not json', '{}', '{"v":99}', JSON.stringify({ v: 1, w: { phase: 'wave' }, games: 1, daily: null })]) {
      store.setItem(RUN_KEY, bad);
      expect(new Resume(store).restore(new Session(OPTS))).toBe(false);
    }
  });

  it('restores nothing from a dock that has already fallen', () => {
    const store = new SafeStore(null);
    const s = afloat();
    new Resume(store).save(s);
    const raw = JSON.parse(store.getItem(RUN_KEY) as string);
    raw.w.hp = 0;
    store.setItem(RUN_KEY, JSON.stringify(raw));
    expect(new Resume(store).restore(new Session(OPTS))).toBe(false);
  });

  it("leaves yesterday's daily voyage behind", () => {
    const store = new SafeStore(null);
    const s = afloat();
    s.daily = '2026-11-15';
    new Resume(store).save(s);
    expect(new Resume(store, () => '2026-11-16').restore(new Session(OPTS))).toBe(false);
    expect(store.getItem(RUN_KEY)).toBe('');
    // today's sails on
    new Resume(store).save(s);
    expect(new Resume(store, () => '2026-11-15').restore(new Session(OPTS))).toBe(true);
  });
  it('drops a save it cannot read instead of leaving it there', () => {
    const store = new SafeStore(null);
    store.setItem(RUN_KEY, '{"v":99}');
    expect(new Resume(store).restore(new Session(OPTS))).toBe(false);
    expect(store.getItem(RUN_KEY)).toBe('');
    // an empty store is left alone: there is nothing to drop
    const quiet = new SafeStore(null);
    expect(new Resume(quiet).restore(new Session(OPTS))).toBe(false);
    expect(quiet.getItem(RUN_KEY)).toBe(null);
  });
});
