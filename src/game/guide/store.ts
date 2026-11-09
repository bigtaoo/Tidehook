// The tutorial's save: which steps are done (and the one-time game over lesson), and how many
// games the player has started, in the platform's storage. Bad or missing data reads as a new
// player; a store that throws is the SafeStore's problem, not ours.

import type { KeyValueStore } from '../../platform/types';

export const GUIDE_KEY = 'tidehook.guide';

export interface GuideSave {
  done: string[];
  games: number;
}

export function loadGuide(store: KeyValueStore | null): GuideSave {
  const empty: GuideSave = { done: [], games: 0 };
  const raw = store?.getItem(GUIDE_KEY);
  if (!raw) return empty;
  try {
    const v = JSON.parse(raw) as Partial<GuideSave>;
    const done = Array.isArray(v.done) ? v.done.filter((x): x is string => typeof x === 'string') : [];
    const games = Number.isSafeInteger(v.games) && (v.games as number) > 0 ? (v.games as number) : 0;
    return { done, games };
  } catch {
    return empty;
  }
}

export function saveGuide(store: KeyValueStore | null, save: GuideSave): void {
  store?.setItem(GUIDE_KEY, JSON.stringify(save));
}
