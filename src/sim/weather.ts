// The seas' weather (docs/04-content.md section 3.5). The Fog Bank hides what is farther out than
// its fog line: the view fades it out over B.weather.fogBand, the swing does not slow for a catch in
// the fog, and the bots do not see it either. The Storm Reach's gusts bend a cast hook sideways as
// it flies, more the farther it goes, swinging from one side to the other and back over
// B.weather.gustTicks; the view shows the gust, so a player can aim into it. Both deterministic: the
// gust follows the world's tick, never a random draw, so the bay's games are unchanged.

import { B } from './balance';
import { LANE_LEN_FP } from './lane';
import { muldiv } from './math/fixed';
import { BRAD_FULL, sinB } from './math/trig';
import { seaOf } from './seas';
import type { World } from './world';

/** The fog line, FP out from the crane: beyond it nothing is seen. 0 when the sea is clear. */
export function fogLine(w: World): number {
  return seaOf(w).fog;
}

/** Whether a lane point `d` out is in sight. */
export function seen(w: World, d: number): boolean {
  const fog = fogLine(w);
  return fog <= 0 || d - B.crane.d <= fog;
}

/** How much of a thing `d` out shows, permille: all of it inside the fog line, none past its band. */
export function clarity(w: World, d: number): number {
  const fog = fogLine(w);
  if (fog <= 0) return 1000;
  const past = d - B.crane.d - fog;
  if (past <= 0) return 1000;
  return Math.max(0, 1000 - muldiv(past, 1000, B.weather.fogBand));
}

/** The gust now, brads of bend over a lane's length of rope; signed, 0 on a calm sea. */
export function gust(w: World): number {
  const wind = seaOf(w).wind;
  if (!wind) return 0;
  const ph = Math.floor(((w.tick % B.weather.gustTicks) * BRAD_FULL) / B.weather.gustTicks);
  return muldiv(wind, sinB(ph), 1000);
}

/** The bend, brads, the gust gives a hook flying `step` FP farther. */
export function drift(w: World, step: number): number {
  const g = gust(w);
  return g ? muldiv(g, step, LANE_LEN_FP) : 0;
}
