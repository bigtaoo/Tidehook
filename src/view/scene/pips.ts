// The hit point pips under a monster, drawn from two shapes that are tessellated once instead of
// rebuilt every frame. A late wave puts a dozen monsters of a dozen hit points on the lane, and
// re-cutting ~170 little circles and squares per frame cost more than the rest of the scene put
// together (1.5 ms of a 1.9 ms frame on a desktop, so a phone's whole frame budget). Pixi v8 lets
// several Graphics share one GraphicsContext: the two pips are built at unit size, and each one on
// screen is a pooled Graphics placed and scaled to the row's pip radius.

import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { HEAVY, P } from '../kit/palette';

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
