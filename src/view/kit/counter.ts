// A purse: the coin or the pearl, then the count. The HUD, the shop's header and the harbour's all
// show one, and each used to draw its own glyph at its own size.

import { Container, Graphics } from 'pixi.js';
import { P } from './palette';
import { fitIn, label } from './text';
import { STROKE } from './tokens';

/** A coin of radius `r` at (x, y): brass with a dark rim. */
export function drawCoin(g: Graphics, x: number, y: number, r: number): void {
  g.circle(x, y, r).fill(P.brassLight).stroke({ color: P.line, width: STROKE.glyph });
}

/** A pearl of radius `r` at (x, y): cream with a glint. */
export function drawPearl(g: Graphics, x: number, y: number, r: number): void {
  g.circle(x, y, r).fill(P.cream).stroke({ color: P.line, width: STROKE.glyph });
  g.circle(x - r * 0.35, y - r * 0.35, r * 0.28).fill(0xffffff);
}

export interface CounterOpts {
  /** The count, already said (i18n). */
  text: string;
  size: number;
  /** Pearls, not coins. */
  pearl?: boolean;
  /** The widest the glyph and the count may be together. */
  maxW: number;
  maxH?: number;
}

/** The glyph and the count as one piece, laid out with its right edge at x = 0 and its middle at
 *  y = 0: a header hangs it off its own right edge. */
export function counter(o: CounterOpts): Container {
  const n = label(o.text, o.size, { fill: o.pearl ? P.cream : P.brassLight });
  const r = o.size * 0.36;
  fitIn(n, o.maxW - r * 3.2, o.maxH ?? Infinity);
  n.anchor.set(1, 0.5);
  n.position.set(0, 0);
  const g = new Graphics();
  const gr = r * n.scale.y;
  const x = -n.width - gr * 1.6;
  if (o.pearl) drawPearl(g, x, 0, gr);
  else drawCoin(g, x, 0, gr);
  const c = new Container();
  c.addChild(g, n);
  return c;
}
