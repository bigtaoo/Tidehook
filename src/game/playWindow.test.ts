import { describe, expect, it } from 'vitest';
import { PlayWindow } from './playWindow';
import { StubPlatform } from '../platform/stub';

/** A document stand-in whose tab the test hides. */
function fakeDoc() {
  const listeners = new Set<() => void>();
  return {
    hidden: false,
    addEventListener: (_: string, l: () => void) => void listeners.add(l),
    hide(on: boolean) {
      this.hidden = on;
      for (const l of [...listeners]) l();
    },
  };
}

describe('PlayWindow', () => {
  it('tells the host only when the window changes', () => {
    const platform = new StubPlatform();
    const win = new PlayWindow(platform, fakeDoc() as unknown as Document);
    win.set(false);
    win.set(true);
    win.set(true);
    win.set(false);
    expect(platform.calls).toEqual(['gameplayStart', 'gameplayStop']);
  });

  it('closes the window when the tab goes, without waiting for a frame', () => {
    // the ticker stops with the tab, so a stop left to the next frame would reach the host when
    // the player comes back - or never, and the host would count them as playing all the while
    const platform = new StubPlatform();
    const doc = fakeDoc();
    const win = new PlayWindow(platform, doc as unknown as Document);
    win.set(true);
    doc.hide(true);
    expect(platform.calls).toEqual(['gameplayStart', 'gameplayStop']);
    expect(win.open).toBe(false);
    // coming back does not reopen it by itself: the voyage is paused and waits for a tap
    doc.hide(false);
    expect(platform.calls).toEqual(['gameplayStart', 'gameplayStop']);
  });
});
