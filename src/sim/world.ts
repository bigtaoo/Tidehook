// The whole simulation state, as plain data: integers, strings, booleans and arrays of them, so
// it hashes (hash.ts) and snapshots without help. Things refer to each other by id, never by
// reference. Positions are lane points in FP: `d` out from the dock, `w` across (lane.ts).

import { B, type MonsterKind, type Stats } from './balance';
import type { SimEvent } from './events';
import { Prng } from './math/prng';

export type Phase = 'wave' | 'shop' | 'over';
export type Calm = 0 | 1 | 2;
/** A wave's sea event (seaEvents.ts), '' for an ordinary wave. */
export type SeaEvent = '' | 'frenzy' | 'gold' | 'bounty' | 'swarm';

/** Something in the water the hook can catch: a fish, a chest (a big fish) or junk to throw; or a
 *  crushed pufferfish in the crane's hand, a bomb to throw (never in the water). */
export interface Item {
  id: number;
  kind: 'fish' | 'junk' | 'puffer';
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
  /** A gold fish: rare, shining, worth several times a fish (fun.ts). */
  gold: boolean;
}

export interface Monster {
  id: number;
  kind: MonsterKind;
  d: number;
  w: number;
  hp: number;
  /** Hit points at full health: what spawn gave it, grown with a glutton. The health display
   *  reads the share left of it (view/scene/look.ts bars). */
  hp0: number;
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
  /** The bounty event's marked monster: tougher, and pays a purse when sunk (seaEvents.ts). */
  bounty: boolean;
  /** A caught moray's ticks left fighting the hook (fun.ts). */
  tug: number;
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
  /** This cast was aimed dead on its target: it flies and reels faster (fun.ts). */
  perfect: boolean;
}

/** A piece of junk thrown from the crane. */
export interface Shot {
  d: number;
  w: number;
  /** Direction, permille: (cos, sin) of the aim. */
  ud: number;
  uw: number;
  pierce: number;
  /** Damage it does: the heft, less for a scattershot's side throws. */
  dmg: number;
  /** A pufferfish bomb: blows up over this many FP on the first hit; 0 for junk. */
  boom: number;
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
  /** The fun layer (fun.ts): the longest kill streak, perfect casts, gold fish landed, the voyage's
   *  end reached (1), pufferfish bombs thrown, bounties sunk and morays landed. */
  combo: number;
  perfects: number;
  golds: number;
  voyage: number;
  puffs: number;
  bounties: number;
  morays: number;
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
  /** The kill streak so far, and ticks left for the next kill to carry it on (fun.ts). */
  combo: number;
  comboT: number;
  /** This wave's sea event, and the spawns left before the bounty's mark (seaEvents.ts). */
  event: SeaEvent;
  bounty: number;
  /** Monsters sunk this game, by kind: the harbour's codex adds them up (goals.ts counts). */
  sunk: Record<string, number>;
  /** One stream per concern, so a change in one does not shift the others; `luck` draws the fun
   *  layer's chances (gold fish, rare cards, sea events). */
  rng: { spawn: Prng; catch: Prng; shop: Prng; luck: Prng };
  /** What happened this tick, for the view and audio; cleared at the start of each step. */
  events: SimEvent[];
}

export function newTally(): Tally {
  return { kills: 0, crush: 0, leak: 0, mined: 0, spat: 0, eaten: 0, spent: 0, casts: 0, throws: 0, bounce: 0, junkKills: 0, mines: 0, dropped: 0, recaught: 0, bosses: 0, krakens: 0, shells: 0, rays: 0, combo: 0, perfects: 0, golds: 0, voyage: 0, puffs: 0, bounties: 0, morays: 0 };
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
    hook: { st: 'swing', ang: 0, ph: 0, rate: B.hook.swingRate, len: 0, grabs: [], perfect: false },
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
    combo: 0,
    comboT: 0,
    event: '',
    bounty: -1,
    sunk: {},
    rng: { spawn: new Prng(seed * 3 + 1), catch: new Prng(seed * 3 + 2), shop: new Prng(seed * 3 + 3), luck: new Prng(seed * 3 + 0x51ed27) },
    events: [],
  };
}

export function nextId(w: World): number {
  return w.nextId++;
}
