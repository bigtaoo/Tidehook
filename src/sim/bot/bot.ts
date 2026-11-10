// Scripted players for the balance guard, ported from prototype/tools/sim2.js: they look along
// the current aim (ray.ts, the prototype's rayFirst; with junk in hand the throw's sight, lead.ts),
// decide whether to tap, and shop by a fixed priority list. Deterministic: their reaction time is
// in ticks and their aim error comes from their own Prng, so a seed always plays the same game.

import { B, radToBrad, type Stats } from '../balance';
import { liftable } from '../monsters';
import { LANE_LEN_FP, LANE_WIDTH_FP } from '../lane';
import { throwFirst } from '../lead';
import type { MetaLevels } from '../meta';
import { rayFirst } from '../ray';
import { dist, TICK_RATE, toFp } from '../math/fixed';
import { Prng } from '../math/prng';
import { buyCard, buyMine, buyRepair, mineCost, repairCost, reroll } from '../shop';
import { fire, nextWave, startGame, step } from '../step';
import type { Tally, World } from '../world';
import { seen } from '../weather';

export interface Persona {
  /** Ticks between looks. */
  react: number;
  /** Aim error, brads either way. */
  err: number;
  /** Uses junk: grabs it when a heavy monster is about, throws it. */
  junk: boolean;
  /** Goes fishing when no monster is close. */
  fish: boolean;
  reroll: boolean;
  mines: boolean;
  /** Taps at random instead of looking. */
  spam: boolean;
  /** Repairs in the shop while the dock is down this much or more (3 when unset). */
  repairAt?: number;
  /** Picks the shop's cards at random instead of by PRIO. */
  randomCards?: boolean;
  /** Fishes even with a monster close to the dock. */
  fishNear?: boolean;
}

const BASE: Record<string, PersonaSpec> = {
  good: { react: 0.1, err: 0.02, junk: true, fish: true, reroll: true, mines: true, spam: false },
  casual: { react: 0.3, err: 0.07, junk: true, fish: true, reroll: false, mines: false, spam: false },
  novice: { react: 0.5, err: 0.14, junk: true, fish: true, reroll: false, mines: false, spam: false },
  spam: { react: 0.15, err: 0.1, junk: false, fish: true, reroll: false, mines: false, spam: true },
};

/** A persona with its reaction in seconds and its aim error in radians, as BASE writes them. */
export type PersonaSpec = Omit<Persona, 'react' | 'err'> & { react: number; err: number };

/** A persona from seconds and radians (scripts/players builds its own this way). */
export function personaFrom(b: PersonaSpec): Persona {
  return { ...b, react: Math.max(1, Math.round(b.react * TICK_RATE)), err: radToBrad(b.err) };
}

/** A persona by name: good, casual, novice (played like the recorded human rounds, scripts/guard/
 *  novice.test.ts) or spam, optionally with -nofish and/or -nojunk. */
export function persona(name: string): Persona {
  const [base, ...mods] = name.split('-');
  const b = BASE[base];
  if (!b) throw new Error(`unknown persona ${name}`);
  return personaFrom({ ...b, junk: b.junk && !mods.includes('nojunk'), fish: b.fish && !mods.includes('nofish') });
}

/** Upgrade ids in the order the bot buys them. */
export const PRIO = ['grip', 'heft', 'barb', 'shanty', 'scatter', 'keg', 'barnacle', 'golden', 'magnet', 'winch', 'grounds', 'multi', 'cast', 'pierce', 'salvage', 'blast', 'tar', 'planks', 'swing', 'bait'];

const NEAR = toFp(300);
const SEEN_BEYOND = toFp(20);
const SEEN_SIDE = toFp(5);
const CLOSE_JUNK = toFp(200);
const CLOSE_MON = toFp(220);
const REROLL_ABOVE = 60;
const SPAM_CHANCE = 300;

