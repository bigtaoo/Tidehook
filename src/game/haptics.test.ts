import { describe, expect, it } from 'vitest';
import { Haptics, webBuzz } from './haptics';
import type { SimEvent } from '../sim/events';

/** A window that only remembers its listeners, so a test can fire the first gesture by hand. */
function fakeWin() {
  const on = new Map<string, Set<EventListener>>();
  return {
    addEventListener: (e: string, f: EventListener) => void (on.get(e) ?? on.set(e, new Set()).get(e)!).add(f),
    removeEventListener: (e: string, f: EventListener) => void on.get(e)?.delete(f),
    fire: (e: string) => on.get(e)?.forEach((f) => f(new Event(e))),
    count: () => [...on.values()].reduce((n, s) => n + s.size, 0),
  };
}

function fakeNav(log: (number | number[])[]) {
  return { vibrate: (p: number | number[]) => void log.push(p) } as unknown as Navigator;
}

const coins: SimEvent = { e: 'coins', amount: 3, spat: false };
const leak: SimEvent = { e: 'leak', kind: 'grunt', dmg: 1 };
const kill = (kind: 'boss' | 'grunt'): SimEvent => ({ e: 'kill', id: 1, kind, crushed: false, d: 0, w: 0 });

describe('webBuzz', () => {
  it('is null where the browser cannot vibrate', () => {
    expect(webBuzz(undefined, fakeWin())).toBeNull();
    expect(webBuzz({} as Navigator, fakeWin())).toBeNull();
  });

  it('stays quiet until the player has touched the page, then buzzes', () => {
    const log: (number | number[])[] = [];
    const win = fakeWin();
    const buzz = webBuzz(fakeNav(log), win)!;
    buzz(12);
    expect(log).toEqual([]);
    win.fire('pointerdown');
    buzz(12);
    expect(log).toEqual([12]);
  });

  it('drops its listeners once it has seen the gesture', () => {
    const win = fakeWin();
    webBuzz(fakeNav([]), win);
    expect(win.count()).toBe(3);
    win.fire('keydown');
    expect(win.count()).toBe(0);
  });

  it('survives a host frame that refuses to vibrate', () => {
    const win = fakeWin();
    const nav = {
      vibrate: () => {
        throw new Error('blocked');
      },
    } as unknown as Navigator;
    const buzz = webBuzz(nav, win)!;
    win.fire('touchend');
    expect(() => buzz(12)).not.toThrow();
  });
});

describe('Haptics', () => {
  it('says whether the device can buzz at all', () => {
    expect(new Haptics(null, () => true).able).toBe(false);
    expect(new Haptics(() => {}, () => true).able).toBe(true);
  });

  it('is silent with the setting off', () => {
    const log: (number | number[])[] = [];
    const h = new Haptics((p) => void log.push(p), () => false);
    expect(h.events([coins], 0)).toBeNull();
    expect(log).toEqual([]);
  });

  it('buzzes for a boss sunk, and for nothing smaller', () => {
    const log: (number | number[])[] = [];
    const h = new Haptics((p) => void log.push(p), () => true);
    expect(h.events([kill('boss')], 0)).toEqual([60, 40, 90]);
    expect(h.events([kill('grunt')], 500)).toBeNull();
    // a fish the hook spat out is not a catch
    expect(h.events([{ e: 'coins', amount: 1, spat: true }], 900)).toBeNull();
    expect(log).toEqual([[60, 40, 90]]);
  });

  it('drops a small buzz that follows too close, but never a big one', () => {
    const log: (number | number[])[] = [];
    const h = new Haptics((p) => void log.push(p), () => true);
    expect(h.events([coins], 0)).toBe(12);
    expect(h.events([coins], 50)).toBeNull();
    expect(h.events([coins], 200)).toBe(12);
    expect(h.events([leak], 210)).toEqual([35, 50, 35]);
    expect(log).toEqual([12, 12, [35, 50, 35]]);
  });
});
