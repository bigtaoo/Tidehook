import { describe, expect, it } from 'vitest';
import { StubPlatform } from '../platform/stub';
import { SafeStore } from '../platform/types';
import { gameOver } from '../sim/monsters';
import { Ads } from './ads';
import { Guide } from './guide/guide';
import { saveGuide } from './guide/store';
import { Harbour } from './meta/harbour';
import { OVER_LOCK_MS, Session } from './session';

const FRAME = 1000 / 60;

/** A player's game with a harbour, on a stub host whose rewarded ads answer `ads`. */
function setup(ads: StubPlatform['ads'] = 'reward', guideGames = 5) {
  const store = new SafeStore(null);
  saveGuide(store, { done: [], games: guideGames });
  const p = new StubPlatform();
  p.ads = ads;
  const s = new Session({ seed: 3, speed: 1, autoplay: null }, new Guide(store), new Harbour(store));
  const flips: boolean[] = [];
  const a = new Ads(p, s, (on) => flips.push(on));
  s.start();
  return { p, s, a, flips };
}

/** Sinks the dock and runs the frame that notices. */
function sink(s: Session): void {
  gameOver(s.world);
  for (let i = 0; i < 10 && s.mode === 'play'; i++) s.update(FRAME);
}

describe('Ads', () => {
  it('offers the revive and counts nothing until the game really ends', async () => {
    const { s, a, flips } = setup();
    sink(s);
    expect([s.mode, s.pending, a.offer(), s.harbour?.pearls]).toEqual(['over', true, 'revive', 0]);
    s.update(OVER_LOCK_MS + 100);
    s.tap();
    expect(s.mode).toBe('over');
    expect(await a.revive()).toBe(true);
    expect([s.mode, s.world.phase, s.world.hp, s.hold, flips]).toEqual(['play', 'wave', Math.ceil(s.world.maxHp / 2), false, [true, false]]);
    sink(s);
    expect([s.pending, a.offer()]).not.toContain('revive');
    expect(s.harbour?.pearls).toBe(s.last.pearls);
  });

  it('ends the game at once where there is no ad to watch', () => {
    const { s, a } = setup('none');
    sink(s);
    expect([s.pending, a.offer()]).toEqual([false, null]);
  });

  it('counts the game when the revive is turned down, and keeps it open when the ad is skipped', async () => {
    const { s, a } = setup('skip');
    sink(s);
    expect(await a.revive()).toBe(false);
    expect(s.pending).toBe(true);
    expect(a.giveUp()).toBe(true);
    expect([s.pending, s.mode]).toEqual([false, 'over']);
    s.update(OVER_LOCK_MS + 100);
    s.tap();
    expect(s.mode).toBe('lobby');
  });

  it("doubles a game's pearls once", async () => {
    const { s, a } = setup();
    s.world.wave = 6;
    sink(s);
    a.giveUp();
    const { pearls, won } = s.last;
    expect(pearls).toBeGreaterThan(won); // the first game meets log entries too
    expect(won).toBeGreaterThan(0);
    expect(a.offer()).toBe('double');
    expect(await a.double()).toBe(true);
    // Only the game's own pearls are doubled, not the captain's log's.
    expect([s.last.pearls, s.harbour?.pearls, a.offer()]).toEqual([pearls + won, pearls + won, null]);
    expect(await a.double()).toBe(false);
  });

  it('deals one free reroll a game in the shop', async () => {
    const { s, a } = setup();
    s.world.phase = 'shop';
    s.world.coins = 0;
    const cards = JSON.stringify(s.world.cards);
    expect(a.freeReroll()).toBe(true);
    expect(await a.reroll()).toBe(true);
    expect([s.world.coins, s.world.rerolls, a.freeReroll()]).toEqual([0, 0, false]);
    expect(JSON.stringify(s.world.cards)).not.toBe(cards);
    expect(await a.reroll()).toBe(false);
  });

  it('fills the shop and the way to the harbour with an interstitial, holding the game meanwhile', async () => {
    const { p, s, a } = setup('skip');
    s.world.phase = 'shop';
    a.frame([{ e: 'waveClear', wave: 1 }]);
    expect(s.hold).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(s.hold).toBe(false);
    sink(s);
    a.giveUp();
    a.frame([]);
    s.update(OVER_LOCK_MS + 100);
    s.tap();
    a.frame([]);
    expect(p.calls.filter((c) => c === 'midgame')).toHaveLength(2);
  });

  it("shows no interstitial in a new player's first game, nor right after a rewarded ad", async () => {
    const first = setup('reward', 0);
    first.s.world.phase = 'shop';
    first.a.frame([{ e: 'waveClear', wave: 1 }]);
    expect(first.p.calls).not.toContain('midgame');
    const { p, s, a } = setup('reward');
    s.world.phase = 'shop';
    await a.reroll();
    a.frame([{ e: 'waveClear', wave: 1 }]);
    expect(p.calls).not.toContain('midgame');
  });
});
