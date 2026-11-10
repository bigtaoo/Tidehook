// The career simulation (docs/04-content.md section 1): one persona plays game after game on the
// player's slow tide, brings its pearls home and spends them in the harbour by a fixed policy,
// until everything is bought or the time runs out. Sea charts (seas.ts) are on the shopping list
// once on sale, and each game sails the hardest sea owned. It says how many minutes of play the content
// lasts, and how each game's length grows on the way. Deterministic: game n plays seed base + n.

import { B } from '../../src/sim/balance';
import { playGame } from '../../src/sim/bot/bot';
import { addCounts, bestCounts, newlyMet, type Counts } from '../../src/sim/goals';
import { metaPrice, pearlsFor, type MetaLevels } from '../../src/sim/meta';
import { chartOpen } from '../../src/sim/seas';
import type { World } from '../../src/sim/world';

export interface CareerGame {
  n: number;
  /** The sea sailed, an index into B.seas. */
  sea: number;
  wave: number;
  mins: number;
  /** Minutes played so far, this game included. */
  total: number;
  pearls: number;
  /** Of `pearls`, those the captain's log paid. */
  log: number;
  bought: string[];
}

export interface Career {
  games: CareerGame[];
  /** Minutes until the last thing was bought, or null if the time ran out first. */
  done: number | null;
  lv: MetaLevels;
}

export interface CareerOptions {
  /** Stop after this many minutes of play. */
  maxMins?: number;
  seed?: number;
  /** One game's longest, minutes (a game that runs on is cut there, its pearls counted). */
  gameCap?: number;
}

/** A sea chart's id on the shopping list and in `lv`. */
const chart = (i: number) => `sea:${B.seas[i].id}`;

/** What is left to buy, cheapest first, as [id, price]: the harbour's upgrades, and the sea charts
 *  on sale (`best`: each stat's best game, as the harbour keeps it). With `all`, every chart not
 *  owned, on sale or not: the list is done only when it is empty. */
function shoppingList(lv: MetaLevels, best: Counts, all = false): [string, number][] {
  const out: [string, number][] = [];
  for (const u of B.meta.upgrades) {
    const p = metaPrice(lv, u.id);
    if (p !== null) out.push([u.id, p]);
  }
  B.seas.forEach((s, i) => {
    if (i > 0 && !lv[chart(i)] && (all || chartOpen(i, best))) out.push([chart(i), s.price]);
  });
  return out.sort((a, b) => a[1] - b[1]);
}

/** Spends `pearls` on the cheapest thing it can afford, again and again; returns what was bought
 *  and the pearls left. */
export function spend(lv: Record<string, number>, pearls: number, best: Counts = {}): { bought: string[]; left: number } {
  const bought: string[] = [];
  for (;;) {
    const next = shoppingList(lv, best).find(([, p]) => p <= pearls);
    if (!next) return { bought, left: pearls };
    pearls -= next[1];
    lv[next[0]] = (lv[next[0]] ?? 0) + 1;
    bought.push(next[0]);
  }
}

/** The hardest sea owned. */
function seaFor(lv: MetaLevels): number {
  let sea = 0;
  B.seas.forEach((_, i) => {
    if (i > 0 && lv[chart(i)]) sea = i;
  });
  return sea;
}

export function career(name: string, opts: CareerOptions = {}): Career {
  const maxMins = opts.maxMins ?? 600;
  const base = opts.seed ?? 1000;
  const cap = (opts.gameCap ?? 60) * 60;
  const lv: Record<string, number> = {};
  const games: CareerGame[] = [];
  let pearls = 0;
  let total = 0;
  let done: number | null = null;
  let best: Counts = {};
  let totals: Counts = {};
  const logged: string[] = [];
  for (let n = 0; total < maxMins && done === null; n++) {
    const sea = seaFor(lv);
    const r = playGame(base + n, name, 1000, cap, B.tide.waves, lv, sea);
    const c = { ...r.st, wave: r.wave, games: 1, [B.seas[sea].id]: r.wave };
    best = bestCounts(best, c);
    totals = addCounts(totals, c);
    const met = newlyMet(logged, best, totals);
    logged.push(...met.map((g) => g.id));
    const log = met.reduce((s, g) => s + g.pearls, 0);
    const got = pearlsFor({ phase: r.over ? 'over' : 'shop', wave: r.wave, st: r.st, sea } as World) + log;
    pearls += got;
    total += r.secs / 60;
    const s = spend(lv, pearls, best);
    pearls = s.left;
    games.push({ n, sea, wave: r.wave, mins: r.secs / 60, total, pearls: got, log, bought: s.bought });
    if (shoppingList(lv, best, true).length === 0) done = total;
  }
  return { games, done, lv: { ...lv } };
}

/** A career as lines of text. */
export function formatCareer(name: string, c: Career): string[] {
  const f = (x: number) => x.toFixed(1).padStart(6);
  const L = [`${name}: ${c.done === null ? 'not done' : `everything bought at ${(c.done / 60).toFixed(2)} h`}, ${c.games.length} games`];
  for (const g of c.games) {
    L.push(`  #${String(g.n).padStart(2)} ${B.seas[g.sea].id.padEnd(5)} wave ${String(g.wave).padStart(3)} ${f(g.mins)} min  total ${f(g.total)}  +${String(g.pearls).padStart(4)} (log ${String(g.log).padStart(3)})  ${g.bought.join(' ')}`);
  }
  return L;
}
