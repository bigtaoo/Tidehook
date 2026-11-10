// What a throw along the aim would hit, with the monsters moving on while the junk flies. A shot
// takes most of a second to cross the lane: a grunt lured sideways by a fish, or a darter weaving,
// moved out of the line it was on when the sight marked it (recorded misses, docs/01-tech-plan.md
// section 3). So each monster's next ticks are played out on a copy, by the same heading and walk
// monsters.ts uses (a stop to eat, a stun or the calm's hold included), and the junk is tested
// against where the monster will be when it gets there. A tap fires between ticks, and within a
// tick the shot moves before the monsters do, so their k-th move comes on tick `w.tick + 1 + k`.

import { B } from './balance';
import { LANE_LEN_FP, LANE_WIDTH_FP } from './lane';
import { dist, muldiv } from './math/fixed';
import { cosB, sinB } from './math/trig';
import { divingAt } from './kinds';
import { CALM_D, heading, walk } from './monsters';
import type { Monster, World } from './world';

const T = B.throw;

type Spot = { d: number; w: number };

/** A monster's coming spots, `at[k]` after k more ticks, played out as far as asked. */
class Path {
  private readonly c: Monster;
  readonly at: Spot[];

  constructor(
    private readonly world: World,
    m: Monster,
  ) {
    this.c = { ...m };
    this.at = [{ d: m.d, w: m.w }];
  }

  spot(k: number): Spot {
    while (this.at.length <= k) this.next();
    return this.at[k];
  }

  private next(): void {
    const { world: w, c } = this;
    const tick = w.tick + this.at.length;
    if (c.stun > 0) c.stun--;
    else if (!c.eat) {
      const g = heading(w, c);
      if (g.eat) c.eat = g.eat.id;
      else if (!(w.calm === 2 && c.d <= CALM_D)) walk(tick, c, g.d, g.w, B.monsters[c.kind].swims);
    }
    this.at.push({ d: c.d, w: c.w });
  }
}

/**
 * The first monster junk thrown along `ang` (brads) now would hit, and how far out (FP) it meets
 * it, or null when the shot leaves the lane first.
 */
export function throwFirst(w: World, ang: number): { m: Monster; len: number } | null {
  const ud = cosB(ang);
  const uw = sinB(ang);
  const paths = w.mons.filter((m) => !m.grab).map((m) => ({ m, p: new Path(w, m) }));
  // the shot's own walk (throw.ts): `speed` a tick, in steps of `step`, the monsters moved k times
  let sd = B.crane.d + muldiv(ud, T.offset, 1000);
  let sw = B.crane.w + muldiv(uw, T.offset, 1000);
  let len = T.offset;
  for (let k = 0; ; k++) {
    for (let mv = T.speed; mv > 0; ) {
      const st = Math.min(T.step, mv);
      mv -= st;
      len += st;
      sd += muldiv(ud, st, 1000);
      sw += muldiv(uw, st, 1000);
      if (sw < -T.margin || sw > LANE_WIDTH_FP + T.margin || sd > LANE_LEN_FP + T.margin || sd < B.dock.edge - T.behindDock) {
        return null;
      }
      let best: Monster | null = null;
      let bd = 0;
      for (const { m, p } of paths) {
        const at = p.spot(k);
        if (divingAt(w.tick + 1 + k, m.kind, at.d, m.ph)) continue;
        const gap = dist(at.d - sd, at.w - sw) - m.r - T.radius;
        if (gap < bd) {
          bd = gap;
          best = m;
        }
      }
      if (best) return { m: best, len };
    }
  }
}
