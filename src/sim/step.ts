// The simulation's entry points: start a game, advance it one tick, and the player's commands
// (prototype startGame and update). Everything the view or a bot may do to a world goes through
// here or the shop's buy functions.

import { B } from './balance';
import { updateHook } from './hook';
import { restock } from './items';
import { applyMeta, type MetaLevels } from './meta';
import { updateMonsters } from './monsters';
import { updateShots } from './throw';
import { startWave, updateWave } from './waves';
import { newWorld, type World } from './world';

export { fire } from './hook';
export { buyCard, buyMine, buyRepair, reroll } from './shop';

/** A new game on `seed`: the starting catch in the water and wave 1 under way. `ease`: waves of
 *  slow tide it opens with (tide.ts); `meta`: the harbour's upgrade levels (meta.ts). */
export function startGame(seed: number, ease = 0, meta: MetaLevels = {}, sea = 0): World {
  const w = newWorld(seed, ease);
  w.sea = sea;
  applyMeta(w, meta);
  restock(w, B.catch.startFish, B.catch.startJunk);
  startWave(w);
  return w;
}

/** Leaves the shop for the next wave. */
export function nextWave(w: World): boolean {
  if (w.phase !== 'shop') return false;
  startWave(w);
  return true;
}

/** One tick (1 / TICK_RATE s). */
export function step(w: World): void {
  w.tick++;
  w.events = [];
  if (w.phase !== 'wave') return;
  updateHook(w);
  updateShots(w);
  updateMonsters(w);
  if (w.phase === 'wave') updateWave(w);
}
