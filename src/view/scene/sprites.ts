// Sprites reused from frame to frame: begin(), put() each thing in draw order, then end() hides
// whatever was left over. Sprite i is child i, so the order of the puts is the order on screen.

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
}

export class SpritePool extends Container {
  private readonly sprites: Sprite[] = [];
  private used = 0;

  begin(): void {
    this.used = 0;
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
    return true;
  }

  end(): void {
    for (let i = this.used; i < this.sprites.length; i++) this.sprites[i].visible = false;
  }

  /** How many sprites the last frame drew. */
  get count(): number {
    return this.used;
  }
}
