// The strip of words across the top of the lane: the hint banner (a new monster, the first junk in
// hand) and the tutorial's line, which keeps its right end for a skip button. The two drew their
// own plates - one at 0.7 alpha behind a 3-wide edge, the other at 0.88 behind a 4 - and read as
// two different things. One plate now; the tone says only whose voice it is.

import type { Graphics, Text } from 'pixi.js';
import { P } from './palette';
import { plate, type Rect } from './panel';
import { fitWrap, label } from './text';
import { RADIUS, STROKE, TYPE } from './tokens';

/** The room the words keep from the plate's edges, design units. */
const PAD = 30;

/** Whose voice: `hint` is the sea telling the captain what it sent; `talk` is the captain
 *  teaching, and speaks in brass. */
export type Tone = 'hint' | 'talk';

const TONES = {
  hint: { fill: P.cream, weight: '700' as const, size: TYPE.head },
  talk: { fill: P.brassLight, weight: '800' as const, size: TYPE.head * 1.2 },
} as const;

export interface BubbleOpts {
  r: Rect;
  text: string;
  /** The small-embed boost (view/orient.ts). */
  k: number;
  tone: Tone;
  /** How wide the words may run, and where they are centred: the tutorial's bubble leaves its
   *  right end for the skip button. Both default to the whole plate. */
  room?: number;
  cx?: number;
}

/** The plate and the words, for the caller to add in that order: the layout check reads a text's
 *  box from the Graphics drawn before it (view/layout/check.ts), and overlay.test.ts reads the
 *  banner's first Text child, so neither may be wrapped in a Container. */
export function bubble(o: BubbleOpts): { plate: Graphics; words: Text } {
  const tone = TONES[o.tone];
  const g = plate(o.r, { fill: P.line, alpha: 0.82, line: P.brassLight, width: STROKE.tile, radius: RADIUS.card });
  const room = o.room ?? o.r.w - PAD * 2;
  const words = label(o.text, tone.size * o.k, { fill: tone.fill, wrap: room, weight: tone.weight });
  fitWrap(words, room, o.r.h - PAD);
  words.anchor.set(0.5);
  words.position.set(o.cx ?? o.r.x + o.r.w / 2, o.r.y + o.r.h / 2);
  return { plate: g, words };
}
