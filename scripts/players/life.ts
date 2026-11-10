// One player's career (roster.ts), game after game on the slow tide, as scripts/career does it but
// with the player's own habits: their skill that game, their shop style, the revive and pearl
// doubling ads, how they spend pearls in the harbour and which sea they sail. It notes the moments
// that matter for keeping a player: the first purchase, the first boss, each chart, everything
// bought, and runs of "flat" games where nothing got better (no record, no log entry, nothing
// bought), the likeliest place to lose them. Deterministic: `base` picks the seeds.

import { FIRST_SEED } from '../../src/game/guide/firstSeed';
import { B } from '../../src/sim/balance';
import { personaFrom, Pilot } from '../../src/sim/bot/bot';
import { addCounts, bestCounts, firstSunk, newlyMet, sunkCounts, type Counts } from '../../src/sim/goals';
import { BF } from '../../src/sim/balanceFun';
import { TICK_RATE } from '../../src/sim/math/fixed';
import { pearlsFor } from '../../src/sim/meta';
import { revive } from '../../src/sim/revive';
import { chartOpen } from '../../src/sim/seas';
import { startGame, step } from '../../src/sim/step';
import type { World } from '../../src/sim/world';
import { chart, seaFor, shoppingList, spend } from '../career/career';
import type { Player } from './roster';

/** Flat games in a row that we count as a player likely to leave. */
export const FLAT_QUIT = 3;

export interface LifeGame {
  n: number;
  sea: number;
  wave: number;
  mins: number;
  /** Minutes played so far, this game included. */
  total: number;
  pearls: number;
  revived: boolean;
  /** A new best wave on this sea. */
  record: boolean;
  goals: number;
  bought: string[];
  bosses: number;
}

export interface Life {
  player: string;
  base: number;
  games: LifeGame[];
  /** Minutes until everything was bought, or null if the time ran out first. */
  done: number | null;
  /** Game numbers (1 the first) of the milestones, null if never reached. */
  firstBuy: number | null;
  firstBoss: number | null;
  charts: (number | null)[];
  /** The game that made FLAT_QUIT flat games in a row, the first time. */
  quit: number | null;
  /** The longest run of flat games. */
  flatRun: number;
}

export interface LifeOptions {
  maxMins?: number;
  maxGames?: number;
  /** One game's longest, minutes. */
  gameCap?: number;
}

/** One game: the player at the controls until the dock falls (revived once, if they watch). */
function play(pl: Player, n: number, base: number, lv: Record<string, number>, sea: number, capSecs: number): { w: World; secs: number; revived: boolean } {
  const seed = n === 0 ? FIRST_SEED : base * 1000 + n;
  const pilot = new Pilot(base * 1000 + n + 7, personaFrom({ ...pl.style, ...pl.skill(n) }));
  const w = startGame(seed, B.tide.waves, lv, sea);
  let t = 0;
  let revived = false;
  while (t < capSecs * TICK_RATE) {
    if (w.phase === 'over') {
      if (!pl.revive || revived) break;
      revive(w);
      revived = true;
    }
    pilot.tick(w);
    if (w.phase === 'shop') continue;
    step(w);
    t++;
  }
  return { w, secs: t / TICK_RATE, revived };
}

/** Spends the pearls by the player's harbour habit. */
function shopHarbour(pl: Player, lv: Record<string, number>, pearls: number, best: Counts): { bought: string[]; left: number } {
  if (pl.harbour === 'charts') {
    const want = B.seas.findIndex((_, i) => i > 0 && !lv[chart(i)] && chartOpen(i, best));
    if (want > 0) {
      if (pearls < B.seas[want].price) return { bought: [], left: pearls };
      lv[chart(want)] = 1;
      const rest = spend(lv, pearls - B.seas[want].price, best);
      return { bought: [chart(want), ...rest.bought], left: rest.left };
    }
  }
  return spend(lv, pearls, best);
}

export function live(pl: Player, base: number, opts: LifeOptions = {}): Life {
  const maxMins = opts.maxMins ?? 360;
  const maxGames = opts.maxGames ?? 40;
  const cap = (opts.gameCap ?? 60) * 60;
  const lv: Record<string, number> = {};
  const life: Life = { player: pl.id, base, games: [], done: null, firstBuy: null, firstBoss: null, charts: B.seas.map((_, i) => (i === 0 ? 1 : null)), quit: null, flatRun: 0 };
  let pearls = 0;
  let total = 0;
  let best: Counts = {};
  let totals: Counts = {};
  const logged: string[] = [];
  let flat = 0;
  for (let n = 0; n < maxGames && total < maxMins && life.done === null; n++) {
    const sea = pl.sea === 'bay' ? 0 : seaFor(lv);
    const { w, secs, revived } = play(pl, n, base, lv, sea, cap);
    const id = B.seas[sea].id;
    const record = w.wave > (best[id] ?? 0);
    const c = { ...w.st, ...sunkCounts(w.sunk), wave: w.wave, games: 1, [id]: w.wave };
    // the codex pays for each kind first sunk (game/meta/harbour.ts)
    const codex = firstSunk(totals, c).length * BF.codex.pearls;
    best = bestCounts(best, c);
    totals = addCounts(totals, c);
    const met = newlyMet(logged, best, totals);
    logged.push(...met.map((g) => g.id));
    // The doubling ad doubles the game's own pearls, not the captain's log (game/session.ts).
    const won = pearlsFor(w);
    const got = won * (pl.double ? 2 : 1) + met.reduce((s, g) => s + g.pearls, 0) + codex;
    pearls += got;
    total += secs / 60;
    const s = shopHarbour(pl, lv, pearls, best);
    pearls = s.left;
    life.games.push({ n, sea, wave: w.wave, mins: secs / 60, total, pearls: got, revived, record, goals: met.length, bought: s.bought, bosses: w.st.bosses + w.st.krakens });
    const game = n + 1;
    if (s.bought.length && life.firstBuy === null) life.firstBuy = game;
    if (w.st.bosses + w.st.krakens > 0 && life.firstBoss === null) life.firstBoss = game;
    B.seas.forEach((_, i) => {
      if (i > 0 && lv[chart(i)] && life.charts[i] === null) life.charts[i] = game;
    });
    flat = record || met.length || s.bought.length ? 0 : flat + 1;
    life.flatRun = Math.max(life.flatRun, flat);
    if (flat >= FLAT_QUIT && life.quit === null) life.quit = game;
    if (shoppingList(lv, best, true).length === 0) life.done = total;
  }
  return life;
}
