// How hard the sea is: the difficulty level that the wave mix, the spawn gap and the monsters'
// growth read, in permille of a wave (wave 1 is 1000). In a bare game (the balance guard's
// personas) it is the wave itself. A player's game opens on a slow tide (B.tide, docs/02-onboarding.md
// section 6): it climbs at `pace` for the first `World.ease` waves and at the normal one-per-wave
// after that. The coins, the shop prices and the player's own weapons still count real waves, so
// the player grows faster than the sea for a while and a first game lasts some eight minutes; the
// harbour's upgrades between games (meta.ts) carry each game further.

import { B } from './balance';
import { emit } from './events';
import { seaOf } from './seas';
import type { World } from './world';

/** The difficulty level at wave `wave` (default: the world's), permille of a wave. */
export function level(w: World, wave: number = w.wave): number {
  const grown = Math.max(0, wave - 1);
  const slow = Math.min(grown, w.ease);
  return 1000 + seaOf(w).lead * 1000 + slow * B.tide.pace + (grown - slow) * 1000;
}

/** After each wave the harbour's menders (World.mend, bought between games) patch the dock a
 *  little, never above full. */
export function mendAfterWave(w: World): void {
  w.mended = 0;
  const hp = Math.min(w.mend, w.maxHp - w.hp);
  if (hp <= 0) return;
  w.hp += hp;
  w.mended = hp;
  emit(w, { e: 'mend', hp });
}
