// The shop between waves: three upgrade cards, four late on (at least one core card: grip, heft or barb),
// plus the fixed repair and mine slots, and a reroll that costs more each time (prototype
// rollShop, buy, buyFix, reroll and their prices).

import { B, type Effect, type UpgradeSpec } from './balance';
import { BF } from './balanceFun';
import { muldiv, roundDiv, times } from './math/fixed';
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

/** The price of an upgrade's next level with `owned` levels: the base, times the growth for each;
 *  an endless card's (balance.ts step) rises by the same few coins a level instead, so it keeps
 *  pace with the catch, which is worth a little more each wave (items.ts), and never runs away. */
export function priceAt(u: UpgradeSpec, owned: number): number {
  if (u.step) return u.base + u.step * owned;
  let p = u.base * 1000;
  for (let i = owned; i > 0; i--) p = times(p, u.growth);
  return roundDiv(p, 1000);
}

/** How much dearer an endless card is on this wave than its level alone makes it, permille: from
 *  `shop.endlessFrom` on it grows by `shop.endlessByWave` of the catch's own growth (items.ts
 *  catchScale). The per-level step alone fell behind a purse that grows with the wave: late on a
 *  player who fished well bought every card on offer each shop and still sat on over a thousand
 *  coins. Before wave endlessFrom nothing changes, so the early game is as it was. */
export function endlessScale(w: World): number {
  return 1000 + muldiv(B.catch.valuePerWave, S.endlessByWave, 1000) * Math.max(0, w.wave - S.endlessFrom);
}

/** What a card costs in this shop: an endless card's price also grows with the wave (endlessScale). */
export function price(w: World, id: string): number {
  const u = upgrade(id);
  const p = priceAt(u, level(w, id));
  return u.step ? roundDiv(p * endlessScale(w), 1000) : p;
}

/** One level's worth of an effect, on the world. */
export function gain(w: World, e: Effect): void {
  if ('mul' in e) w.up[e.stat] = times(w.up[e.stat], e.mul);
  else if (e.stat === 'dock') {
    w.maxHp += e.add;
    w.hp += e.add;
  } else if (e.stat === 'coins') w.coins += e.add;
  else if (e.stat === 'mend') w.mend += e.add;
  else if (e.stat === 'stall') w.stall += e.add;
  else if (e.stat === 'mines') w.mines = Math.min(B.mine.max, w.mines + e.add);
  else w.up[e.stat] += e.add;
}

export const repairCost = (w: World): number => S.repairBase + S.repairPerWave * w.wave;
export const mineCost = (w: World): number => S.mineBase + S.minePerWave * w.wave;
export const rerollCost = (w: World): number => S.rerollBase + S.rerollPer * w.rerolls;
/** Damage of a mine this wave. */
export const mineDamage = (w: World): number => B.mine.dmgBase + roundDiv(B.mine.dmgPerWave * w.wave, 1000);

/** Whether the shop may offer `u`: a locked card needs its blueprint from the harbour. */
export function offered(w: World, u: UpgradeSpec): boolean {
  return !u.locked || w.plans.includes(u.id);
}

/** The cards the shop could still deal: everything not rare, not at its max, and unlocked. The
 *  endless cards (grip, heft, barb, planks) never reach a max, so a deep game always has a deal:
 *  before them, a captain bought the lot somewhere past wave twenty and the shop fell empty, and
 *  players watched (2026-11-21) said that is where the endless game turned dull. */
export function dealable(w: World): UpgradeSpec[] {
  return B.upgrades.filter((u) => !u.rare && level(w, u.id) < u.max && offered(w, u));
}

/** Whether a capped card is still to be had. Once none is, the coins left in the purse come home
 *  as pearls (meta.ts pearlsFromCoins), as they did when the shop could be bought out. */
export function cappedLeft(w: World): boolean {
  return dealable(w).some((u) => !u.step);
}

/** How many cards the deal lays out: the usual three, and a fourth from wave `S.moreFrom` so a
 *  long game has more to choose between - or from the first wave with the harbour's stall. Never
 *  five: a portrait phone cannot lay out five cards a player can read. */
export function dealSize(w: World): number {
  return Math.min(S.cards + 1, S.cards + (w.wave >= S.moreFrom ? 1 : 0) + w.stall);
}

export function rollShop(w: World): void {
  const rng = w.rng.shop;
  const pool = dealable(w);
  w.cards = [];
  const core = pool.filter((u) => u.core);
  if (core.length) {
    const u = core[rng.int(core.length)];
    w.cards.push({ id: u.id, bought: false });
    pool.splice(pool.indexOf(u), 1);
  }
  while (w.cards.length < dealSize(w) && pool.length) {
    const u = pool.splice(rng.int(pool.length), 1)[0];
    w.cards.push({ id: u.id, bought: false });
  }
  rareCard(w);
}

/** Now and then a rare card as an extra one, from the luck stream so the usual deal stays put; a
 *  captain owns `rare.max` of them at most, so each game is shaped by a pick, not all five. */
function rareCard(w: World): void {
  if (w.wave < BF.rare.from) return;
  const luck = w.rng.luck;
  if (luck.int(1000) >= BF.rare.chance) return;
  const all = B.upgrades.filter((u) => u.rare);
  if (all.filter((u) => level(w, u.id) > 0).length >= BF.rare.max) return;
  const rares = all.filter((u) => level(w, u.id) < u.max);
  if (!rares.length) return;
  const card = { id: rares[luck.int(rares.length)].id, bought: false };
  // a fourth card already out: the rare takes the last place rather than make a fifth (dealSize)
  if (w.cards.length >= S.cards + 1) w.cards[w.cards.length - 1] = card;
  else w.cards.push(card);
}

/** An owned card that `id` works well with, or null. */
export function pairedWith(w: World, id: string): string | null {
  return upgrade(id).pairs.find((p) => level(w, p) > 0) ?? null;
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
  for (const e of upgrade(c.id).effects) gain(w, e);
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

/** Deals fresh cards. A free one (a rewarded ad's) costs nothing and leaves the price where it was. */
export function reroll(w: World, free = false): boolean {
  if (!dealable(w).length) return false;
  if (free) {
    if (w.phase !== 'shop') return false;
    rollShop(w);
    return true;
  }
  if (!pay(w, rerollCost(w))) return false;
  w.rerolls++;
  rollShop(w);
  return true;
}
