// Words on screen: one font stack, a cream fill with a dark outline that reads over every band,
// and a helper that shrinks a label into its box instead of letting it spill (layout/check.ts).

import { Text, type TextStyleFontWeight } from 'pixi.js';
import { P, TEXT_STROKE } from './palette';

export const FONT = 'system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

const CJK = /[　-鿿＀-￯]/;

export interface LabelOpts {
  fill?: number;
  /** Outline the words (on the field and on dark wood); off on paper. */
  stroke?: boolean;
  weight?: TextStyleFontWeight;
  /** Wrap at this width, design units. */
  wrap?: number;
  align?: 'left' | 'center' | 'right';
}

export function label(text: string, size: number, o: LabelOpts = {}): Text {
  const stroke = o.stroke ?? true;
  return new Text({
    text,
    style: {
      fontFamily: FONT,
      fontWeight: o.weight ?? '800',
      fontSize: size,
      fill: o.fill ?? P.cream,
      stroke: stroke ? { color: TEXT_STROKE, width: Math.max(2, size / 7) } : undefined,
      align: o.align ?? 'center',
      wordWrap: o.wrap !== undefined,
      wordWrapWidth: o.wrap ?? 0,
      // inside a word only where there are no spaces to break at (CJK); a Latin word too long for
      // the line stays whole and fitIn shrinks it
      breakWords: o.wrap !== undefined && CJK.test(text),
      lineHeight: o.wrap !== undefined ? size * 1.2 : undefined,
    },
  });
}

/** Shrinks `t` (never grows it) until it fits `w` by `h` design units. */
export function fitIn<T extends Text>(t: T, w: number, h = Infinity): T {
  t.scale.set(1);
  const k = Math.min(1, w / Math.max(1, t.width), h / Math.max(1, t.height));
  t.scale.set(k);
  return t;
}

/** fitIn for a wrapped label: each smaller size wraps again at the width it now has, so a long
 *  line spreads across the box instead of shrinking as a narrow column. */
export function fitWrap<T extends Text>(t: T, w: number, h: number): T {
  let k = 1;
  for (let i = 0; i < 30; i++) {
    t.style.wordWrapWidth = w / k;
    t.scale.set(1);
    if (t.width * k <= w && t.height * k <= h) break;
    k *= 0.93;
  }
  t.scale.set(Math.min(k, w / Math.max(1, t.width), h / Math.max(1, t.height)));
  return t;
}
