// Which sprite stands for what, and how the monsters move. Monsters face the dock: head-on in
// portrait (they come down the screen), in profile facing left in landscape (they come leftward).
// Their step is driven by how far they have come, not by the clock, so a stunned one stops.

import type { MonsterKind } from '../../sim/balance';
import { fishValue } from '../../sim/items';
import { FP } from '../../sim/math/fixed';
import type { Item, Monster, World } from '../../sim/world';
import FIT from '../artFit.json';
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
 *  from the far band, or a gold fish (sim/fun.ts). The value is fixed when it spawns, so the colour
 *  holds while it is reeled. A pufferfish in the crane's hand is drawn as the monster it was. */
export function fishArt(w: World, it: Item, wide = false): ArtName {
  if (it.kind === 'junk') return JUNK[it.id % JUNK.length];
  if (it.kind === 'puffer') return monsterArt('puffer', wide).art;
  if (it.chest) return 'chest';
  if (it.gold) return FISH[2];
  const mid = fishValue(w, false, BANDS[2].from * FP);
  const far = fishValue(w, false, BANDS[3].from * FP);
  return FISH[it.val >= far ? 2 : it.val >= mid ? 1 : 0];
}

/** Kinds drawn with another kind's sprite, tinted (a new kind's own art may not be built yet):
 *  the boss is the turtle grown huge (drawn bigger by its radius), with a chest on its back. */
const STAND_IN: Partial<Record<MonsterKind, { k: MonsterKind; tint: number }>> = {
  boss: { k: 'brute', tint: 0x9aa6d8 },
  hermit: { k: 'grunt', tint: 0x9fd8d0 },
  ray: { k: 'darter', tint: 0x8f98e8 },
  kraken: { k: 'glutton', tint: 0xc49ad8 },
};

const own = (k: MonsterKind, wide: boolean) => `enemy_${k}${wide ? '_side' : ''}`;

/** The sprite for a monster of `kind`, and the tint over it. A hermit out of its shell is drawn
 *  as a crab; a kind whose own sprite is not in the art manifest borrows its stand-in's. */
export function monsterArt(kind: MonsterKind, wide: boolean, shelled = true): { art: ArtName; tint: number } {
  if (kind === 'hermit' && !shelled) return { art: own('grunt', wide) as ArtName, tint: 0xffffff };
  const name = own(kind, wide);
  if (kind !== 'boss' && name in FIT) return { art: name as ArtName, tint: 0xffffff };
  const s = STAND_IN[kind];
  return s ? { art: own(s.k, wide) as ArtName, tint: s.tint } : { art: name as ArtName, tint: 0xffffff };
}

/** Whether `kind` has its own sprite, or makes do with a stand-in. */
export function hasOwnArt(kind: MonsterKind, wide: boolean): boolean {
  return kind !== 'boss' && own(kind, wide) in FIT;
}

/** A monster mid-step: lifted `up` (design units per unit of radius), turned `rot`, scaled. */
export interface Step {
  up: number;
  rot: number;
  sx: number;
  sy: number;
}

/** Radians of step per world unit come, by kind. */
const STRIDE: Record<MonsterKind, number> = { grunt: 0.55, darter: 0.3, brute: 0.35, glutton: 0.4, boss: 0.22, hermit: 0.45, ray: 0.18, kraken: 0.16, puffer: 0.4, moray: 0.34 };

/** The step of `m` (drawn `d` world units from the dock). */
export function step(m: Monster, d: number): Step {
  const s = -d * STRIDE[m.kind] + m.id * 1.7;
  const hop = Math.abs(Math.sin(s));
  switch (m.kind) {
    case 'moray':
      // a long slither: a slow, deep wriggle
      return { up: 0, rot: Math.sin(s) * 0.2, sx: 1 + Math.cos(s * 2) * 0.05, sy: 1 };
    case 'puffer':
      // a puffed bob, swelling as it rises
      return { up: hop * 0.06, rot: Math.cos(s) * 0.04, sx: 1 + hop * 0.06, sy: 1 + hop * 0.06 };
    case 'darter':
      // a wriggle, no hop: it swims
      return { up: 0, rot: Math.sin(s) * 0.14, sx: 1 + Math.cos(s * 2) * 0.03, sy: 1 };
    case 'ray':
      // a glide: the wings beat slowly, the body tilts with them
      return { up: 0, rot: Math.sin(s) * 0.06, sx: 1 + Math.sin(s) * 0.08, sy: 1 - Math.sin(s) * 0.03 };
    case 'kraken': {
      // a heave: it gathers itself, then surges, arms spreading
      const pull = Math.sin(s) * 0.5 + 0.5;
      return { up: pull * 0.05, rot: Math.cos(s) * 0.04, sx: 0.95 + pull * 0.1, sy: 1.05 - pull * 0.1 };
    }
    case 'brute':
    case 'boss': {
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
