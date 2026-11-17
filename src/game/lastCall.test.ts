import { describe, expect, it } from 'vitest';
import { StubPlatform } from '../platform/stub';
import { SafeStore } from '../platform/types';
import { gameOver } from '../sim/monsters';
import { Guide } from './guide/guide';
import { saveGuide } from './guide/store';
import { lastCall } from './lastCall';
import { Harbour } from './meta/harbour';
import { Resume, RUN_KEY } from './meta/resume';
import { PlayWindow } from './playWindow';
import { Session } from './session';

const FRAME = 1000 / 60;

/** A player's game, with the page's `pagehide` wired to lastCall. */
function setup() {
  const store = new SafeStore(null);
  saveGuide(store, { done: [], games: 5, shops: 0 });
  const s = new Session({ seed: 3, speed: 1, autoplay: null }, new Guide(store), new Harbour(store));
  const resume = new Resume(store);
  const host = new StubPlatform();
  // a tab that is never marked hidden: only pagehide is left to close the host's window
  const play = new PlayWindow(host, { hidden: false, addEventListener: () => {} } as unknown as Document);
  let leave = () => {};
  lastCall({ addEventListener: (type: string, fn: EventListenerOrEventListenerObject) => {
    if (type === 'pagehide') leave = () => (fn as EventListener)(new Event('pagehide'));
  } } as unknown as Window, s, resume, play);
  // the host has a rewarded ad, so the dock falling asks the captain first (game/ads.ts)
  s.canRevive = () => true;
  s.start();
  return { s, store, resume, host, play, leave: () => leave() };
}

/** Sinks the dock a few waves in, and runs the frame that notices. */
function sink(s: Session): void {
  s.world.wave = 8;
  gameOver(s.world);
  for (let i = 0; i < 10 && s.mode === 'play'; i++) s.update(FRAME);
}

describe('lastCall', () => {
  it('counts the game of a player who closes the tab on the revive offer', () => {
    const { s, leave } = setup();
    sink(s);
    // the dock is down and the captain is being asked whether to watch an ad: nothing is banked yet
    expect([s.mode, s.pending, s.harbour?.pearls]).toEqual(['over', true, 0]);
    leave();
    expect(s.pending).toBe(false);
    expect(s.last.pearls).toBeGreaterThan(0);
    expect(s.harbour?.pearls).toBe(s.last.pearls);
    // and the run is counted as the one it was: the wave it reached
    expect(s.last.wave).toBe(8);
  });

  it("closes the host's gameplay window on a tab that was never hidden", () => {
    const { host, play, leave } = setup();
    play.set(true);
    expect(host.calls).toEqual(['gameplayStart']);
    leave();
    // the host is told the round is over; it would otherwise count the player as playing for ever
    expect([host.calls, play.open]).toEqual([['gameplayStart', 'gameplayStop'], false]);
  });

  it('still writes the voyage of a player who closes the tab mid-wave', () => {
    const { s, store, leave } = setup();
    s.world.wave = 4;
    for (let i = 0; i < 10; i++) s.update(FRAME);
    leave();
    expect(store.getItem(RUN_KEY)).toBeTruthy();
    expect([s.mode, s.pending]).toEqual(['play', false]);
  });
});
