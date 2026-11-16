// The hit point pips under a monster, drawn from two shapes that are tessellated once instead of
// rebuilt every frame. A late wave puts a dozen monsters of a dozen hit points on the lane, and
// re-cutting ~170 little circles and squares per frame cost more than the rest of the scene put
// together (1.5 ms of a 1.9 ms frame on a desktop, so a phone's whole frame budget). Pixi v8 lets
// several Graphics share one GraphicsContext: the two pips are built at unit size, and each one on
// screen is a pooled Graphics placed and scaled to the row's pip radius.

import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { HEAVY, P } from '../kit/palette';
import type { Bars } from './look';

/** The layered bar's height and the gap between one sheet and the next, both in screen pixels
 *  before the layout scale. */
const BAR_H = 5;
/** A boss's bar, which the player reads from across the lane, is drawn this tall instead. */
const BOSS_H = 8;
/** The gap between one sheet of the pile and the next, in screen pixels before the layout scale. */
const SHEET = 1.6;
/** Each sheet still to come is drawn this much of the one above it, in width and in height, and
 *  this much of its opacity: four equal bars stacked read as four separate things nobody can
 *  name, while a pile that tapers away reads as one bar with more health behind it. */
const SHEET_TAPER = 0.78;
const SHEET_FADE = 0.84;
/** The nearest sheet's opacity, and how thin a sheet is ever drawn (screen pixels). */
const SHEET_ALPHA = 0.62;
const SHEET_MIN = 2.5;
/** A notch is cut between every two points of damage on the top sheet while each point is at
 *  least this many screen pixels wide: that is what turns a draining bar into a count of the
 *  hits still to come. Below it the notches would be a texture, so the bar goes bare. */
const NOTCH_STEP = 5;
/** How wide a notch is cut, in screen pixels before the layout scale. */
const NOTCH_W = 1.4;
/** However many layers are left, no more sheets than this are drawn under the top one: past four
 *  the stack only crowds the lane, and the top sheet is what the player watches. */
const MAX_SHEETS = 4;

/** The health bar under a monster with more hit points than a row of pips can show (look.ts
 *  bars): `left` sheets piled up, the top one `fill` full, centred on (x, y) and `w` wide. Pips
 *  stop at twelve, so without this a boss of forty took twenty-eight hits with nothing to show
 *  for them. Few shapes and only for the few deep monsters on a lane, so it is drawn straight
 *  into the frame's Graphics rather than pooled. The top sheet is notched into its points of
 *  damage, so the player can count the hits left instead of guessing at a shrinking stripe;
 *  `big` for a boss, whose bar is drawn taller. */
export function drawBar(g: Graphics, x: number, y: number, w: number, k: number, b: Bars, steel: boolean, big = false): void {
  const h = (big ? BOSS_H : BAR_H) * k;
  const x0 = x - w / 2;
  const paint = steel ? HEAVY : P.cream;
  // the sheets still to come, piled under the draining one and filled, like the full sheets they
  // are. They used to peek out from behind it by a pixel or two, empty: on a phone that is a
  // smudge, and a boss at two thirds health read as an all but empty bar. Then they were drawn at
  // the top sheet's own size, and a boss carried four bars of the same weight under it with
  // nothing to say which one was its health. So the pile tapers: every sheet narrower, flatter
  // and fainter than the one above, which puts the draining bar at the top of a heap that
  // visibly runs out.
  let ww = w;
  let hh = h;
  let alpha = SHEET_ALPHA;
  let yy = y + h + SHEET * k;
  for (let i = 1; i <= Math.min(b.left - 1, MAX_SHEETS); i++) {
    ww *= SHEET_TAPER;
    hh = Math.max(SHEET_MIN * k, hh * SHEET_TAPER);
    g.roundRect(x - ww / 2, yy, ww, hh, hh / 2).fill({ color: paint, alpha }).stroke({ color: P.line, width: 1.2 * k, alpha: 0.55 });
    yy += hh + SHEET * k;
    alpha *= SHEET_FADE;
  }
  g.roundRect(x0, y, w, h, h / 2).fill({ color: P.line, alpha: 0.45 });
  if (b.fill > 0) g.roundRect(x0, y, Math.max(h, w * b.fill), h, h / 2).fill(paint);
  const step = w / b.size;
  if (step >= NOTCH_STEP * k) {
    const nw = NOTCH_W * k;
    for (let i = 1; i < b.size; i++) g.roundRect(x0 + i * step - nw / 2, y, nw, h, 0).fill({ color: P.line, alpha: 0.55 });
  }
  g.roundRect(x0, y, w, h, h / 2).stroke({ color: P.line, width: 1.6 * k });
}

/** A pip's outline, in pip radii: the row scales by the radius, and because the radius is always
 *  2.6 times the field's scale and the line 1.2 times it, their ratio does not move with layout. */
const LINE = 1.2 / 2.6;
/** A heavy pip is a square of this half-width, in pip radii. */
const SQUARE = 1.05;

const light = new GraphicsContext().circle(0, 0, 1).fill(P.cream).stroke({ color: P.line, width: LINE });
const heavy = new GraphicsContext()
  .rect(-SQUARE, -SQUARE, SQUARE * 2, SQUARE * 2)
  .fill(HEAVY)
  .stroke({ color: P.line, width: LINE });

/** Pips reused from frame to frame: begin(), put() each one, then end() hides the leftovers. */
export class PipRow extends Container {
  private readonly pool: Graphics[] = [];
  private used = 0;

  begin(): void {
    this.used = 0;
  }

  /** One pip of radius `r` centred on (x, y); `steel` for one over the hook's grip. */
  put(x: number, y: number, r: number, steel: boolean): void {
    let g = this.pool[this.used];
    if (!g) {
      g = new Graphics(light);
      this.pool.push(g);
      this.addChild(g);
    }
    this.used++;
    g.context = steel ? heavy : light;
    g.visible = true;
    g.position.set(x, y);
    g.scale.set(r);
  }

  end(): void {
    for (let i = this.used; i < this.pool.length; i++) this.pool[i].visible = false;
  }
}
