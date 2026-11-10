// What sets the later monsters apart (docs/04-content.md section 3.6): the bosses, and the ray's
// dives. The hermit's shell lives in monsters.ts damage, the kraken's brood in monsters.ts too.

import { B, type MonsterKind } from './balance';
import type { Monster, World } from './world';

/** Whether `kind` is a boss: the giant turtle or the kraken. */
export function isBoss(kind: MonsterKind): boolean {
  return B.monsters[kind].boss;
}

/** Whether a monster of `kind`, `d` FP out with wobble phase `ph`, is under water on tick `tick`:
 *  a diver goes down for B.dive.under ticks of every B.dive.every, each on its own beat, but comes
 *  up for good once it is near the dock. */
export function divingAt(tick: number, kind: MonsterKind, d: number, ph: number): boolean {
  if (!B.monsters[kind].dives || d <= B.dock.edge + B.dive.near) return false;
  return (tick + ph) % B.dive.every < B.dive.under;
}

/** Whether `m` is under water now, out of reach of the hook and of thrown junk (not of mines). */
export function diving(w: World, m: Monster): boolean {
  return divingAt(w.tick, m.kind, m.d, m.ph);
}
