// Scripted players for the balance guard, ported from prototype/tools/sim2.js: they look along
// the current aim (ray.ts, the prototype's rayFirst), decide whether to tap, and shop by a
// fixed priority list. Deterministic: their reaction time is in ticks and their aim error comes
// from their own Prng, so a seed always plays the same game.

import { B, radToBrad, type Stats } from '../balance';
import { liftable } from '../monsters';
import { LANE_LEN_FP, LANE_WIDTH_FP } from '../lane';
import { rayFirst } from '../ray';
import { dist, TICK_RATE, toFp } from '../math/fixed';
import { Prng } from '../math/prng';
import { buyCard, buyMine, buyRepair, mineCost, repairCost, reroll } from '../shop';
import { fire, nextWave, startGame, step } from '../step';
import type { Tally, World } from '../world';

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
}

const BASE: Record<string, Omit<Persona, 'react' | 'err'> & { react: number; err: number }> = {
  good: { react: 0.1, err: 0.02, junk: true, fish: true, reroll: true, mines: true, spam: false },
  casual: { react: 0.3, err: 0.07, junk: true, fish: true, reroll: false, mines: false, spam: false },
  spam: { react: 0.15, err: 0.1, junk: false, fish: true, reroll: false, mines: false, spam: true },
};

/** A persona by name: good, casual or spam, optionally with -nofish and/or -nojunk. */
export function persona(name: string): Persona {
  const [base, ...mods] = name.split('-');
  const b = BASE[base];
  if (!b) throw new Error(`unknown persona ${name}`);
  return {
    ...b,
    react: Math.max(1, Math.round(b.react * TICK_RATE)),
    err: radToBrad(b.err),
    junk: b.junk && !mods.includes('nojunk'),
    fish: b.fish && !mods.includes('nofish'),
  };
}

/** Upgrade ids in the order the bot buys them. */
export const PRIO = ['grip', 'heft', 'barb', 'magnet', 'winch', 'grounds', 'multi', 'cast', 'pierce', 'blast', 'planks', 'swing', 'bait'];

const NEAR = toFp(300);
const SEEN_BEYOND = toFp(20);
const SEEN_SIDE = toFp(5);
const CLOSE_JUNK = toFp(200);
const CLOSE_MON = toFp(220);
const REROLL_ABOVE = 60;
const SPAM_CHANCE = 300;

function shop(w: World, p: Persona): void {
  while (w.hp <= w.maxHp - 3 && buyRepair(w));
  if (p.mines && w.mines < 1) buyMine(w);
  for (let pass = 0; pass < 6; pass++) {
    const order = w.cards
      .map((c, i) => [i, PRIO.indexOf(c.id)])
      .filter((x) => x[1] >= 0)
      .sort((a, b) => a[1] - b[1]);
    if (order.some(([i]) => buyCard(w, i))) continue;
    if (p.reroll && w.coins > REROLL_ABOVE && reroll(w)) continue;
    break;
  }
  if (p.mines) while (w.mines < 3 && w.coins > mineCost(w) * 2 && buyMine(w));
  if (w.hp < w.maxHp && w.coins > repairCost(w) * 2) buyRepair(w);
  nextWave(w);
}

/** Whether the persona taps now, looking along `ang`. */
function decide(w: World, p: Persona, ang: number, rng: Prng): boolean {
  if (p.spam) return rng.int(1000) < SPAM_CHANCE;
  const mons = w.mons.filter((m) => m.d < LANE_LEN_FP + SEEN_BEYOND && m.w > -SEEN_SIDE && m.w < LANE_WIDTH_FP + SEEN_SIDE);
  if (w.held) {
    const r = rayFirst(w, ang, true);
    return !!r && r.o.t === 'mon' && (!liftable(w, r.o.m) || r.len < CLOSE_JUNK || !p.junk);
  }
  const r = rayFirst(w, ang, false);
  if (!r) return false;
  if (r.o.t === 'mon') {
    const m = r.o.m;
    return liftable(w, m) || m.hp <= w.up.barb || r.len < CLOSE_MON || !p.junk;
  }
  if (r.o.item.kind === 'junk') return p.junk && mons.some((m) => !liftable(w, m));
  const near = mons.some((m) => dist(m.d - B.crane.d, m.w - B.crane.w) < NEAR);
  return p.fish && !near;
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

  constructor(seed: number, name: string) {
    this.p = persona(name);
    this.rng = new Prng(seed * 7 + 5);
  }

  /** Shops and starts the next wave in the shop; in a wave, looks along the aim and maybe taps. */
  tick(w: World): void {
    if (w.phase === 'shop') {
      shop(w, this.p);
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

/** Plays one game to the end (or `maxWave`, or `maxSecs` of game time). */
export function playGame(seed: number, name: string, maxWave = 30, maxSecs = 3600): GameResult {
  const pilot = new Pilot(seed, name);
  const w = startGame(seed);
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
