// What the harbour suggests to a player who is stuck (Harbour.flat): games in a row that made nothing
// better are the likeliest place to lose a player (docs/04-content.md section 4, the population sim).
// The tip points at the nearest thing that makes the next game different.

import { B } from '../../sim/balance';
import type { Harbour } from './harbour';

/** Flat games in a row before the harbour offers a tip instead of the voyage line. */
export const TIP_AFTER = 2;

export type Tip =
  /** A harder sea is owned but not picked: richer pearls, a fresh best to beat. */
  | { kind: 'sea'; sea: number }
  /** A chart is on sale and affordable. */
  | { kind: 'chart'; sea: number }
  /** An upgrade is affordable. */
  | { kind: 'buy' }
  /** A chart is on sale but dear: what to save for. */
  | { kind: 'save'; sea: number; n: number }
  /** Nothing to buy: the captain's log pays for new feats. */
  | { kind: 'log' };

/** The tip for `h`, or null while the player is not stuck. */
export function harbourTip(h: Harbour): Tip | null {
  if (h.flat < TIP_AFTER) return null;
  const seas = B.seas.map((_, i) => i);
  const harder = seas.filter((i) => i > h.sea && h.owns(i)).pop();
  if (harder !== undefined) return { kind: 'sea', sea: harder };
  const open = seas.find((i) => h.chartPrice(i) !== null);
  if (open !== undefined && (h.chartPrice(open) as number) <= h.pearls) return { kind: 'chart', sea: open };
  if (B.meta.upgrades.some((u) => (h.price(u.id) ?? Infinity) <= h.pearls)) return { kind: 'buy' };
  if (open !== undefined) return { kind: 'save', sea: open, n: h.chartPrice(open) as number };
  return { kind: 'log' };
}
