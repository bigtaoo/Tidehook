// The buttons that sit in the slot a cover leaves for them (hud/overlay.ts): the game over card's
// ad buttons (hud/overAds.ts), the voyage's end (hud/voyageEnd.ts) and the pause cover's one
// button (hud/pausePanel.ts). The card itself takes no taps, so its buttons live over it; the two
// cards wrote the same row twice and drifted to two sizes, so the row is here now.

import type { Button } from '../kit/button';
import { buttonRow, type RowItem } from '../kit/row';
import { TYPE } from '../kit/tokens';

/** The slot the card leaves: its centre and the width its buttons may take, design units (in
 *  landscape the captain stands beside the card, so less than the lane). */
export interface Slot {
  x: number;
  y: number;
  w: number;
  /** Its height (the pause cover's settings take two rows). */
  h: number;
}

/** A cover button at its widest, design units, and the gap between two of them. */
export const BTN_W = 420;
export const BTN_H = 120;
export const GAP = 32;

/** The width of each of two buttons side by side in `slot`. One button alone takes the same width,
 *  so a card that offers one choice and a card that offers two look like the same card. */
export function slotButtonW(slot: Slot, most: number, gap = GAP): number {
  return Math.min(most, (slot.w - gap) / 2);
}

/** The row, built at the one size all of its buttons can take (kit/row.ts) and centred on the
 *  slot. The caller adds them: it owns what happens on a press. */
export function slotRow(items: readonly Omit<RowItem, 'w' | 'h'>[], slot: Slot, k: number): Button[] {
  const w = slotButtonW(slot, BTN_W * k);
  const h = BTN_H * k;
  const row = buttonRow(items.map((o) => ({ ...o, w, h })), TYPE.head * k);
  const total = row.length * w + (row.length - 1) * GAP;
  row.forEach((b, i) => b.position.set(slot.x - total / 2 + i * (w + GAP), slot.y - h / 2));
  return row;
}
