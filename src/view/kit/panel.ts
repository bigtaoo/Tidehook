// The plates everything is drawn on: a panel over the lane (the shop, the harbour, a cover's
// card), a card the captain buys from, a tile in a grid. Each used to pick its own radius and edge
// width, so five "paper cards" came out with five different edges; they all come from tokens.ts now.

import { Graphics } from 'pixi.js';
import { P } from './palette';
import { RADIUS, STROKE } from './tokens';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlateOpts {
  /** The fill; walnut for a panel, paper for a card. */
  fill: number;
  /** The edge's colour. Brass marks the one in use (the sea sailed, the paint worn). */
  line?: number;
  /** The edge's width; a marked plate takes a heavier one, so colour is never the only cue. */
  width?: number;
  radius?: number;
  alpha?: number;
}

/** A rounded plate filling `r`, drawn into `g` (a new one by default) so a caller can lay several
 *  on one Graphics. */
export function plate(r: Rect, o: PlateOpts, g = new Graphics()): Graphics {
  g.roundRect(r.x, r.y, r.w, r.h, o.radius ?? RADIUS.card)
    .fill({ color: o.fill, alpha: o.alpha ?? 1 })
    .stroke({ color: o.line ?? P.line, width: o.width ?? STROKE.card });
  return g;
}

/** A panel over the lane: walnut, the panel radius and the heaviest edge. `g`: draw into this one
 *  instead of a new one, so a caller can put the panel in its child list before it knows how tall
 *  the panel will be (hud/overlay.ts draws its cover's words on top of it). */
export function panel(r: Rect, fill = P.woodDark, alpha = 1, g = new Graphics()): Graphics {
  return plate(r, { fill, alpha, radius: RADIUS.panel, width: STROKE.panel }, g);
}

/** A tile in a grid: a codex kind, a log entry, a paint. `mark`: it is the one in use. */
export function tile(r: Rect, fill: number, mark = false): Graphics {
  return plate(r, { fill, radius: RADIUS.tile, line: mark ? P.brass : P.line, width: mark ? STROKE.panel : STROKE.tile });
}
