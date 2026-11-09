// Which sprite stands for what, and how the monsters move. Monsters face the dock: head-on in
// portrait (they come down the screen), in profile facing left in landscape (they come leftward).
// Their step is driven by how far they have come, not by the clock, so a stunned one stops.

import type { MonsterKind } from '../../sim/balance';
import { fishValue } from '../../sim/items';
import { FP } from '../../sim/math/fixed';
import type { Item, Monster, World } from '../../sim/world';
import { acrossHalf, type ArtName } from '../art';
import { BANDS } from './field';

/** The sprite's opaque area is a circle this many times the thing's hit radius: a little bigger
 *  than the hit circle, so claws and fins can stick out of it. */
export const LOOK_SCALE = 1.5;
/** A sprite never reaches further across the lane than this many hit radii, so a wide one (the
 *  turtle head-on, a log lying across) does not look touched where the hook cannot catch it. */
export const ACROSS_MAX = 2;

/** The opaque-area radius to draw sprite `n` at for a thing of hit radius `r` (any unit):
 *  LOOK_SCALE times it, cut down for a sprite wider across the lane than ACROSS_MAX allows. */
export function lookRadius(n: ArtName, r: number, wide: boolean): number {
  return r * Math.min(LOOK_SCALE, ACROSS_MAX / acrossHalf(n, wide));
}

const FISH: readonly ArtName[] = ['fish_coral', 'fish_orange', 'fish_gold'];
const JUNK: readonly ArtName[] = ['junk_log', 'junk_anchor', 'junk_barrel'];

/** A fish's colour is its price step: coral, orange, then gold for one worth as much as a fish
 *  from the far band. The value is fixed when it spawns, so the colour holds while it is reeled. */
export function fishArt(w: World, it: Item): ArtName {
  if (it.kind === 'junk') return JUNK[it.id % JUNK.length];
  if (it.chest) return 'chest';
  const mid = fishValue(w, false, BANDS[2].from * FP);
  const far = fishValue(w, false, BANDS[3].from * FP);
  return FISH[it.val >= far ? 2 : it.val >= mid ? 1 : 0];
}

export function monsterArt(kind: MonsterKind, wide: boolean): ArtName {
  return wide ? `enemy_${kind}_side` : `enemy_${kind}`;
}

/** A monster mid-step: lifted `up` (design units per unit of radius), turned `rot`, scaled. */
export interface Step {
  up: number;
  rot: number;
  sx: number;
  sy: number;
}

/** Radians of step per world unit come, by kind. */
const STRIDE: Record<MonsterKind, number> = { grunt: 0.55, darter: 0.3, brute: 0.35, glutton: 0.4 };

/** The step of `m` (drawn `d` world units from the dock). */
export function step(m: Monster, d: number): Step {
  const s = -d * STRIDE[m.kind] + m.id * 1.7;
  const hop = Math.abs(Math.sin(s));
  switch (m.kind) {
    case 'darter':
      // a wriggle, no hop: it swims
      return { up: 0, rot: Math.sin(s) * 0.14, sx: 1 + Math.cos(s * 2) * 0.03, sy: 1 };
    case 'brute': {
      // heavy: barely lifts, a wide sway and a squash as each flipper lands
      const land = Math.min(1, hop * 3);
      return { up: hop * hop * 0.08, rot: Math.cos(s) * 0.08, sx: 1.04 - land * 0.04, sy: 0.93 + land * 0.07 };
    }
    case 'glutton':
      // a fat bob
      return { up: hop * 0.08, rot: Math.cos(s) * 0.05, sx: 1.02 - hop * 0.04, sy: 0.97 + hop * 0.05 };
    default:
      // the crab's scuttle
      return { up: hop * 0.14, rot: Math.cos(s) * 0.09, sx: 1, sy: 0.95 + hop * 0.06 };
  }
}

/** At most this many hit point pips under a monster. */
const MAX_PIPS = 12;

/** The pips under a monster of `hp` hit points: how many, and how many of the last ones are over
 *  the hook's grip. While any are, a cast bounces off it (monsters.ts liftable); hits knock the
 *  heavy ones off first, and a Grip card turns them light. */
export function pips(hp: number, grip: number): { n: number; heavy: number } {
  const n = Math.min(hp, MAX_PIPS);
  return { n, heavy: Math.min(n, Math.max(0, hp - grip)) };
}
