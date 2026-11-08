// The catch in the water: fish and chests (coins), and junk (to throw). Further out is worth
// more, more so each wave and with the fishing-grounds upgrade (prototype goldVal, addItem,
// restock).

import { B } from './balance';
import { LANE_LEN_FP, LANE_WIDTH_FP } from './lane';
import { clamp, dist2, muldiv, roundDiv } from './math/fixed';
import { nextId, type Item, type Monster, type World } from './world';

const C = B.catch;

/** Coins a fish (or chest) at distance `d` is worth this wave. */
export function fishValue(w: World, chest: boolean, d: number): number {
  const near = B.dock.edge + C.nearMargin;
  const span = LANE_LEN_FP - B.dock.edge - C.valueSpan;
  const far = clamp(muldiv(d - near, 1000, span), 0, 1000);
  const base = chest ? C.chestValue * 1000 + C.chestValueFar * far : C.fishValue * 1000 + C.fishValueFar * far;
  const byWave = 1000 + C.valuePerWave * Math.max(0, w.wave - 1);
  const byGrounds = 1000 + B.grounds.valueBonus * w.up.grounds;
  return roundDiv(base * byWave * byGrounds, 1_000_000_000);
}

export function fishCap(w: World): number {
  return C.fishCap + B.grounds.capBonus * w.up.grounds;
}

function radiusOf(kind: Item['kind'], chest: boolean): number {
  return kind === 'junk' ? C.junkRadius : chest ? C.chestRadius : C.fishRadius;
}

function weightOf(kind: Item['kind'], chest: boolean): number {
  return kind === 'junk' ? C.junkWeight : chest ? C.chestWeight : C.fishWeight;
}

/** Puts one new item somewhere clear of the others; false when no spot was found. */
export function addItem(w: World, kind: Item['kind']): boolean {
  const rng = w.rng.catch;
  for (let k = 0; k < C.tries; k++) {
    const chest = kind === 'fish' && rng.int(1000) < C.chestChance;
    const r = radiusOf(kind, chest);
    const pw = rng.range(C.wallMargin + r, LANE_WIDTH_FP - C.wallMargin - r);
    const pd = rng.range(B.dock.edge + C.nearMargin, LANE_LEN_FP - C.farMargin - r);
    if (w.items.some((o) => dist2(o.w - pw, o.d - pd) < (o.r + r + C.spacing) * (o.r + r + C.spacing))) continue;
    const val = kind === 'fish' ? fishValue(w, chest, pd) : 0;
    w.items.push({ id: nextId(w), kind, chest, d: pd, w: pw, r, val, wt: weightOf(kind, chest) });
    return true;
  }
  return false;
}

/** Tops the water up to `nFish` fish and `nJunk` junk (as far as room allows). */
export function restock(w: World, nFish: number, nJunk: number): void {
  let fish = w.items.filter((o) => o.kind === 'fish').length;
  let junk = w.items.length - fish;
  while (fish < nFish && addItem(w, 'fish')) fish++;
  while (junk < nJunk && addItem(w, 'junk')) junk++;
}

/** The refill between waves: a few more fish and junk, up to the caps. */
export function restockAfterWave(w: World): void {
  const fish = w.items.filter((o) => o.kind === 'fish').length;
  const junk = w.items.length - fish;
  const more = C.restockFish + B.grounds.restockBonus * w.up.grounds;
  restock(w, Math.min(fishCap(w), fish + more), Math.min(C.junkCap, junk + C.restockJunk));
}

/** Junk reeled in while the crane already holds a piece goes back into the water. */
export function returnJunk(w: World, item: Item): void {
  const rng = w.rng.catch;
  item.w = rng.range(C.returnMargin, LANE_WIDTH_FP - C.returnMargin);
  item.d = rng.range(B.dock.edge + C.returnNear, LANE_LEN_FP - C.returnMargin);
  w.items.push(item);
}

/** The fish a glutton ate, dropped where it died when it was not crushed on the dock. */
export function dropFish(w: World, m: Monster): Item {
  const chest = m.ate >= C.dropChest;
  const r = radiusOf('fish', chest);
  const item: Item = {
    id: nextId(w),
    kind: 'fish',
    chest,
    w: clamp(m.w, C.wallMargin + r, LANE_WIDTH_FP - C.wallMargin - r),
    d: clamp(m.d, B.dock.edge + C.nearMargin, LANE_LEN_FP - C.farMargin - r),
    r,
    val: m.ate,
    wt: weightOf('fish', chest),
  };
  w.items.push(item);
  return item;
}
