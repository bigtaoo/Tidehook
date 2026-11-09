import { describe, expect, it } from 'vitest';
import { analyze, format, intent, judge, parse } from './analyze.mjs';
import { recFile, recLine } from './sink.mjs';

const fish = (id, ang, dist = 200, r = 14) => ({ id, what: 'fish', d: 0, w: 0, r, ang, dist });
const tap = (o) => ({ k: 'tap', n: 1, s: 1, fired: true, threw: false, dir: 1, shown: 0, cast: 0, back: 3, reach: 10, seen: [], ...o });

describe('rec analysis', () => {
  it('takes the target the shown aim passed closest to', () => {
    const t = tap({ shown: 10, seen: [fish(1, 30), fish(2, 13), fish(3, -40)] });
    expect(intent(t).id).toBe(2);
    expect(intent(tap({ shown: 10, seen: [fish(3, -40)] }))).toBeNull();
  });

  it('signs the error along the swing and splits off the drift', () => {
    const t = tap({
      shown: 10,
      cast: 8,
      dir: -1,
      seen: [fish(2, 13)],
      out: { grabs: [], got: [], bounce: false, hits: [], turn: 400, near: [{ id: 2, gap: 4, off: -1 }] },
    });
    const j = judge(t);
    // the fish sat at 13°, the hook swinging towards -: it was behind the aim, the tap came late
    expect(j.seenErr).toBe(-3);
    expect(j.castErr).toBe(-5);
    expect(j.drift).toBe(4);
    expect(j.caught).toBe(false);
  });

  it('counts a catch by id and sums up the misses', () => {
    const hit = tap({ seen: [fish(1, 2)], out: { grabs: ['fish'], got: [1], bounce: false, hits: [], turn: 300, near: [] } });
    const miss = tap({ n: 2, seen: [fish(1, 6)], cast: 0, out: { grabs: [], got: [], bounce: false, hits: [], turn: 800, near: [] } });
    const idle = { k: 'tap', n: 3, fired: false, st: 'back', seen: [] };
    const rep = analyze([{ k: 'start', at: 'x', w: 1, h: 2, wide: false, build: 'b' }, hit, miss, idle]);
    expect(rep.totals).toMatchObject({ taps: 3, fired: 2, ignored: 1, ignoredBy: { back: 1 }, meant: 2, caught: 1, early: 1 });
    expect(format(rep)).toContain('fish#1');
  });

  it('reads NDJSON and the sink writes it', () => {
    expect(parse('{"a":1}\n{bad\n\n{"b":2}')).toEqual([{ a: 1 }, { b: 2 }]);
    expect(recLine('{"k":"tap"}')).toBe('{"k":"tap"}\n');
    expect(recLine('[1]')).toBeNull();
    expect(recLine('nope')).toBeNull();
    expect(recFile('rec', new Date('2026-11-09T10:00:00Z')).replaceAll('\\', '/')).toBe('rec/rec-2026-11-09.ndjson');
  });
});
