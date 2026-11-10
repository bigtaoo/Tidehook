// The whole simulation state, as plain data: integers, strings, booleans and arrays of them, so
// it hashes (hash.ts) and snapshots without help. Things refer to each other by id, never by
// reference. Positions are lane points in FP: `d` out from the dock, `w` across (lane.ts).

import { B, type MonsterKind, type Stats } from './balance';
import type { SimEvent } from './events';
import { Prng } from './math/prng';

export type Phase = 'wave' | 'shop' | 'over';
export type Calm = 0 | 1 | 2;

/** Something in the water the hook can catch: a fish, a chest (a big fish) or junk to throw. */
export interface Item {
  id: number;
  kind: 'fish' | 'junk';
  /** A treasure chest: a big, heavy, valuable catch. Only for fish. */
  chest: boolean;
  d: number;
  w: number;
  r: number;
  /** Coins it brings in (fish), 0 for junk. */
  val: number;
  /** How much it slows the reel. */
  wt: number;
  /** Spilled by a glutton killed at sea: the coins it had eaten, back in the water. */
  dropped: boolean;
}

export interface Monster {
  id: number;
  kind: MonsterKind;
  d: number;
  w: number;
  hp: number;
  r: number;
  /** FP per tick. */
  speed: number;
  /** Ticks left stunned. */
  stun: number;
  /** Id of the item it is eating, 0 for none. */
  eat: number;
  /** Ticks left until the item is eaten. */
  eatT: number;
  /** Items eaten so far. */
  full: number;
  /** Coins eaten so far (a glutton gives them back when crushed). */
  ate: number;
  /** Wobble phase, brads. */
  ph: number;
  /** On the hook, being reeled in. */
  grab: boolean;
  /** The hermit's shell: 1 while worn (it takes the next hit), 0 once knocked off or for others. */
  shell: number;
  /** The kraken's ticks until it next calls up crabs, and how many it has called. */
  cd: number;
  brood: number;
}

export type Grab = { t: 'item'; item: Item } | { t: 'mon'; id: number };

export type HookState = 'swing' | 'out' | 'back';

export interface Hook {
  st: HookState;
  /** Aim, brads: 0 points straight out from the dock, positive toward +w. */
  ang: number;
  /** Swing phase, brads. */
  ph: number;
  /** How far the swing phase moved last tick, brads: slower while a throw would hit (hook.ts). */
  rate: number;
  /** Rope length, FP. */
  len: number;
  grabs: Grab[];
}

/** A piece of junk thrown from the crane. */
export interface Shot {
  d: number;
  w: number;
  /** Direction, permille: (cos, sin) of the aim. */
  ud: number;
  uw: number;
  pierce: number;
  /** Monsters already hit. */
  hit: number[];
}

export interface Card {
  id: string;
  bought: boolean;
}

export interface Tally {
  kills: number;
  crush: number;
  leak: number;
  mined: number;
  spat: number;
  eaten: number;
  spent: number;
  casts: number;
  throws: number;
  bounce: number;
  junkKills: number;
  mines: number;
  /** Coins spilled at sea by gluttons killed there, and how many of them were landed again. */
  dropped: number;
  recaught: number;
  /** Bosses killed (each brings pearls home, meta.ts), and how many of them were krakens. */
  bosses: number;
  krakens: number;
  /** Hermit shells knocked off, and rays sunk. */
  shells: number;
  rays: number;
}

export interface World {
  seed: number;
  tick: number;
  phase: Phase;
  wave: number;
  coins: number;
  hp: number;
  maxHp: number;
  mines: number;
  items: Item[];
  mons: Monster[];
  shots: Shot[];
  hook: Hook;
  /** The piece of junk in the crane's hand, ready to throw, or null. */
  held: Item | null;
  up: Stats;
  /** Upgrade levels owned, by id. */
  lv: Record<string, number>;
  /** Locked shop cards the harbour's blueprints let the shop offer (meta.ts). */
  plans: string[];
  /** The sea sailed, an index into B.seas (seas.ts). */
  sea: number;
  /** Cards the shop shows beyond its usual number (the harbour's stall). */
  stall: number;
  queue: MonsterKind[];
  /** Ticks until the next spawn. */
  spawnT: number;
  /** Ticks the lane has been clear. */
  clearT: number;
  cards: Card[];
  rerolls: number;
  /** Monster kinds already introduced. */
  seen: MonsterKind[];
  /** The tutorial's hold (docs/02-onboarding.md): 0 none; 1 no spawns; 2 one monster at a time,
   *  and it halts at CALM_D. Set from outside the step by the guide, never by the sim itself. */
  calm: Calm;
  /** Waves of slow difficulty climb a game opens with (tide.ts); 0 in a bare game. */
  ease: number;
  /** Hit points patched after each wave (tide.ts), from the harbour's upgrades (meta.ts). */
  mend: number;
  /** Hit points patched after the last wave, for the shop to say; 0 none. */
  mended: number;
  nextId: number;
  st: Tally;
  /** One stream per concern, so a change in one does not shift the others. */
  rng: { spawn: Prng; catch: Prng; shop: Prng };
  /** What happened this tick, for the view and audio; cleared at the start of each step. */
  events: SimEvent[];
}

export function newTally(): Tally {
  return { kills: 0, crush: 0, leak: 0, mined: 0, spat: 0, eaten: 0, spent: 0, casts: 0, throws: 0, bounce: 0, junkKills: 0, mines: 0, dropped: 0, recaught: 0, bosses: 0, krakens: 0, shells: 0, rays: 0 };
}

/** A fresh world before wave 1: the starting catch is in the water, the hook at rest. */
export function newWorld(seed: number, ease = 0): World {
  return {
    seed,
    tick: 0,
    phase: 'shop',
    wave: 0,
    coins: 0,
    hp: B.dock.hp,
    maxHp: B.dock.hp,
    mines: 0,
    items: [],
    mons: [],
    shots: [],
    hook: { st: 'swing', ang: 0, ph: 0, rate: B.hook.swingRate, len: 0, grabs: [] },
    held: null,
    up: { ...B.start },
    lv: {},
    plans: [],
    sea: 0,
    stall: 0,
    queue: [],
    spawnT: 0,
    clearT: 0,
    cards: [],
    rerolls: 0,
    seen: [],
    calm: 0,
    ease,
    mend: 0,
    mended: 0,
    nextId: 1,
    st: newTally(),
    rng: { spawn: new Prng(seed * 3 + 1), catch: new Prng(seed * 3 + 2), shop: new Prng(seed * 3 + 3) },
    events: [],
  };
}

export function nextId(w: World): number {
  return w.nextId++;
}
