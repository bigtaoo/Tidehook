import { describe, expect, it } from 'vitest';
import { SafeStore } from '../platform/types';
import { B } from '../sim/balance';
import { gameOver } from '../sim/monsters';
import { Guide } from './guide/guide';
import { saveGuide } from './guide/store';
import { Harbour } from './meta/harbour';
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

  it('hands on the events raised between ticks: the wave starting and a cast', () => {
    const s = new Session({ seed: 3, speed: 1, autoplay: null });
    s.tap();
    run(s, 300);
    expect(s.drain().map((e) => e.e)).toContain('waveStart');
    s.tap();
    run(s, 50);
    expect(s.drain().map((e) => e.e)).toContain('cast');
  });

  it('hands on each event once, over to a game over and a revive', () => {
    const s = new Session({ seed: 3, speed: 1, autoplay: 'good' });
    s.start();
    let kills = 0;
    for (let t = 0; t < 90_000; t += FRAME) {
      s.update(FRAME);
      kills += s.drain().filter((e) => e.e === 'kill').length;
    }
    expect(s.world.st.kills).toBeGreaterThan(5);
    expect(kills).toBe(s.world.st.kills);

    const h = new Session({ seed: 3, speed: 1, autoplay: null }, null, new Harbour(new SafeStore(null)));
    h.canRevive = () => true;
    h.start();
    run(h, 200);
    gameOver(h.world);
    run(h, 50);
    expect(h.drain().filter((e) => e.e === 'over')).toHaveLength(1);
    expect(h.mode).toBe('over');
    expect(h.pending && h.revive()).toBe(true);
    expect(h.drain().filter((e) => e.e === 'over')).toHaveLength(0);
  });

  it("opens every player's game on the slow tide, and not the bot's", () => {
    const store = new SafeStore(null);
    const s = new Session({ seed: 3, speed: 1, autoplay: null }, new Guide(store));
    expect(s.world.ease).toBe(B.tide.waves);
    s.start();
    s.start();
    expect(s.world.ease).toBe(B.tide.waves);
    saveGuide(store, { done: [], games: 9 });
    expect(new Session({ seed: 3, speed: 1, autoplay: null }, new Guide(store)).world.ease).toBe(B.tide.waves);
    expect(new Session({ seed: 3, speed: 1, autoplay: 'good' }).world.ease).toBe(0);
    expect(new Session({ seed: 3, speed: 1, autoplay: 'novice', ease: 5 }).world.ease).toBe(5);
  });

  it('goes to the harbour after a game over, buys there, and sails with the upgrades', () => {
    const harbour = new Harbour(new SafeStore(null));
    const s = new Session({ seed: 3, speed: 1, autoplay: null }, null, harbour);
    s.tap();
    s.world.wave = 6;
    gameOver(s.world);
    run(s, 100);
    expect(s.mode).toBe('over');
    // the captain's log's first entry, reach wave 5, pays on top
    const log = B.goals.find((g) => g.id === 'game.wave.5')!.pearls;
    expect(s.last).toMatchObject({ wave: 6, pearls: 5 * B.meta.perWave + log });
    expect(s.last.log.map((g) => g.id)).toEqual(['game.wave.5']);
    expect(harbour.pearls).toBe(5 * B.meta.perWave + log);
    s.tap();
    expect(s.mode).toBe('over');
    run(s, OVER_LOCK_MS + 50);
    s.tap();
    expect(s.mode).toBe('lobby');
    s.tap();
    expect(s.mode).toBe('lobby');
    expect(s.buyMeta('hull')).toBe(true);
    expect(s.sail()).toBe(true);
    expect(s.mode).toBe('play');
    expect(s.world.maxHp).toBe(B.dock.hp + 2);
    expect(s.buyMeta('hull')).toBe(false);
    expect(s.sail()).toBe(false);
  });

  it('opens the harbour on boot only with one, and never mid-game', () => {
    const bare = new Session({ seed: 3, speed: 1, autoplay: null });
    bare.openLobby();
    expect(bare.mode).toBe('title');
    const s = new Session({ seed: 3, speed: 1, autoplay: null }, null, new Harbour(new SafeStore(null)));
    s.openLobby();
    expect(s.mode).toBe('lobby');
    s.sail();
    s.openLobby();
    expect(s.mode).toBe('play');
  });
});
