// The hit point pips under a monster, drawn from two shapes that are tessellated once instead of
// rebuilt every frame. A late wave puts a dozen monsters of a dozen hit points on the lane, and
// re-cutting ~170 little circles and squares per frame cost more than the rest of the scene put
// together (1.5 ms of a 1.9 ms frame on a desktop, so a phone's whole frame budget). Pixi v8 lets
// several Graphics share one GraphicsContext: the two pips are built at unit size, and each one on
// screen is a pooled Graphics placed and scaled to the row's pip radius.

import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { HEAVY, P } from '../kit/palette';
import type { Bars } from './look';

/** The layered bar's height and how far each sheet under the top one peeks out, both in screen
 *  pixels before the layout scale. */
const BAR_H = 5;
/** A boss's bar, which the player reads from across the lane, is drawn this tall instead. */
const BOSS_H = 8;
const SHEET = 2.5;
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
 *  bars): `left` sheets stacked, the top one `fill` full, centred on (x, y) and `w` wide. Pips
 *  stop at twelve, so without this a boss of forty took twenty-eight hits with nothing to show
 *  for them. Few shapes and only for the few deep monsters on a lane, so it is drawn straight
 *  into the frame's Graphics rather than pooled. The top sheet is notched into its points of
 *  damage, so the player can count the hits left instead of guessing at a shrinking stripe;
 *  `big` for a boss, whose bar is drawn taller. */
export function drawBar(g: Graphics, x: number, y: number, w: number, k: number, b: Bars, steel: boolean, big = false): void {
  const h = (big ? BOSS_H : BAR_H) * k;
  const x0 = x - w / 2;
  for (let i = Math.min(b.left - 1, MAX_SHEETS); i > 0; i--) {
    const d = i * SHEET * k;
    g.roundRect(x0 + d, y + d, w, h, h / 2).fill({ color: P.line, alpha: 0.3 }).stroke({ color: P.line, width: 1.2 * k, alpha: 0.5 });
  }
  g.roundRect(x0, y, w, h, h / 2).fill({ color: P.line, alpha: 0.45 });
  if (b.fill > 0) g.roundRect(x0, y, Math.max(h, w * b.fill), h, h / 2).fill(steel ? HEAVY : P.cream);
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
