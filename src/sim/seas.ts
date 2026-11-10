// The seas (docs/04-content.md section 3.5): the home bay, then the Fog Bank and the Storm Reach,
// each a chart bought in the harbour once the sea before it has been sailed far enough. A sea
// starts its tide some waves ahead (tide.ts), may send monsters faster or closer together, and
// pays more pearls; each keeps its own best wave in the captain's log (goals.ts counts it).

import { B, type SeaSpec } from './balance';
import type { World } from './world';

export function seaOf(w: World): SeaSpec {
  return B.seas[w.sea] ?? B.seas[0];
}

/** The sea's index by id; the home bay for an id it does not know. */
export function seaIndex(id: string): number {
  return Math.max(0, B.seas.findIndex((s) => s.id === id));
}

/** Whether sea `i`'s chart is on sale: the sea before it reached to its `needs` wave. */
export function chartOpen(i: number, best: Readonly<Record<string, number>>): boolean {
  if (i <= 0) return true;
  const s = B.seas[i];
  return !!s && (best[B.seas[i - 1].id] ?? 0) >= s.needs;
}
