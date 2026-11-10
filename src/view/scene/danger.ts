// When the dock is about to be hit, the view says so before it happens: a monster that will reach
// the dock within DANGER_TICKS wears a red "!", and a dock at LOW_DOCK of its hit points or less
// flashes its bar and shows cracks (docs/03-gameplay.md section 3). Read-only on the world.

import { B } from '../../sim/balance';
import { TICK_RATE } from '../../sim/math/fixed';
import type { Monster, World } from '../../sim/world';

/** How soon a monster must be due at the dock to wear the "!": 2.5 s. */
export const DANGER_TICKS = Math.round(TICK_RATE * 2.5);
/** The share of the dock's hit points, permille, at or under which it shows it is about to fall. */
export const LOW_DOCK = 300;

/** Ticks until `m` reaches the dock at its pace now, if nothing stops it; Infinity while it is
 *  held, stunned, eating or not moving. Walkers go for the crane, swimmers bite the dock's edge
 *  (monsters.ts reached). */
export function dockEta(m: Monster): number {
  if (m.grab || m.stun > 0 || m.eat || m.speed <= 0) return Infinity;
  const left = B.monsters[m.kind].swims
    ? m.d - m.r - B.dock.edge
    : Math.hypot(m.d - B.crane.d, m.w - B.crane.w) - B.crane.reach - m.r;
  return Math.max(0, left) / m.speed;
}

/** Whether `m` should wear the "!". */
export function inDanger(m: Monster): boolean {
  return dockEta(m) < DANGER_TICKS;
}

/** Whether the dock is low enough to warn of it; not once it has fallen. */
export function lowDock(w: World): boolean {
  return w.hp > 0 && w.hp * 1000 <= w.maxHp * LOW_DOCK;
}
