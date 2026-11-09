// The shop between waves: three upgrade cards (at least one core card: grip, heft or barb),
// plus the fixed repair and mine slots, and a reroll that costs more each time (prototype
// rollShop, buy, buyFix, reroll and their prices).

import { B, type UpgradeSpec } from './balance';
import { roundDiv, times } from './math/fixed';
import type { World } from './world';

const S = B.shop;
const BY_ID = new Map(B.upgrades.map((u) => [u.id, u]));

export function upgrade(id: string): UpgradeSpec {
  const u = BY_ID.get(id);
  if (!u) throw new Error(`unknown upgrade ${id}`);
  return u;
}

export function level(w: World, id: string): number {
  return w.lv[id] ?? 0;
}

/** The price of the next level: the base, times the growth for each level owned. */
export function price(w: World, id: string): number {
  const u = upgrade(id);
  let p = u.base * 1000;
  for (let i = level(w, id); i > 0; i--) p = times(p, u.growth);
  return roundDiv(p, 1000);
}

export const repairCost = (w: World): number => S.repairBase + S.repairPerWave * w.wave;
export const mineCost = (w: World): number => S.mineBase + S.minePerWave * w.wave;
export const rerollCost = (w: World): number => S.rerollBase + S.rerollPer * w.rerolls;
/** Damage of a mine this wave. */
export const mineDamage = (w: World): number => B.mine.dmgBase + roundDiv(B.mine.dmgPerWave * w.wave, 1000);

export function rollShop(w: World): void {
  const rng = w.rng.shop;
  const pool = B.upgrades.filter((u) => level(w, u.id) < u.max);
  w.cards = [];
  const core = pool.filter((u) => u.core);
  if (core.length) {
    const u = core[rng.int(core.length)];
    w.cards.push({ id: u.id, bought: false });
    pool.splice(pool.indexOf(u), 1);
  }
  while (w.cards.length < S.cards && pool.length) {
    const u = pool.splice(rng.int(pool.length), 1)[0];
    w.cards.push({ id: u.id, bought: false });
  }
}

function pay(w: World, cost: number): boolean {
  if (w.phase !== 'shop' || w.coins < cost) return false;
  w.coins -= cost;
  w.st.spent += cost;
  return true;
}

export function buyCard(w: World, i: number): boolean {
  const c = w.cards[i];
  if (!c || c.bought || !pay(w, price(w, c.id))) return false;
  w.lv[c.id] = level(w, c.id) + 1;
  for (const e of upgrade(c.id).effects) {
    if (e.stat === 'dock') {
      if ('add' in e) {
        w.maxHp += e.add;
        w.hp += e.add;
      }
    } else if ('mul' in e) w.up[e.stat] = times(w.up[e.stat], e.mul);
    else w.up[e.stat] += e.add;
  }
  c.bought = true;
  return true;
}

export function buyRepair(w: World): boolean {
  if (w.hp >= w.maxHp || !pay(w, repairCost(w))) return false;
  w.hp = Math.min(w.maxHp, w.hp + S.repairHp);
  return true;
}

export function buyMine(w: World): boolean {
  if (w.mines >= B.mine.max || !pay(w, mineCost(w))) return false;
  w.mines++;
  return true;
}

export function reroll(w: World): boolean {
  if (!pay(w, rerollCost(w))) return false;
  w.rerolls++;
  rollShop(w);
  return true;
}
