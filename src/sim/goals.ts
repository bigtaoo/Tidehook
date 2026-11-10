// The captain's log (docs/04-content.md): goals that pay pearls once, met in one game (reach wave
// 20, sink two Old Shellbacks) or over every game played (5000 coins landed). The sim only says
// what a game counted and which goals that meets; the harbour keeps the totals and what is done
// (game/meta/harbour.ts).

import { B, type GoalSpec } from './balance';
import { seaOf } from './seas';
import type { World } from './world';

/** What a game counted, by stat: its tally, the wave it reached (also under its sea's id, for that
 *  sea's record) and 1 game. */
export type Counts = Readonly<Record<string, number>>;

export function counts(w: World): Counts {
  return { ...w.st, wave: w.wave, games: 1, [seaOf(w).id]: w.wave };
}

/** `totals` with a game's `c` added. */
export function addCounts(totals: Counts, c: Counts): Record<string, number> {
  const out: Record<string, number> = { ...totals };
  for (const [k, v] of Object.entries(c)) out[k] = (out[k] ?? 0) + v;
  return out;
}

/** How far along `g` is: the best game so far for a one-game goal, the total for the rest. */
export function goalValue(g: GoalSpec, best: Counts, totals: Counts): number {
  return (g.kind === 'game' ? best : totals)[g.stat] ?? 0;
}

/** Each stat's best in one game, with a game's `c` taken in. */
export function bestCounts(best: Counts, c: Counts): Record<string, number> {
  const out: Record<string, number> = { ...best };
  for (const [k, v] of Object.entries(c)) out[k] = Math.max(out[k] ?? 0, v);
  return out;
}

/** The goals met by `best` and `totals` that are not in `done` yet. */
export function newlyMet(done: readonly string[], best: Counts, totals: Counts): GoalSpec[] {
  return B.goals.filter((g) => !done.includes(g.id) && goalValue(g, best, totals) >= g.n);
}
