// One size for a row of buttons. A Button shrinks its words to fit its own plate (kit/button.ts)
// and knows nothing of its neighbours, so a row of equal plates renders its words at as many
// sizes as it has buttons: the harbour's seven tabs showed five, with the selected one often the
// least legible. A row asks here for the one size every one of its buttons can take, then builds
// them all at it. Plates of different widths are fine - each is measured against its own - and
// `shareWidths` gives a long word a wider plate so that the one size stays worth reading.

import { Button, priceBox, priceScale, wordBox, type ButtonOpts, type WordBox } from './button';
import { label } from './text';

/** A button in a row: everything but the size, which the row decides for all of them. */
export type RowItem = Omit<ButtonOpts, 'size'>;

/** A plate's own edges, at their widest (kit/button.ts padOf): what `shareWidths` sets aside
 *  before it shares what is left out by the words. */
const PLATE_PAD = 48;

function measure(text: string, size: number): { w: number; h: number } {
  const t = label(text, size);
  const m = { w: t.width, h: t.height };
  t.destroy();
  return m;
}

/** The largest size up to `max` at which `text` fits `box`. Both the words and the room before
 *  them grow with the size, so the width is one division, not a search. */
function fits(text: string, box: WordBox, max: number): number {
  const m = measure(text, max);
  return Math.min(max, (box.w * max) / (m.w + box.room * max), (box.h * max) / m.h);
}

/** The largest size up to `max` at which this button's words and its price both fit its plate. */
export function sizeFor(o: RowItem, max: number): number {
  let s = max;
  if (o.text) s = Math.min(s, fits(o.text, wordBox(o), max));
  if (o.price !== undefined) {
    const k = priceScale(o);
    s = Math.min(s, fits(String(o.price), priceBox(o), max * k) / k);
  }
  return s;
}

/** The one size a whole row can take: the smallest any of its buttons can. */
export function rowSize(items: readonly RowItem[], max: number): number {
  return items.reduce((s, o) => Math.min(s, sizeFor(o, max)), max);
}

/** The row, every button built at that one size, in the order given. */
export function buttonRow(items: readonly RowItem[], max: number): Button[] {
  const size = rowSize(items, max);
  return items.map((o) => new Button({ ...o, size }));
}

/** How wide each plate in a row should be, sharing `total` (the gaps between them already taken
 *  out), so that one size suits them all: in proportion to the words at `size`, but never under
 *  `min` of an even share, so a short word keeps a plate worth tapping. */
export function shareWidths(texts: readonly string[], total: number, size: number, min = 0.62): number[] {
  const floor = (total / texts.length) * min;
  const want = texts.map((s) => measure(s, size).w + PLATE_PAD);
  const held = texts.map(() => false);
  for (;;) {
    const free = want.reduce((a, w, i) => a + (held[i] ? 0 : w), 0);
    const room = total - held.reduce((a, h) => a + (h ? floor : 0), 0);
    if (free <= 0) return texts.map(() => total / texts.length);
    const short = want.findIndex((w, i) => !held[i] && (room * w) / free < floor);
    if (short < 0) return want.map((w, i) => (held[i] ? floor : (room * w) / free));
    held[short] = true;
  }
}
