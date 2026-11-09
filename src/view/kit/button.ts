// A button: a flat plate with words on it, an optional price line under them. It answers
// pointerdown (a tap should feel instant) and stops the event there, so a press on the HUD never
// also reaches the lane and casts the hook.

import { Container, Graphics, type FederatedPointerEvent } from 'pixi.js';
import { P } from './palette';
import { fitIn, label } from './text';

export interface ButtonOpts {
  w: number;
  h: number;
  text: string;
  size: number;
  /** A second, smaller line: a price, drawn after a coin. */
  price?: number;
  color?: number;
  enabled?: boolean;
  onPress: () => void;
  /** A press while disabled (the shop's "can't afford" sound). */
  onDenied?: () => void;
}

export class Button extends Container {
  readonly enabled: boolean;

  constructor(o: ButtonOpts) {
    super();
    this.enabled = o.enabled ?? true;
    const bg = new Graphics();
    const fill = this.enabled ? (o.color ?? P.brass) : P.woodLight;
    bg.roundRect(0, 0, o.w, o.h, Math.min(28, o.h / 3)).fill(fill).stroke({ color: P.line, width: 5 });
    this.addChild(bg);

    const pad = Math.min(24, o.w / 10);
    const hasPrice = o.price !== undefined;
    const twoLines = hasPrice && o.text !== '';
    if (o.text) {
      const main = fitIn(label(o.text, o.size), o.w - pad * 2, twoLines ? o.h * 0.5 : o.h - 12);
      main.anchor.set(0.5);
      main.position.set(o.w / 2, twoLines ? o.h * 0.34 : o.h / 2);
      this.addChild(main);
    }
    if (hasPrice) this.price(String(o.price), o, pad, twoLines ? o.h * 0.72 : o.h / 2, twoLines ? 0.8 : 1);
    this.eventMode = 'static';
    this.cursor = this.enabled ? 'pointer' : 'default';
    this.on('pointerdown', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      if (this.enabled) o.onPress();
      else o.onDenied?.();
    });
  }

  /** A coin and the price, centred on the line at `y`. */
  private price(text: string, o: ButtonOpts, pad: number, y: number, k: number): void {
    const n = label(text, o.size * k, { fill: P.brassLight });
    const coin = o.size * k * 0.36;
    fitIn(n, o.w - pad * 2 - coin * 3, o.h * (k < 1 ? 0.4 : 0.8));
    const left = o.w / 2 - (coin * 2.6 + n.width) / 2;
    const g = new Graphics();
    g.circle(left + coin, y, coin).fill(P.brassLight).stroke({ color: P.line, width: 3 });
    n.anchor.set(0, 0.5);
    n.position.set(left + coin * 2.6, y);
    this.addChild(g, n);
  }
}
