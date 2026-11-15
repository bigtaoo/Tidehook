// One player's career (roster.ts), game after game on the slow tide, as scripts/career does it but
// with the player's own habits: their skill that game, their shop style, the revive and pearl
// doubling ads, how they spend pearls in the harbour and which sea they sail. It notes the moments
// that matter for keeping a player: the first purchase, the first boss, each chart, everything
// bought, and runs of "flat" games where nothing got better (no record, no log entry, nothing
// bought), the likeliest place to lose them. Deterministic: `base` picks the seeds.

import { FIRST_SEED } from '../../src/game/guide/firstSeed';
import { B } from '../../src/sim/balance';
import { personaFrom, Pilot } from '../../src/sim/bot/bot';
import { addCounts, bestCounts, counts, firstSunk, newlyMet, type Counts } from '../../src/sim/goals';
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
  /** The sitting ran out mid-wave: put in early, or lost outright where the game has no way to
   *  put in (roster.ts, LifeOptions.putIn). */
  lost: boolean;
  /** The captain took the way home at the voyage's end. */
  home: boolean;
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
  /** Games the sitting cut off mid-wave, and the minutes in them. Where the captain can put in
   *  early those minutes come home; without it they are thrown away. */
  lost: number;
  lostMins: number;
}

export interface LifeOptions {
  maxMins?: number;
  maxGames?: number;
  /** One game's longest, minutes. */
  gameCap?: number;
  /** The captain may put in early (game/session.ts putIn), banking a game the sitting cuts short
   *  instead of losing it. True unless a run asks for the old way, to compare.
   */
  putIn?: boolean;
}

interface Played {
  w: World;
  secs: number;
  revived: boolean;
  /** Sailed home at the voyage's end, which pays BF.voyage.home on top. */
  home: boolean;
  /** The sitting ran out before the game ended. The captain puts in early and banks what the
   *  dock has earned (game/session.ts putIn); with `putIn` off, the old way: the tab closes and
   *  the whole game is lost. */
  cut: boolean;
}

/** One game: the player at the controls until the dock falls (revived once, if they watch), or
 *  until their sitting runs out, or home at the voyage's end if that is their habit. */
function play(pl: Player, n: number, base: number, lv: Record<string, number>, sea: number, capSecs: number): Played {
  const seed = n === 0 ? FIRST_SEED : base * 1000 + n;
  const pilot = new Pilot(base * 1000 + n + 7, personaFrom({ ...pl.style, ...pl.skill(n) }));
  const w = startGame(seed, B.tide.waves, lv, sea);
  const sit = pl.sitting === undefined ? Infinity : pl.sitting * 60 * TICK_RATE;
  const stop = Math.min(capSecs * TICK_RATE, sit);
  let t = 0;
  let revived = false;
  while (t < stop) {
    if (w.phase === 'over') {
      if (!pl.revive || revived) break;
      revive(w);
      revived = true;
    }
    // the voyage's end: the captain may bank the game here instead of playing on (game/session.ts)
    if (pl.voyage === 'home' && w.st.voyage) return { w, secs: t / TICK_RATE, revived, home: true, cut: false };
    pilot.tick(w);
    if (w.phase === 'shop') continue;
    step(w);
    t++;
  }
  return { w, secs: t / TICK_RATE, revived, home: false, cut: t >= sit && w.phase !== 'over' };
}

/** Spends the pearls by the player's harbour habit. */
function shopHarbour(pl: Player, lv: Record<string, number>, pearls: number, best: Counts): { bought: string[]; left: number } {
  if (pl.harbour === 'none') return { bought: [], left: pearls };
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
  const canPutIn = opts.putIn ?? true;
  const lv: Record<string, number> = {};
  const life: Life = { player: pl.id, base, games: [], done: null, firstBuy: null, firstBoss: null, charts: B.seas.map((_, i) => (i === 0 ? 1 : null)), quit: null, flatRun: 0, lost: 0, lostMins: 0 };
  let pearls = 0;
  let total = 0;
  let best: Counts = {};
  let totals: Counts = {};
  const logged: string[] = [];
  let flat = 0;
  for (let n = 0; n < maxGames && total < maxMins && life.done === null; n++) {
    const sea = pl.sea === 'bay' ? 0 : seaFor(lv);
    const { w, secs, revived, home, cut } = play(pl, n, base, lv, sea, cap);
    total += secs / 60;
    const id = B.seas[sea].id;
    if (cut) {
      life.lost++;
      life.lostMins += secs / 60;
    }
    if (cut && !canPutIn) {
      // the old way: the tab closed mid-wave, so no pearls, no log, no record, and the minutes
      // are gone. Putting in early (game/session.ts) is what this branch was written to argue for.
      life.games.push({ n, sea, wave: w.wave, mins: secs / 60, lost: true, home: false, total, pearls: 0, revived, record: false, goals: 0, bought: [], bosses: w.st.bosses + w.st.krakens });
      flat++;
      life.flatRun = Math.max(life.flatRun, flat);
      if (flat >= FLAT_QUIT && life.quit === null) life.quit = n + 1;
      continue;
    }
    const record = w.wave > (best[id] ?? 0);
    const c = counts(w);
    // the codex pays for each kind first sunk (game/meta/harbour.ts)
    const codex = firstSunk(totals, c).length * BF.codex.pearls;
    best = bestCounts(best, c);
    totals = addCounts(totals, c);
    const met = newlyMet(logged, best, totals);
    logged.push(...met.map((g) => g.id));
    // The doubling ad doubles the game's own pearls, not the captain's log (game/session.ts).
    const won = pearlsFor(w) + (home ? BF.voyage.home : 0);
    const got = won * (pl.double ? 2 : 1) + met.reduce((s, g) => s + g.pearls, 0) + codex;
    pearls += got;
    const s = shopHarbour(pl, lv, pearls, best);
    pearls = s.left;
    life.games.push({ n, sea, wave: w.wave, mins: secs / 60, lost: cut, home, total, pearls: got, revived, record, goals: met.length, bought: s.bought, bosses: w.st.bosses + w.st.krakens });
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
