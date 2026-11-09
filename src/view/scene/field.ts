// The lane's still parts: the dock's planks and the water's bands as flat shapes, drawn once per
// layout (a resize, a turn of the phone). Everything that moves is actors.ts.

import { Graphics } from 'pixi.js';
import { B } from '../../sim/balance';
import { LANE_LEN, LANE_WIDTH } from '../../sim/lane';
import { FP } from '../../sim/math/fixed';
import { P, SEA } from '../kit/palette';
import { toDesign, type Field } from '../orient';

const DOCK = B.dock.edge / FP;

/** The bands by distance from the dock, in world units: the dock, then the water split into
 *  thirds of the fish value's distance range, so a band is a price step. */
export const BANDS: readonly { from: number; to: number; color: number }[] = [
  { from: 0, to: DOCK, color: P.wood },
  { from: DOCK, to: 371, color: SEA.shallow },
  { from: 371, to: 561, color: SEA.mid },
  { from: 561, to: LANE_LEN, color: SEA.far },
];

/** A lane rectangle from distance d0 to d1, across the whole width, in design units. */
export function bandRect(f: Field, d0: number, d1: number): { x: number; y: number; w: number; h: number } {
  const a = toDesign(f, d0, 0);
  const b = toDesign(f, d1, LANE_WIDTH);
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

export function drawField(f: Field): Graphics {
  const g = new Graphics();
  for (const b of BANDS) {
    const r = bandRect(f, b.from, b.to);
    g.rect(r.x, r.y, r.w, r.h).fill(b.color);
  }
  for (const b of BANDS.slice(1)) {
    const r = bandRect(f, b.from, b.from);
    g.rect(r.x - 2, r.y - 2, Math.max(r.w, 4), Math.max(r.h, 4)).fill(SEA.seam);
  }
  // planks across the dock
  for (let d = 28; d < DOCK; d += 28) {
    const r = bandRect(f, d, d);
    g.rect(r.x, r.y - 1.5, Math.max(r.w, 3), Math.max(r.h, 3)).fill(P.woodDark);
  }
  const lane = bandRect(f, 0, LANE_LEN);
  g.rect(lane.x, lane.y, lane.w, lane.h).stroke({ color: P.line, width: 6 });
  return g;
}
