// The throw's sight: while the crane holds junk, the aim reaches as far as the shot would fly, to
// the first monster it would hit (that one gets marked) or out of the lane. A short aim made the
// player stretch it by eye to a monster 700 out, where the shot has a couple of degrees to spare.
// It leads a walking monster (sim/lead.ts): the line stops where the junk will meet it, a little
// ahead of where it stands now.

import { B } from '../../sim/balance';
import { LANE_LEN, LANE_WIDTH } from '../../sim/lane';
import { FP } from '../../sim/math/fixed';
import { BRAD_FULL } from '../../sim/math/trig';
import { throwFirst } from '../../sim/lead';
import type { Monster, World } from '../../sim/world';

const T = B.throw;

/** Where a throw along `ang` (brads) stops, world units from the crane, and the monster it hits. */
export function throwSight(w: World, ang: number): { len: number; m: Monster | null } {
  const hit = throwFirst(w, ang);
  if (hit) return { len: hit.len / FP, m: hit.m };
  return { len: laneExit(ang), m: null };
}

/** How far along `ang` (brads) from the crane the aim meets the lane's edge, world units. The shot
 *  flies on a little past it (`B.throw.margin`), but the line stops at the edge drawn. */
export function laneExit(ang: number): number {
  const a = (ang / BRAD_FULL) * Math.PI * 2;
  const ud = Math.cos(a);
  const uw = Math.sin(a);
  const d0 = B.crane.d / FP;
  const w0 = B.crane.w / FP;
  let len = Infinity;
  if (ud > 1e-6) len = Math.min(len, (LANE_LEN - d0) / ud);
  if (ud < -1e-6) len = Math.min(len, ((B.dock.edge - T.behindDock) / FP - d0) / ud);
  if (uw > 1e-6) len = Math.min(len, (LANE_WIDTH - w0) / uw);
  if (uw < -1e-6) len = Math.min(len, -w0 / uw);
  return len;
}
