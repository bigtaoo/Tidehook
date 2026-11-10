// The daily voyage (docs/04-content.md section 3.8): one game a day that is the same for everyone,
// the same seed, sea and tide, with no harbour upgrades, so the day's waves compare fairly (and on a
// leaderboard, game/board.ts). The day is the UTC date; the sea rotates through all of them, owned
// or not, a taste of the seas still to buy. Tries are unlimited; the harbour keeps the day's best.

import { B } from '../../sim/balance';

/** The UTC date of `ms`, as YYYY-MM-DD. */
export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Today's key. */
export function today(): string {
  return dayKey(Date.now());
}

/** The day's seed: FNV-1a of its key, a positive 31-bit number. */
export function daySeed(day: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 0x01000193);
  return (h >>> 1) || 1;
}

/** Days from 1970-01-01 to `day`, 0 for a key that is no date. */
export function dayIndex(day: string): number {
  const days = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  return Number.isFinite(days) && days > 0 ? days : 0;
}

/** The day's sea, an index into B.seas: they take turns day by day. */
export function dailySea(day: string): number {
  return dayIndex(day) % B.seas.length;
}
