import { describe, expect, it } from 'vitest';
import { Session } from '../session';
import { TapRecorder, type TapRecord } from './recorder';

const FRAME = 1000 / 60;

/** A recorded game in its first wave, the hook swinging. */
function recorded(): { s: Session; recs: TapRecord[]; run: (ms: number) => void } {
  const s = new Session({ seed: 3, speed: 1, autoplay: null, lagMs: 50 });
  const recs: TapRecord[] = [];
  const rec = new TapRecorder((r) => recs.push(r as TapRecord));
  s.tapWatch = (t) => rec.tap(s, t);
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += FRAME) {
      s.update(FRAME);
      rec.frame(s, FRAME, s.drain());
    }
  };
  s.tap();
  run(700);
  return { s, recs, run };
}

describe('the tap recorder', () => {
  it('records a cast with what was on the lane, then what came of it', () => {
    const { s, recs, run } = recorded();
    expect(s.world.hook.st).toBe('swing');
    s.tap();
    expect(recs).toHaveLength(0); // still out
    run(4000);
    expect(recs).toHaveLength(1);
    const r = recs[0];
    expect(r.fired).toBe(true);
    expect(r.seen.length).toBeGreaterThan(0);
    expect(Math.abs(r.cast)).toBeLessThanOrEqual(r.swing + 0.1);
    expect(r.out).toBeDefined();
    const out = r.out!;
    expect(out.got).toHaveLength(out.grabs.length);
    // closest first, and anything caught was touched
    for (let i = 1; i < out.near.length; i++) expect(out.near[i].gap).toBeGreaterThanOrEqual(out.near[i - 1].gap);
    for (const id of out.got) expect(out.near.find((n) => n.id === id)?.gap ?? 1).toBeLessThanOrEqual(0.5);
  });

  it('records a tap that did nothing, with the hook state', () => {
    const { s, recs, run } = recorded();
    s.tap();
    run(100);
    s.tap();
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({ n: 2, fired: false, st: 'out' });
    expect(recs[0].out).toBeUndefined();
  });

  it('closes an open cast when the next tap comes first', () => {
    const { s, recs } = recorded();
    s.tap();
    s.world.hook.st = 'swing'; // as if it were already home
    s.tap();
    expect(recs.map((r) => r.n)).toEqual([1]);
    expect(recs[0].out).toBeDefined();
  });
});
