// Where the HUD, the pause and sound buttons and the shop panel sit in the design, for each orientation
// (docs/01-tech-plan.md section 4). Portrait: a strip across the top (wave, coins, pause) and a
// bar under the dock (dock, mines, the junk in hand); the shop rises over the lane above that
// bar. Landscape: one sidebar on the right holds the HUD; the shop opens over the lane beside it.
// Nothing here turns with the lane.

import { fieldFor, LANDSCAPE_SIDE, PORTRAIT_BOTTOM, PORTRAIT_TOP, type Field } from '../orient';
import { textBoost, type Fit } from '../viewport';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Frame {
  fit: Fit;
  field: Field;
  /** Text grows by this in a small embed (viewport.ts textBoost). */
  boost: number;
  /** The HUD's plates: portrait top and bottom, landscape the sidebar. */
  bars: Rect[];
  pause: Rect;
  /** The sound toggle, beside pause: to its left in portrait, above it in landscape. */
  sound: Rect;
  shop: Rect;
  /** Where hints show: across the top of the lane. */
  banner: Rect;
}

const GAP = 24;
const PAUSE = 96;
/** The shop panel: portrait height, landscape width. */
const SHOP_PORTRAIT_H = 1000;
const SHOP_LANDSCAPE_W = 1000;

export function frameFor(fit: Fit): Frame {
  const field = fieldFor(fit.wide, fit.w, fit.h);
  const boost = textBoost(fit);
  if (fit.wide) {
    const side = { x: fit.w - LANDSCAPE_SIDE, y: 0, w: LANDSCAPE_SIDE, h: fit.h };
    const pause = { x: side.x + (side.w - PAUSE) / 2, y: fit.h - PAUSE - 48, w: PAUSE, h: PAUSE };
    return {
      fit,
      field,
      boost,
      bars: [side],
      pause,
      sound: { ...pause, y: pause.y - PAUSE - GAP },
      shop: { x: side.x - GAP - SHOP_LANDSCAPE_W, y: GAP, w: SHOP_LANDSCAPE_W, h: fit.h - GAP * 2 },
      banner: { x: field.x + 220, y: GAP, w: side.x - field.x - 220 - GAP, h: 150 },
    };
  }
  const top = { x: 0, y: 0, w: fit.w, h: PORTRAIT_TOP };
  const bottom = { x: 0, y: fit.h - PORTRAIT_BOTTOM, w: fit.w, h: PORTRAIT_BOTTOM };
  const pause = { x: fit.w - PAUSE - 30, y: (PORTRAIT_TOP - PAUSE) / 2, w: PAUSE, h: PAUSE };
  return {
    fit,
    field,
    boost,
    bars: [top, bottom],
    pause,
    sound: { ...pause, x: pause.x - PAUSE - GAP },
    shop: { x: GAP, y: bottom.y - GAP - SHOP_PORTRAIT_H, w: fit.w - GAP * 2, h: SHOP_PORTRAIT_H },
    banner: { x: GAP, y: PORTRAIT_TOP + GAP, w: fit.w - GAP * 2, h: 130 },
  };
}
