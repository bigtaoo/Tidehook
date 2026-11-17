// Bubbles drifting up through the water, the one thing on the sea that is not the game: a few
// faint rings that swell, slide a little towards the dock with the tide and fade out. They sit
// under the actors and never touch the sim - no event makes one, none is read by anything - so
// they can be as slow or as still as the frame allows. Only over the water: the dock's planks and
// the fog wall are left alone.
//
// Drawn the way the pips are (pips.ts): one shared GraphicsContext at unit size, a pooled
// Graphics per bubble placed, scaled and faded. A ring is cut once for the whole session.

import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { B } from '../../sim/balance';
import { LANE_LEN, LANE_WIDTH } from '../../sim/lane';
import { FP } from '../../sim/math/fixed';
import { P } from '../kit/palette';
import { toDesign, type Field } from '../orient';

/** How many are on the water at once. Few enough that they read as the sea breathing rather than
 *  as something the player should be watching. */
const COUNT = 14;
/** A bubble's life, milliseconds: swells, drifts, fades. */
const LIFE_MS = 2600;
const LIFE_SPREAD = 1400;
/** How wide one grows, in world units, and how far it drifts towards the dock over its life. */
const R_MIN = 3;
const R_SPREAD = 4;
const DRIFT = 14;
/** The brightest a bubble ever gets. Faint on purpose: the lane's own marks must stay the
 *  loudest thing on the water. */
const ALPHA = 0.3;
/** The water starts past the dock's planks; bubbles keep clear of the lane's edges too. */
const EDGE = 10;
/** A bubble is born this far out and drifts DRIFT towards the dock over its life, so the whole
 *  drift is paid for here: at the end of it one is still EDGE clear of the planks. */
const NEAR = B.dock.edge / FP + EDGE + DRIFT;

/** A bubble: a ring with a highlight inside it, at unit radius. */
const ring = new GraphicsContext()
  .circle(0, 0, 1)
  .fill({ color: P.cream, alpha: 0.18 })
  .stroke({ color: P.cream, width: 0.16 })
  .circle(-0.34, -0.34, 0.22)
  .fill({ color: P.cream, alpha: 0.7 });

interface Bubble {
  d: number;
  w: number;
  r: number;
  ms: number;
  life: number;
}

export class Bubbles extends Container {
  private readonly bubbles: Bubble[] = [];

  constructor(private readonly f: Field, count = COUNT) {
    super();
    for (let i = 0; i < count; i++) {
      const b = this.born();
      // scattered through their lives at the start, so they do not all swell as one
      b.ms = Math.random() * b.life;
      this.bubbles.push(b);
      this.addChild(new Graphics(ring));
    }
    this.place();
  }

  /** One frame: `frameMs` is 0 while the game is held or paused, and the sea holds its breath. */
  update(frameMs: number): void {
    for (const b of this.bubbles) {
      b.ms += frameMs;
      if (b.ms >= b.life) Object.assign(b, this.born());
    }
    this.place();
  }

  private born(): Bubble {
    return {
      d: NEAR + Math.random() * (LANE_LEN - NEAR - EDGE),
      w: EDGE + Math.random() * (LANE_WIDTH - EDGE * 2),
      r: R_MIN + Math.random() * R_SPREAD,
      ms: 0,
      life: LIFE_MS + Math.random() * LIFE_SPREAD,
    };
  }

  private place(): void {
    const f = this.f;
    for (let i = 0; i < this.bubbles.length; i++) {
      const b = this.bubbles[i];
      const g = this.children[i] as Graphics;
      const t = b.ms / b.life;
      const p = toDesign(f, b.d - DRIFT * t, b.w);
      g.position.set(p.x, p.y);
      // swells over the first half of its life and holds; fades in quickly and out slowly
      g.scale.set(b.r * f.scale * (0.55 + 0.45 * Math.min(1, t * 2)));
      g.alpha = ALPHA * Math.min(1, t * 6) * (1 - t * t);
    }
  }
}
