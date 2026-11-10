// A second chance after the dock falls (the rewarded "revive", docs/01-tech-plan.md section 9):
// the dock is patched to half, everything at its edge is pushed back out and dazed, and the wave
// goes on where it stopped.
import { emit } from './events';
import { toFp } from './math/fixed';
import type { World } from './world';

/** Monsters nearer the crane than this, world units, are pushed back out to it. */
export const REVIVE_PUSH = 300;
/** Ticks every monster stays dazed after a revive, so the player can breathe. */
export const REVIVE_STUN = 60;

/** Brings a fallen dock back into the wave. False (and nothing changes) unless the game is over. */
export function revive(w: World): boolean {
  if (w.phase !== 'over') return false;
  w.phase = 'wave';
  w.hp = Math.ceil(w.maxHp / 2);
  const edge = toFp(REVIVE_PUSH);
  for (const m of w.mons) {
    if (!m.grab && m.d < edge) m.d = edge;
    m.stun = Math.max(m.stun, REVIVE_STUN);
  }
  emit(w, { e: 'revive', hp: w.hp });
  return true;
}
