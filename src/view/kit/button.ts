// A button: a flat plate with words on it, an optional price line under them. It answers
// pointerdown (a tap should feel instant) and stops the event there, so a press on the HUD never
// also reaches the lane and casts the hook.
//
// It never picks its own size: it shrinks the words it is given until they fit its own plate,
// knowing nothing of its neighbours. A row of buttons therefore has to agree on one size before
// it builds any of them, which is what kit/row.ts is for; the boxes it solves are the ones
// `wordBox` and `priceBox` give here, so the two never drift apart.

import { Container, Graphics, type FederatedPointerEvent } from 'pixi.js';
import { drawCoin, drawPearl } from './counter';
import { P, TEXT_STROKE } from './palette';
import { RADIUS, STROKE } from './tokens';
import { fitIn, label } from './text';

export interface ButtonOpts {
  w: number;
  h: number;
  text: string;
  size: number;
  /** A second, smaller line: a price, drawn after a coin. */
  price?: number;
  /** The price is in pearls (the harbour's, between games): a pearl instead of the coin. */
  pearl?: boolean;
  color?: number;
  /** A mark drawn before the words: 'play' for a button that shows an ad. Drawn, not a ▶ glyph,
   *  which some systems turn into a colour emoji. */
  icon?: 'play';
  enabled?: boolean;
  onPress: () => void;
  /** A press while disabled (the shop's "can't afford" sound). */
  onDenied?: () => void;
}

/** What a plate asks of a line of text, without saying how big that text is: a box in design
 *  units, plus `room` - what is drawn before the words, as a share of their font size, since the
 *  play mark and the coin both grow with the words they stand beside. */
export interface WordBox {
  w: number;
  h: number;
  room: number;
}

/** Everything about a plate that decides how much room its words get. */
export type Plate = Pick<ButtonOpts, 'w' | 'h' | 'text' | 'price' | 'icon'>;

/** The room a plate this wide keeps inside its edges. */
function padOf(w: number): number {
  return Math.min(24, w / 10);
}

/** True when words and price share the plate, each on its own line. */
function stacked(o: Plate): boolean {
  return o.price !== undefined && o.text !== '';
}

/** The box the words get. */
export function wordBox(o: Plate): WordBox {
  return { w: o.w - padOf(o.w) * 2, h: stacked(o) ? o.h * 0.5 : o.h - 12, room: o.icon ? 1 : 0 };
}

/** How much smaller the price line is drawn than the words above it. */
export function priceScale(o: Plate): number {
  return stacked(o) ? 0.8 : 1;
}

/** The box the price gets, measured against the price's own (smaller) size: `room` is the coin. */
export function priceBox(o: Plate): WordBox {
  return { w: o.w - padOf(o.w) * 2, h: o.h * (stacked(o) ? 0.4 : 0.8), room: 1.08 };
}

export class Button extends Container {
  readonly enabled: boolean;

  constructor(o: ButtonOpts) {
    super();
    this.enabled = o.enabled ?? true;
    const bg = new Graphics();
    // a disabled plate keeps the colour it was given: the harbour marks the sea it is at with
    // brass and disables it, and a grey plate there would read as "you cannot sail"
    const fill = o.color ?? (this.enabled ? P.brass : P.disabled);
    bg.roundRect(0, 0, o.w, o.h, Math.min(RADIUS.panel, o.h / 3)).fill(fill).stroke({ color: P.line, width: STROKE.card });
    this.addChild(bg);

    const twoLines = stacked(o);
    if (o.text) {
      const box = wordBox(o);
      const y = twoLines ? o.h * 0.34 : o.h / 2;
      // the play mark: a triangle a little taller than the words' capitals, before them
      const icon = o.icon ? o.size * 0.8 : 0;
      const room = box.room * o.size; // the mark's width and the gap after it
      const main = fitIn(label(o.text, o.size), box.w - room, box.h);
      const k = main.scale.y; // the mark shrinks with the words
      const left = o.w / 2 - (room * k + main.width) / 2;
      main.anchor.set(0.5);
      main.position.set(left + room * k + main.width / 2, y);
      this.addChild(main);
      if (o.icon) this.addChild(playMark(left, y, icon * k));
    }
    if (o.price !== undefined) this.price(String(o.price), o, twoLines ? o.h * 0.72 : o.h / 2);
    this.eventMode = 'static';
    this.cursor = this.enabled ? 'pointer' : 'default';
    this.on('pointerdown', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      if (this.enabled) o.onPress();
      else o.onDenied?.();
    });
  }

  /** A coin (or a pearl) and the price, centred on the line at `y`. */
  private price(text: string, o: ButtonOpts, y: number): void {
    const k = priceScale(o);
    const box = priceBox(o);
    const n = label(text, o.size * k, { fill: o.pearl ? P.cream : P.brassLight });
    const coin = o.size * k * 0.36;
    fitIn(n, box.w - coin * 3, box.h);
    const left = o.w / 2 - (coin * 2.6 + n.width) / 2;
    const g = new Graphics();
    if (o.pearl) drawPearl(g, left + coin, y, coin);
    else drawCoin(g, left + coin, y, coin);
    n.anchor.set(0, 0.5);
    n.position.set(left + coin * 2.6, y);
    this.addChild(g, n);
  }
}

/** The play mark: a cream triangle `s` tall, outlined like the words, its left edge at `x`. */
export function playMark(x: number, y: number, s: number): Graphics {
  const g = new Graphics();
  const w = s * 0.9;
  g.poly([x, y - s / 2, x + w, y, x, y + s / 2])
    .fill(P.cream)
    .stroke({ color: TEXT_STROKE, width: Math.max(2, s / 9), join: 'round' });
  return g;
}
