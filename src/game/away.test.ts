import { describe, expect, it } from 'vitest';
import { watchAway } from './away';

/** A window that only remembers its listeners, so a test can look away by hand. */
function fakeWin() {
  const on = new Map<string, Set<EventListener>>();
  return {
    addEventListener: (e: string, f: EventListener) => void (on.get(e) ?? on.set(e, new Set()).get(e)!).add(f),
    removeEventListener: (e: string, f: EventListener) => void on.get(e)?.delete(f),
    fire: (e: string) => on.get(e)?.forEach((f) => f(new Event(e))),
    count: () => [...on.values()].reduce((n, s) => n + s.size, 0),
  };
}

describe('watchAway', () => {
  it('pauses when the window loses focus, every time', () => {
    const win = fakeWin();
    let away = 0;
    watchAway(win, () => away++);
    expect(away).toBe(0);
    win.fire('blur');
    win.fire('blur');
    expect(away).toBe(2);
  });

  it('says nothing at boot, where a portal frame starts without the focus', () => {
    const win = fakeWin();
    let away = 0;
    watchAway(win, () => away++);
    // nothing has happened yet: no listener has been fired, and the game is not paused
    expect(away).toBe(0);
    expect(win.count()).toBe(1);
  });

  it('lets go of its listeners', () => {
    const win = fakeWin();
    let away = 0;
    const stop = watchAway(win, () => away++);
    stop();
    expect(win.count()).toBe(0);
    win.fire('blur');
    expect(away).toBe(0);
  });
});
