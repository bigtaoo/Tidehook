// How hard the sea is: the difficulty level that the wave mix, the spawn gap and the monsters'
// growth read, in permille of a wave (wave 1 is 1000). In a bare game (the balance guard's
// personas) it is the wave itself. A player's game opens on a slow tide (B.tide, docs/02-onboarding.md
// section 6): it climbs at `pace` for the first `World.ease` waves and at the normal one-per-wave
// after that. The coins, the shop prices and the player's own weapons still count real waves, so
// the player grows faster than the sea for a while and a first game lasts some eight minutes; the
// harbour's upgrades between games (meta.ts) carry each game further. From wave B.tide.surgeFrom
// on the tide takes a third stage, `surge` levels a wave instead of one: only a strong player ever
// gets that far, and without it their game drifts on past forty minutes (docs/04-content.md
// section 4.3). The slow tide always comes first, so a longer `?ease` pushes the surge back.

import { B } from './balance';
import { emit } from './events';
import { seaOf } from './seas';
import type { World } from './world';

/** The difficulty level at wave `wave` (default: the world's), permille of a wave. */
export function level(w: World, wave: number = w.wave): number {
  const grown = Math.max(0, wave - 1);
  const slow = Math.min(grown, w.ease);
  const fast = Math.max(0, grown - Math.max(w.ease, B.tide.surgeFrom - 1));
  const mid = grown - slow - fast;
  return 1000 + seaOf(w).lead * 1000 + slow * B.tide.pace + mid * 1000 + fast * B.tide.surge;
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
