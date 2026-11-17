import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SIZE_POLL_MS, SIZE_WAIT_MS, waitForSize } from './waitForSize';

/** A window stand-in whose size the test changes, firing resize like a browser. */
function fakeWindow(w: number, h: number) {
  const listeners = new Set<() => void>();
  return {
    innerWidth: w,
    innerHeight: h,
    addEventListener: (_: string, l: () => void) => void listeners.add(l),
    removeEventListener: (_: string, l: () => void) => void listeners.delete(l),
    resize(nw: number, nh: number) {
      this.innerWidth = nw;
      this.innerHeight = nh;
      for (const l of [...listeners]) l();
    },
    get listening() {
      return listeners.size;
    },
  };
}

describe('waitForSize', () => {
  it('goes on at once when the page has a size', async () => {
    await expect(waitForSize(fakeWindow(800, 450) as unknown as Window)).resolves.toBeUndefined();
  });

  it('waits out a zero-size iframe, then stops listening', async () => {
    const win = fakeWindow(0, 0);
    let done = false;
    const p = waitForSize(win as unknown as Window).then(() => (done = true));
    win.resize(300, 0);
    await Promise.resolve();
    expect(done).toBe(false);
    win.resize(300, 500);
    await p;
    expect(done).toBe(true);
    expect(win.listening).toBe(0);
  });

  describe('on a clock', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('goes on for a size that no resize ever announced', async () => {
      const win = fakeWindow(0, 0);
      let done = false;
      const p = waitForSize(win as unknown as Window).then(() => (done = true));
      // the iframe is laid out and never tells its own window
      win.innerWidth = 360;
      win.innerHeight = 640;
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(SIZE_POLL_MS);
      await p;
      expect(done).toBe(true);
      expect(win.listening).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('boots on a page that stays at nothing rather than waiting for ever', async () => {
      const win = fakeWindow(0, 0);
      const p = waitForSize(win as unknown as Window);
      await vi.advanceTimersByTimeAsync(SIZE_WAIT_MS + SIZE_POLL_MS);
      await expect(p).resolves.toBeUndefined();
      expect(win.listening).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
