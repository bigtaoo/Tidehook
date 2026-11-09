// What the hook would hit if cast now: a walk out along the aim (the prototype's rayFirst). The
// bots decide by it, and the tutorial lights the aim line gold when it finds what a step asks for.

import { B } from './balance';
import { hitAt, type Target } from './collide';
import { LANE_LEN_FP, LANE_WIDTH_FP } from './lane';
import { toFp } from './math/fixed';
import { cosB, sinB } from './math/trig';
import type { World } from './world';

const RAY_START = toFp(16);
const RAY_END = toFp(1200);
const RAY_STEP = toFp(6);
/** The bots' leeway for a monster, which walks while the hook flies. */
const RAY_MON = toFp(15);

/**
 * The first thing along aim `ang` (brads), and how far out; monsters only when `monsOnly`. The
 * walk tests a circle of radius `r`: by default the hook's tip for items and the bots' leeway for
 * monsters.
 */
export function rayFirst(
  w: World,
  ang: number,
  monsOnly: boolean,
  r: number = monsOnly ? RAY_MON : B.hook.tip,
): { o: Target; len: number } | null {
  const ud = cosB(ang);
  const uw = sinB(ang);
  for (let len = RAY_START; len < RAY_END; len += RAY_STEP) {
    const d = B.crane.d + Math.trunc((ud * len) / 1000);
    const pw = B.crane.w + Math.trunc((uw * len) / 1000);
    if (pw < -B.hook.margin || pw > LANE_WIDTH_FP + B.hook.margin || d > LANE_LEN_FP + B.hook.margin) return null;
    const o = hitAt(w, d, pw, r, monsOnly);
    if (o) return { o, len };
  }
  return null;
}
