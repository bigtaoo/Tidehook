// Sprites reused from frame to frame: begin(), put() each thing in draw order, then end() hides
// whatever was left over. Sprite i is child i, so the order of the puts is the order on screen.
// Each sprite casts a flat shadow down and to the right (the light is from the top left, whichever
// way the lane turns), the cut-paper look: `shade` holds them and goes under everything that moves.

import { Container, Sprite } from 'pixi.js';
import { areaScale, tex, type ArtName } from '../art';

export interface Pose {
  /** Turn, radians clockwise. */
  rot?: number;
  sx?: number;
  sy?: number;
  /** Mirror left to right. */
  flip?: boolean;
  alpha?: number;
  tint?: number;
  /** The point of the texture placed at (x, y), 0-1; the middle when left out. */
  ax?: number;
  ay?: number;
  /** Casts no shadow (the default is to cast one). */
  flat?: boolean;
}

/** The shadow: its colour, opacity, and offset as a share of the sprite's area radius. */
const SHADE = 0x07182a;
const SHADE_ALPHA = 0.32;
const SHADE_X = 0.12;
const SHADE_Y = 0.2;

export class SpritePool extends Container {
  private readonly sprites: Sprite[] = [];
  private readonly shadows: Sprite[] = [];
  private used = 0;
  private shaded = 0;
  /** The shadows; the owner adds it under its other layers. */
  readonly shade = new Container();

  begin(): void {
    this.used = 0;
    this.shaded = 0;
  }

  /** Draws `n` at (x, y) with the opaque area of a circle of `radius` (design units). False when
   *  the texture is not loaded, and the caller draws its grey-box shape instead. */
  put(n: ArtName, x: number, y: number, radius: number, o: Pose = {}): boolean {
    const t = tex(n);
    if (!t) return false;
    let s = this.sprites[this.used];
    if (!s) {
      s = new Sprite();
      this.sprites.push(s);
      this.addChild(s);
    }
    this.used++;
    s.texture = t;
    s.visible = true;
    s.anchor.set(o.ax ?? 0.5, o.ay ?? 0.5);
    s.position.set(x, y);
    const k = areaScale(n, radius);
    s.scale.set(k * (o.sx ?? 1) * (o.flip ? -1 : 1), k * (o.sy ?? 1));
    s.rotation = o.rot ?? 0;
    s.alpha = o.alpha ?? 1;
    s.tint = o.tint ?? 0xffffff;
    if (!o.flat) {
      let d = this.shadows[this.shaded];
      if (!d) {
        d = new Sprite();
        d.tint = SHADE;
        this.shadows.push(d);
        this.shade.addChild(d);
      }
      this.shaded++;
      d.texture = t;
      d.visible = true;
      d.anchor.copyFrom(s.anchor);
      d.scale.copyFrom(s.scale);
      d.rotation = s.rotation;
      d.position.set(x + radius * SHADE_X, y + radius * SHADE_Y);
      d.alpha = SHADE_ALPHA * s.alpha;
    }
    return true;
  }

  end(): void {
    for (let i = this.used; i < this.sprites.length; i++) this.sprites[i].visible = false;
    for (let i = this.shaded; i < this.shadows.length; i++) this.shadows[i].visible = false;
  }

  /** How many sprites the last frame drew. */
  get count(): number {
    return this.used;
  }
}
