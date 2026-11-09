// The one place that knows the screen's orientation: the lane's (d, w) in world units (sim/lane.ts)
// to design units and back. Portrait puts the dock at the bottom with the sea going up
// (x = w, y = bottom - d); landscape puts it on the left with the sea going right (x = d, y = w).
// HUD and shop bars are not turned: they take a band of their own (docs/01-tech-plan.md section 4).

import { LANE_LEN, LANE_WIDTH } from '../sim/lane';
import { DESIGN_LONG, DESIGN_SHORT } from './viewport';

/** Portrait: the HUD strip across the top and the shop bar under the dock, in design units. */
export const PORTRAIT_TOP = 140;
export const PORTRAIT_BOTTOM = 300;
/** Landscape: the HUD and shop sidebar down the right. */
export const LANDSCAPE_SIDE = 360;

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

/** Where the lane sits in the design, as large as it fits beside the bars, centred in the rest. */
export function fieldFor(wide: boolean): Field {
  const roomW = wide ? DESIGN_LONG - LANDSCAPE_SIDE : DESIGN_SHORT;
  const roomH = wide ? DESIGN_SHORT : DESIGN_LONG - PORTRAIT_TOP - PORTRAIT_BOTTOM;
  const along = wide ? roomW : roomH;
  const across = wide ? roomH : roomW;
  const scale = Math.min(along / LANE_LEN, across / LANE_WIDTH);
  const w = (wide ? LANE_LEN : LANE_WIDTH) * scale;
  const h = (wide ? LANE_WIDTH : LANE_LEN) * scale;
  const x = (roomW - w) / 2;
  const y = (wide ? 0 : PORTRAIT_TOP) + (roomH - h) / 2;
  return { wide, scale, x: wide ? 0 : x, y, w, h };
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
