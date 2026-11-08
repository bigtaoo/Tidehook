import { describe, expect, it } from 'vitest';
import { OVER_LOCK_MS, Session } from './session';

const FRAME = 1000 / 60;

/** Runs `ms` of frames, or until `until` holds. */
function run(s: Session, ms: number, until: () => boolean = () => false): void {
  for (let t = 0; t < ms && !until(); t += FRAME) s.update(FRAME);
}

describe('Session', () => {
  it('waits on the title, then a tap starts the game and the next casts', () => {
    const s = new Session({ seed: 3, speed: 1, autoplay: null });
    run(s, 500);
    expect(s.mode).toBe('title');
    expect(s.world.tick).toBe(0);
    s.tap();
    expect(s.mode).toBe('play');
    run(s, 500);
    expect(s.world.tick).toBeGreaterThan(10);
    s.tap();
    run(s, 100);
    expect(s.world.hook.st).not.toBe('swing');
  });

  it('stops the world while paused', () => {
    const s = new Session({ seed: 3, speed: 1, autoplay: null });
    s.tap();
    run(s, 200);
    s.togglePause();
    const tick = s.world.tick;
    run(s, 500);
    expect(s.world.tick).toBe(tick);
    s.tap();
    expect(s.paused).toBe(false);
  });

  it('lets the bot play to the shop, shop by itself, and keeps the player out', () => {
    const s = new Session({ seed: 5, speed: 20, autoplay: 'good' });
    s.tap();
    run(s, 120_000, () => s.world.phase === 'shop');
    expect(s.world.phase).toBe('shop');
    expect(s.shopping()).toBe(false);
    expect(s.nextWave()).toBe(false);
    run(s, 5_000, () => s.world.phase !== 'shop');
    expect(s.world.wave).toBe(2);
  });

  it('holds taps for a moment after the dock falls, then starts a new game on a new seed', () => {
    const s = new Session({ seed: 7, speed: 20, autoplay: 'casual' });
    s.tap();
    s.world.hp = 1;
    run(s, 600_000, () => s.mode === 'over');
    expect(s.mode).toBe('over');
    s.tap();
    expect(s.mode).toBe('over');
    run(s, OVER_LOCK_MS + 50);
    s.tap();
    expect(s.mode).toBe('play');
    expect(s.games).toBe(2);
    expect(s.world.seed).toBe(8);
  });
});
