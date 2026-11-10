// What a moving point runs into: the hook's tip and thrown junk both ask for the thing whose edge
// reaches deepest into their circle (prototype hitAt).

import { diving } from './kinds';
import { dist } from './math/fixed';
import type { Item, Monster, World } from './world';

export type Target = { t: 'item'; item: Item } | { t: 'mon'; m: Monster };

/**
 * The monster (or, unless `monsOnly`, item) overlapping the circle at (d, w) of radius `r` the
 * most, or null when nothing touches it. Monsters on the hook, under water (kinds.ts) and those in
 * `skip` are ignored.
 */
export function hitAt(
  world: World,
  d: number,
  w: number,
  r: number,
  monsOnly: boolean,
  skip?: readonly number[],
): Target | null {
  let best: Target | null = null;
  let bd = 0;
  for (const m of world.mons) {
    if (m.grab || diving(world, m) || skip?.includes(m.id)) continue;
    const gap = dist(m.d - d, m.w - w) - m.r - r;
    if (gap < bd) {
      bd = gap;
      best = { t: 'mon', m };
    }
  }
  if (monsOnly) return best;
  for (const item of world.items) {
    const gap = dist(item.d - d, item.w - w) - item.r - r;
    if (gap < bd) {
      bd = gap;
      best = { t: 'item', item };
    }
  }
  return best;
}

/** Whether a monster is still in the water (not killed, crushed or leaked). */
export function alive(world: World, m: Monster): boolean {
  return world.mons.includes(m);
}
