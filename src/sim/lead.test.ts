import { describe, expect, it } from 'vitest';
import type { MonsterKind } from './balance';
import { B } from './balance';
import { throwFirst } from './lead';
import { toFp } from './math/fixed';
import { BRAD_FULL } from './math/trig';
import { spawn } from './monsters';
import { rayFirst } from './ray';
import { startGame, step } from './step';
import { throwJunk } from './throw';
import type { World } from './world';

interface Scene {
  kind: MonsterKind;
  /** Where the monster starts, world units. */
  d: number;
  w: number;
  /** A fish to lure it, or none. */
  fish?: { d: number; w: number };
  /** Ticks played before the throw, so a darter is mid-weave. */
  pre: number;
}

/** The recorded misses: a grunt near the left wall walking sideways to a fish 59 away, and a
 *  darter weaving across its path. */
const LURED: Scene = { kind: 'grunt', d: 640, w: 55, fish: { d: 650, w: 150 }, pre: 1 };
const WEAVING: Scene = { kind: 'darter', d: 620, w: 260, pre: 17 };

function scene(sc: Scene): { w: World; id: number } {
  const w = startGame(1);
  const fish = w.items.find((it) => it.kind === 'fish');
  if (!fish) throw new Error('no fish to place');
  w.queue = [];
  w.mons = [];
  w.items = [];
  if (sc.fish) {
    fish.d = toFp(sc.fish.d);
    fish.w = toFp(sc.fish.w);
    w.items = [fish];
  }
  const m = spawn(w, sc.kind);
  m.d = toFp(sc.d);
  m.w = toFp(sc.w);
  for (let i = 0; i < sc.pre; i++) step(w);
  return { w, id: m.id };
}

/** Whether junk thrown along `ang` hits the monster, played out by the sim's own step. */
function hits(sc: Scene, ang: number): boolean {
  const { w, id } = scene(sc);
  throwJunk(w, ang);
  for (let i = 0; i < 60 && w.shots.length > 0; i++) {
    const m = w.mons.find((o) => o.id === id);
    if (!m) return true;
    const hp = m.hp;
    step(w);
    if (m.hp < hp || !w.mons.includes(m)) return true;
  }
  return false;
}

/** Sweeps the aims across the monster: how many hit, and how many the standing ray got wrong. */
function sweep(sc: Scene, from: number, to: number): { hit: number; staticWrong: number } {
  let hit = 0;
  let staticWrong = 0;
  for (let ang = Math.round(from); ang < to; ang += 20) {
    const { w } = scene(sc);
    const h = hits(sc, ang);
    expect(throwFirst(w, ang) !== null, `${sc.kind} ang ${ang}`).toBe(h);
    if (h) hit++;
    if ((rayFirst(w, ang, true, B.throw.radius)?.o.t === 'mon') !== h) staticWrong++;
  }
  return { hit, staticWrong };
}

describe('the throw leads a moving monster', () => {
  it('marks a lured grunt exactly at the aims that hit it', () => {
    const r = sweep(LURED, -BRAD_FULL / 12, 0);
    expect(r.hit).toBeGreaterThan(20);
    // the old sight took the grunt to stand still: by the time the junk got there it had walked
    // out of most of the aims it marked
    expect(r.staticWrong).toBeGreaterThan(r.hit / 2);
  });

  it('marks a weaving darter exactly at the aims that hit it', () => {
    const r = sweep(WEAVING, -BRAD_FULL / 24, BRAD_FULL / 24);
    expect(r.hit).toBeGreaterThan(20);
    expect(r.staticWrong).toBeGreaterThan(10);
  });
});
