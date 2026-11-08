import { describe, expect, it } from 'vitest';
import { waitForSize } from './waitForSize';

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
});
