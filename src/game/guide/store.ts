// The tutorial's save: which steps are done (and the one-time game over lesson), how many games
// the player has started and how many shops they have left while the shop step waited, in the
// platform's storage. Bad or missing data reads as a new player; a store that throws is the
// SafeStore's problem, not ours.

import type { KeyValueStore } from '../../platform/types';

export const GUIDE_KEY = 'tidehook.guide';

export interface GuideSave {
  done: string[];
  games: number;
  /** Shops left while the shop step was still to do. Kept because it is a budget, not a tally:
   *  the step is done on the third one, so a counter that started over on every reload would
   *  leave the step (and with it the whole tutorial) unfinishable for a player who reloads. */
  shops: number;
}

/** A counted field as it comes back from storage: anything else reads as none. */
function count(v: unknown): number {
  return Number.isSafeInteger(v) && (v as number) > 0 ? (v as number) : 0;
}

export function loadGuide(store: KeyValueStore | null): GuideSave {
  const empty: GuideSave = { done: [], games: 0, shops: 0 };
  const raw = store?.getItem(GUIDE_KEY);
  if (!raw) return empty;
  try {
    const v = JSON.parse(raw) as Partial<GuideSave>;
    const done = Array.isArray(v.done) ? v.done.filter((x): x is string => typeof x === 'string') : [];
    return { done, games: count(v.games), shops: count(v.shops) };
  } catch {
    return empty;
  }
}

export function saveGuide(store: KeyValueStore | null, save: GuideSave): void {
  store?.setItem(GUIDE_KEY, JSON.stringify(save));
}
