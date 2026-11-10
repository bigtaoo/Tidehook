// Words on screen: one font stack, a cream fill with a dark outline that reads over every band,
// and a helper that shrinks a label into its box instead of letting it spill (layout/check.ts).

import { Text, type TextStyleFontWeight } from 'pixi.js';
import { P, TEXT_STROKE } from './palette';

export const FONT = 'system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

const CJK = /[　-鿿＀-￯]/;
/** Marks that never start a line, and those that never end one (the CJK line-breaking rules). */
const NO_START = '，。、：；！？）》」』】”’…·%';
const NO_END = '（《「『【“‘';
const DIGIT = /[0-9]/;
/** A hair space: Pixi wraps only at spaces, so CJK text gets one between characters that may part. */
const BREAK = ' ';

/** `text` with a break point wherever CJK may wrap: between two characters when one of them is
 *  CJK, never before a closing mark or after an opening one. Without it Pixi took a whole sentence
 *  as one word: after "第 30" it put the rest on its own line, and a colon could start a line. */
export function cjkBreaks(text: string): string {
  const cs = Array.from(text);
  let out = '';
  for (let i = 0; i < cs.length; i++) {
    const a = cs[i];
    const b = cs[i + 1];
    out += a;
    if (b === undefined || a.trim() === '' || b.trim() === '') continue;
    if (!CJK.test(a) && !CJK.test(b)) continue;
    if (NO_START.includes(b) || NO_END.includes(a)) continue;
    // a number stays with the word it counts: "30波", "第3"
    if (DIGIT.test(a) || DIGIT.test(b)) continue;
    out += BREAK;
  }
  return out;
}

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
  const cjk = o.wrap !== undefined && CJK.test(text);
  return new Text({
    text: cjk ? cjkBreaks(text) : text,
    style: {
      fontFamily: FONT,
      fontWeight: o.weight ?? '800',
      fontSize: size,
      fill: o.fill ?? P.cream,
      stroke: stroke ? { color: TEXT_STROKE, width: Math.max(2, size / 7) } : undefined,
      align: o.align ?? 'center',
      wordWrap: o.wrap !== undefined,
      wordWrapWidth: o.wrap ?? 0,
      // CJK breaks at the spaces cjkBreaks put in (a run with no break point still splits); a Latin
      // word too long for the line stays whole and fitIn shrinks it
      breakWords: cjk,
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
