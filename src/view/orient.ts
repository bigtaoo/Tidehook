// The one place that knows the screen's orientation: the lane's (d, w) in world units (sim/lane.ts)
// to design units and back. Portrait puts the dock at the bottom with the sea going up
// (x = w, y = bottom - d); landscape puts it on the left with the sea going right (x = d, y = w),
// with the HUD sidebar on that same left edge, so the dock's numbers stay beside the dock.
// HUD and shop bars are not turned: they take a band of their own (docs/01-tech-plan.md section 4).

import { LANE_LEN, LANE_WIDTH } from '../sim/lane';
import { DESIGN_LONG, DESIGN_SHORT } from './viewport';

/** Portrait: the HUD strip across the top and the shop bar under the dock, in design units. */
export const PORTRAIT_TOP = 140;
export const PORTRAIT_BOTTOM = 300;
/** Landscape: the HUD sidebar down the left, on the dock's side - the dock's hit points and its
 *  bar belong beside the dock they count, as they do under it in portrait. The lane takes the rest. */
export const LANDSCAPE_SIDE = 360;
/** Portrait: the band between the top strip and the lane that a hint banner shows in
 *  (hud/frame.ts draws it there, inset by a gap). The lane stops below it, so a hint cannot
 *  cover the far end - which is where the monster it is naming has just swum in. A phone pays
 *  nothing for it: the lane there is as wide as the design allows, so the band comes out of
 *  length the lane could not have used anyway. Landscape keeps the banner over the lane's top
 *  edge: the lane runs the other way there, so a hint hides a strip of open water rather than
 *  the arrivals, and a band would cost the lane a seventh of its size. */
export const PORTRAIT_HINT = 178;

export interface Field {
  wide: boolean;
  /** Design units per world unit. */
  scale: number;
  /** The lane's rectangle in design units. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where the lane sits in a design `designW` wide and `designH` tall (viewport.ts fitDesign), as
 *  large as it fits beside the bars and, in portrait, under the hint band, centred in the rest. */
export function fieldFor(wide: boolean, designW = wide ? DESIGN_LONG : DESIGN_SHORT, designH = wide ? DESIGN_SHORT : DESIGN_LONG): Field {
  const top = wide ? 0 : PORTRAIT_TOP + PORTRAIT_HINT;
  const roomW = wide ? designW - LANDSCAPE_SIDE : designW;
  const roomH = (wide ? designH : designH - PORTRAIT_BOTTOM) - top;
  const along = wide ? roomW : roomH;
  const across = wide ? roomH : roomW;
  const scale = Math.min(along / LANE_LEN, across / LANE_WIDTH);
  const w = (wide ? LANE_LEN : LANE_WIDTH) * scale;
  const h = (wide ? LANE_WIDTH : LANE_LEN) * scale;
  const x = (roomW - w) / 2;
  const y = top + (roomH - h) / 2;
  return { wide, scale, x: wide ? LANDSCAPE_SIDE + x : x, y, w, h };
}

/** A lane point (world units, floats on the view side) to design units. */
export function toDesign(f: Field, d: number, w: number): { x: number; y: number } {
  if (f.wide) return { x: f.x + d * f.scale, y: f.y + w * f.scale };
  return { x: f.x + w * f.scale, y: f.y + f.h - d * f.scale };
}

/** A design point (a tap) back to the lane, the inverse of toDesign. */
export function toLane(f: Field, x: number, y: number): { d: number; w: number } {
  if (f.wide) return { d: (x - f.x) / f.scale, w: (y - f.y) / f.scale };
  return { d: (f.y + f.h - y) / f.scale, w: (x - f.x) / f.scale };
}
