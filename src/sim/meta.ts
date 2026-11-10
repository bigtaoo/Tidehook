// The harbour's upgrades: bought between games with the pearls each game brings home, and kept
// from game to game (docs/02-onboarding.md section 7). A game starts with the levels owned, so the
// next one goes further. The sim only reads the levels it is handed; keeping them is the game
// layer's (src/game/meta/harbour.ts).

import { B, type UpgradeSpec } from './balance';
import { muldiv } from './math/fixed';
import { seaOf } from './seas';
import { gain, level, priceAt, upgrade } from './shop';
import type { World } from './world';

/** Harbour upgrade levels owned, by id; a missing id is level 0. */
export type MetaLevels = Readonly<Record<string, number>>;

const BY_ID = new Map(B.meta.upgrades.map((u) => [u.id, u]));

export function metaUpgrade(id: string): UpgradeSpec {
  const u = BY_ID.get(id);
  if (!u) throw new Error(`unknown harbour upgrade ${id}`);
  return u;
}

/** Levels of `id` in `lv`, within 0 and the upgrade's max (a save may hold anything). */
export function metaLevel(lv: MetaLevels, id: string): number {
  const n = lv[id] ?? 0;
  return Number.isSafeInteger(n) ? Math.max(0, Math.min(n, metaUpgrade(id).max)) : 0;
}

/** Pearls for the next level of `id`, or null when it is at its max. */
export function metaPrice(lv: MetaLevels, id: string): number | null {
  const u = metaUpgrade(id);
  const n = metaLevel(lv, id);
  return n >= u.max ? null : priceAt(u, n);
}

/** Every blueprint owned: the shop with all its cards, as the balance guard plays it. */
export const ALL_PLANS: MetaLevels = Object.fromEntries(B.meta.upgrades.filter((u) => u.unlock).map((u) => [u.id, 1]));

/** Gives a world before its first wave the harbour's levels. A blueprint (`unlock`) lets the shop
 *  offer its locked card. An unlock (`card`) starts the game
 *  owning that shop card as if bought: its level counts, so the shop's price and max stay right. */
export function applyMeta(w: World, lv: MetaLevels): void {
  for (const u of B.meta.upgrades) {
    if (u.unlock && metaLevel(lv, u.id) > 0) w.plans.push(u.unlock);
    for (let i = metaLevel(lv, u.id); i > 0; i--) {
      for (const e of u.effects) gain(w, e);
      if (u.card) {
        const c = upgrade(u.card);
        if (level(w, c.id) >= c.max) continue;
        w.lv[c.id] = level(w, c.id) + 1;
        for (const e of c.effects) gain(w, e);
      }
    }
  }
}

/** The pearls a game brings home: so many for each wave it cleared, and more for each boss, scaled
 *  by the sea (seas.ts). */
export function pearlsFor(w: World): number {
  const cleared = w.phase === 'shop' ? w.wave : w.wave - 1;
  const bosses = w.st.bosses * B.boss.pearls + w.st.krakens * (B.kraken.pearls - B.boss.pearls);
  return muldiv(Math.max(0, cleared) * B.meta.perWave + bosses, seaOf(w).pearls, 1000);
}