function shop(w: World, p: Persona, rng: Prng): void {
  const repairAt = p.repairAt ?? 3;
  while (w.hp <= w.maxHp - repairAt && buyRepair(w));
  if (p.mines && w.mines < 1) buyMine(w);
  for (let pass = 0; pass < 6; pass++) {
    const order = w.cards
      .map((c, i) => [i, p.randomCards ? rng.int(1000) : PRIO.indexOf(c.id)])
      .filter((x) => x[1] >= 0)
      .sort((a, b) => a[1] - b[1]);
    if (order.some(([i]) => buyCard(w, i))) continue;
    if (p.reroll && w.coins > REROLL_ABOVE && reroll(w)) continue;
    break;
  }
  if (p.mines) while (w.mines < 3 && w.coins > mineCost(w) * 2 && buyMine(w));
  if (repairAt <= 3 && w.hp < w.maxHp && w.coins > repairCost(w) * 2) buyRepair(w);
  nextWave(w);
}

/** Whether the persona taps now, looking along `ang`. */
function decide(w: World, p: Persona, ang: number, rng: Prng): boolean {
  if (p.spam) return rng.int(1000) < SPAM_CHANCE;
  // nothing in the fog is seen (weather.ts)
  const mons = w.mons.filter((m) => m.d < LANE_LEN_FP + SEEN_BEYOND && m.w > -SEEN_SIDE && m.w < LANE_WIDTH_FP + SEEN_SIDE && seen(w, m.d));
  if (w.held) {
    // the sight the player sees: it leads a walking monster (lead.ts)
    const r = throwFirst(w, ang);
    return !!r && seen(w, r.m.d) && (!liftable(w, r.m) || r.len < CLOSE_JUNK || !p.junk);
  }
  const r = rayFirst(w, ang, false);
  if (!r || !seen(w, r.o.t === 'mon' ? r.o.m.d : r.o.item.d)) return false;
  if (r.o.t === 'mon') {
    const m = r.o.m;
    // a hermit's shell comes off as junk to throw: always worth a cast
    return liftable(w, m) || m.shell > 0 || m.hp <= w.up.barb || r.len < CLOSE_MON || !p.junk;
  }
  if (r.o.item.kind === 'junk') return p.junk && mons.some((m) => !liftable(w, m));
  const near = mons.some((m) => dist(m.d - B.crane.d, m.w - B.crane.w) < NEAR);
  return p.fish && (!near || !!p.fishNear);
}

export interface ShopVisit {
  wave: number;
  hp: number;
  coins: number;
}

export interface GameResult {
  seed: number;
  wave: number;
  over: boolean;
  secs: number;
  st: Tally;
  lv: Record<string, number>;
  up: Stats;
  shops: ShopVisit[];
}

/** A persona at the controls of a live world: the view's ?autoplay and playGame both drive it.
 *  Call `tick` once before each step. */
export class Pilot {
  readonly p: Persona;
  private readonly rng: Prng;
  private cd = 0;

  constructor(seed: number, who: string | Persona) {
    this.p = typeof who === 'string' ? persona(who) : who;
    this.rng = new Prng(seed * 7 + 5);
  }

  /** Shops and starts the next wave in the shop; in a wave, looks along the aim and maybe taps. */
  tick(w: World): void {
    if (w.phase === 'shop') {
      shop(w, this.p, this.rng);
      return;
    }
    if (w.phase !== 'wave') return;
    this.cd--;
    if (w.hook.st === 'swing' && this.cd <= 0) {
      this.cd = this.p.react;
      const ang = w.hook.ang + this.rng.range(-this.p.err, this.p.err);
      if (decide(w, this.p, ang, this.rng)) fire(w);
    }
  }
}

/** Plays one game to the end (or `maxWave`, or `maxSecs` of game time); `ease` makes it a new
 *  player's game (tide.ts), `sea` sails it on another sea (seas.ts). */
export function playGame(seed: number, name: string, maxWave = 30, maxSecs = 3600, ease = 0, meta: MetaLevels = {}, sea = 0): GameResult {
  const pilot = new Pilot(seed, name);
  const w = startGame(seed, ease, meta, sea);
  const shops: ShopVisit[] = [];
  let t = 0;
  while (t < maxSecs * TICK_RATE) {
    if (w.phase === 'over' || w.wave > maxWave) break;
    if (w.phase === 'shop') {
      shops.push({ wave: w.wave, hp: w.hp, coins: w.coins });
      pilot.tick(w);
      continue;
    }
    pilot.tick(w);
    step(w);
    t++;
  }
  return { seed, wave: w.wave, over: w.phase === 'over', secs: Math.round(t / TICK_RATE), st: w.st, lv: w.lv, up: w.up, shops };
}
