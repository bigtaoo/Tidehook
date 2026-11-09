// The one thing the shop recommends right now, by the bot's own rules (sim/bot/bot.ts): mend a
// badly hurt dock first, then the best card the player can afford by the bot's priority list,
// else the next wave. The tutorial points at it; the "Top pick" tag marks the card.

import { PRIO } from '../../sim/bot/bot';
import { price, repairCost } from '../../sim/shop';
import type { World } from '../../sim/world';

export type ShopPick = { t: 'repair' } | { t: 'card'; i: number } | { t: 'next' };

/** Mend first when the dock is down this many hits (the bot's rule). */
const REPAIR_DOWN = 3;

/** The affordable card the bot would buy first, by index, or null. */
export function topCard(w: World): number | null {
  let best: number | null = null;
  let rank = Infinity;
  w.cards.forEach((c, i) => {
    const r = PRIO.indexOf(c.id);
    if (c.bought || r < 0 || r >= rank || w.coins < price(w, c.id)) return;
    rank = r;
    best = i;
  });
  return best;
}

export function shopPick(w: World): ShopPick {
  if (w.hp <= w.maxHp - REPAIR_DOWN && w.coins >= repairCost(w)) return { t: 'repair' };
  const i = topCard(w);
  return i === null ? { t: 'next' } : { t: 'card', i };
}
