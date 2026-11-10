// The lane's still parts, drawn once per layout (a resize, a turn of the phone): the chart sea with
// the pier (art.ts seaTex, turned so the pier is at the dock end), dotted depth lines where the
// fish value steps up, and the lane's edge. Without the picture (tests, a failed load) the water is
// flat bands and the dock planks. Over it, the sea's weather (drawWeather). Everything that moves
// is actors.ts.

import { Container, Graphics, Sprite } from 'pixi.js';
import { B } from '../../sim/balance';
import { LANE_LEN, LANE_WIDTH } from '../../sim/lane';
import { FP } from '../../sim/math/fixed';
import { seaTex } from '../art';
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

/** The depth lines: dash and gap along the line, world units. */
const DASH = 9;
const DASH_GAP = 9;

/** A lane rectangle from distance d0 to d1, across the whole width, in design units. */
export function bandRect(f: Field, d0: number, d1: number): { x: number; y: number; w: number; h: number } {
  const a = toDesign(f, d0, 0);
  const b = toDesign(f, d1, LANE_WIDTH);
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

export function drawField(f: Field): Container {
  const box = new Container();
  const t = seaTex();
  const lane = bandRect(f, 0, LANE_LEN);
  const g = new Graphics();
  if (t) {
    const s = new Sprite(t);
    s.anchor.set(0.5);
    s.position.set(lane.x + lane.w / 2, lane.y + lane.h / 2);
    // the picture runs along its width; portrait turns it a quarter left, pier to the bottom
    if (!f.wide) s.rotation = -Math.PI / 2;
    const along = f.wide ? lane.w : lane.h;
    const across = f.wide ? lane.h : lane.w;
    s.scale.set(along / t.width, across / t.height);
    box.addChild(s);
    for (const b of BANDS.slice(2)) depthLine(g, f, b.from);
  } else {
    for (const b of BANDS) {
      const r = bandRect(f, b.from, b.to);
      g.rect(r.x, r.y, r.w, r.h).fill(b.color);
    }
    for (const b of BANDS.slice(1)) {
      const r = bandRect(f, b.from, b.from);
      g.rect(r.x - 2, r.y - 2, Math.max(r.w, 4), Math.max(r.h, 4)).fill(SEA.seam);
    }
    for (let d = 28; d < DOCK; d += 28) {
      const r = bandRect(f, d, d);
      g.rect(r.x, r.y - 1.5, Math.max(r.w, 3), Math.max(r.h, 3)).fill(P.woodDark);
    }
  }
  g.rect(lane.x, lane.y, lane.w, lane.h).stroke({ color: P.line, width: 6 });
  box.addChild(g);
  return box;
}

/** A chart's dotted depth contour across the lane at distance `d`. */
function depthLine(g: Graphics, f: Field, d: number): void {
  for (let w = DASH_GAP / 2; w < LANE_WIDTH; w += DASH + DASH_GAP) {
    const a = toDesign(f, d, w);
    const b = toDesign(f, d, Math.min(w + DASH, LANE_WIDTH));
    g.moveTo(a.x, a.y).lineTo(b.x, b.y);
  }
  g.stroke({ color: P.cream, width: 2.5 * f.scale, alpha: 0.35 });
}

/** The weather over the water of sea `id` (sim/seas.ts): mist thickening out to sea in the Fog
 *  Bank, a dark sky in the Storm Reach, nothing in the home bay. */
export function drawWeather(g: Graphics, f: Field, id: string): void {
  g.clear();
  if (id === 'fog') {
    // thicker the farther out: four steps from the dock's edge to the far end
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      const d0 = DOCK + ((LANE_LEN - DOCK) * i) / steps;
      const r = bandRect(f, d0, d0 + (LANE_LEN - DOCK) / steps);
      g.rect(r.x, r.y, r.w, r.h).fill({ color: SEA.fog, alpha: 0.12 + 0.1 * i });
    }
  } else if (id === 'storm') {
    const r = bandRect(f, DOCK, LANE_LEN);
    g.rect(r.x, r.y, r.w, r.h).fill({ color: SEA.storm, alpha: 0.32 });
  }
}
