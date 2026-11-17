import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WATCH_MS, watchSize } from './watchSize';

describe('watchSize', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('tells the renderer about a size no resize event announced', () => {
    // the game booted on an iframe still at nothing (view/waitForSize.ts); without this it would
    // hold a canvas of nothing for the whole session, with nothing wrong to report
    const box = { w: 0, h: 0 };
    const seen: Array<[number, number]> = [];
    watchSize(() => ({ ...box }), () => seen.push([box.w, box.h]));
    vi.advanceTimersByTime(WATCH_MS * 3);
    expect(seen).toEqual([]);
    box.w = 360;
    box.h = 640;
    vi.advanceTimersByTime(WATCH_MS);
    expect(seen).toEqual([[360, 640]]);
    // and again on the next move, but not for a size that stayed put
    vi.advanceTimersByTime(WATCH_MS * 3);
    box.h = 540;
    vi.advanceTimersByTime(WATCH_MS);
    expect(seen).toEqual([[360, 640], [360, 540]]);
  });

  it('stops watching when told to', () => {
    const box = { w: 10, h: 10 };
    let hits = 0;
    const stop = watchSize(() => ({ ...box }), () => void hits++);
    stop();
    box.w = 20;
    vi.advanceTimersByTime(WATCH_MS * 4);
    expect(hits).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
