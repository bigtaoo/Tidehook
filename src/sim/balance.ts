// Every number of the game, read once from balance.json and turned into the sim's integer units:
// lengths in FP, speeds in FP per tick, times in ticks, multipliers in permille, angles in brads.
// The JSON keeps the prototype's units (world units, seconds, radians), so a value there can be
// checked against prototype/v2.html by eye.

import json from './balance.json';
import { perTick, pm, ticks, toFp, TICK_RATE } from './math/fixed';
import { BRAD_FULL } from './math/trig';

/** Radians to brads, for configuration constants. */
export function radToBrad(rad: number): number {
  return Math.round((rad / (2 * Math.PI)) * BRAD_FULL);
}

/** Radians per second to brads per tick. */
function bradPerTick(radPerSecond: number): number {
  return Math.round((radPerSecond / (2 * Math.PI)) * BRAD_FULL / TICK_RATE);
}

export type MonsterKind = 'grunt' | 'darter' | 'brute' | 'glutton' | 'hermit' | 'ray' | 'boss' | 'kraken';
/** The bosses: the giant turtle every few waves, the kraken in its place every so many more. */
export type BossKind = 'boss' | 'kraken';
/** The kinds a wave's mix is made of (waves.ts); a boss comes on its own every few waves. */
export type CrewKind = Exclude<MonsterKind, BossKind>;
export const CREW_KINDS: readonly CrewKind[] = ['grunt', 'darter', 'brute', 'glutton', 'hermit', 'ray'];
export const MONSTER_KINDS: readonly MonsterKind[] = [...CREW_KINDS, 'boss', 'kraken'];

export interface MonsterSpec {
  hp: number;
  /** FP per tick at wave 1. */
  speed: number;
  /** FP. */
  radius: number;
  /** Dock hit points it takes on reaching the crane. */
  dmg: number;
  /** Comes in from the sides, weaves, and ignores fish. */
  swims: boolean;
  /** Seeks fish from further away, keeps eating, and grows on what it eats. */
  greedy: boolean;
  /** Wears a shell that takes the first hit, whatever it is; the hook knocks it off as junk. */
  shell: boolean;
  /** Dives now and then, out of reach of the hook and of thrown junk; ignores fish. */
  dives: boolean;
  /** A boss: never lifted, barely knocked back, sunk for its chest and pearls. */
  boss: boolean;
}

/** The player's upgradable numbers, each in its own integer unit. */
export interface Stats {
  /** Heaviest monster the hook lifts. */
  grip: number;
  /** Damage of a thrown piece of junk. */
  heft: number;
  /** Reel speed, permille. */
  winch: number;
  /** Cast speed, permille. */
  cast: number;
  /** Damage the hook does to a monster too heavy to lift. */
  barb: number;
  /** Extra monsters a throw goes through. */
  pierce: number;
  /** Splash level of a thrown piece of junk. */
  blast: number;
  /** How far fish draw monsters, FP. */
  lure: number;
  /** How long monsters eat, permille. */
  chew: number;
  /** Swing amplitude, brads. */
  swing: number;
  /** Extra catches one cast carries. */
  multi: number;
  /** Magnet level: pulls fish in while reeling. */
  magnet: number;
  /** Ticks a thrown piece of junk stuns for, on top of the throw's own. */
  tar: number;
  /** Salvage level: sunk monsters leave junk behind (monsters.ts kill). */
  salvage: number;
  /** Fishing grounds level: worth, restock and cap of fish. */
  grounds: number;
}
export type StatKey = keyof Stats;

/** Something an add can raise besides a stat: the dock's hit points and, for the harbour's upgrades
 *  (meta.ts), the coins a game starts with and the hit points patched after each wave. */
export type Extra = 'dock' | 'coins' | 'mend' | 'mines' | 'stall';
export type Effect = { stat: StatKey | Extra; add: number } | { stat: StatKey; mul: number };

export interface UpgradeSpec {
  id: string;
  base: number;
  max: number;
  /** Price growth per level owned, permille. */
  growth: number;
  /** One of the cards a shop always offers at least one of. */
  core: boolean;
  /** Shown as an ability rather than a stat. */
  ability: boolean;
  /** Each in the stat's own unit (an add) or permille (a mul). */
  effects: readonly Effect[];
  /** A harbour unlock: each level starts the game with a level of this shop card (meta.ts). */
  card?: string;
  /** A shop card the shop only offers once its harbour blueprint is bought. */
  locked: boolean;
  /** A harbour blueprint: owning it lets the shop offer this locked card (meta.ts). */
  unlock?: string;
}

/** A captain's log entry: reach `n` of `stat` in one game, or over every game played. The stats
 *  are a game's tally (world.ts Tally) plus `wave` (reached) and `games` (1 a game). */
/** A sea (seas.ts): how many waves of tide it starts ahead, and permille scales on the pearls a
 *  game brings home, the monsters' speed and the gap between spawns; the chart's pearl price, and
 *  the wave the sea before it must be reached to before the chart is on sale. */
export interface SeaSpec {
  id: string;
  lead: number;
  pearls: number;
  speed: number;
  gap: number;
  price: number;
  needs: number;
}

export interface GoalSpec {
  id: string;
  kind: 'game' | 'total';
  stat: string;
  n: number;
  pearls: number;
}

/** How a stat's JSON value turns into its integer unit. */
const STAT_UNIT: Record<StatKey | Extra, (v: number) => number> = {
  grip: Math.round, heft: Math.round, barb: Math.round, pierce: Math.round, blast: Math.round,
  multi: Math.round, magnet: Math.round, grounds: Math.round, salvage: Math.round, tar: ticks, dock: Math.round, coins: Math.round, mend: Math.round, mines: Math.round, stall: Math.round,
  winch: pm, cast: pm, chew: pm, lure: toFp, swing: radToBrad,
};

const j = json;
const sec = ticks;
const mon = j.monster;
const c = j.catch;

interface UpgradeJson {
  id: string;
  base: number;
  max: number;
  growth?: number;
  core?: boolean;
  ability?: boolean;
  card?: string;
  locked?: boolean;
  unlock?: string;
  effects: { stat: string; add?: number; mul?: number }[];
}

function upgradeSpec(u: UpgradeJson): UpgradeSpec {
  return {
    id: u.id,
    base: u.base,
    max: u.max,
    growth: pm(u.growth ?? j.shop.priceGrowth),
    core: !!u.core,
    ability: !!u.ability,
    effects: u.effects.map((e): Effect => {
      const stat = e.stat as StatKey | Extra;
      if (e.mul !== undefined) return { stat: stat as StatKey, mul: pm(e.mul) };
      return { stat, add: STAT_UNIT[stat](e.add ?? 0) };
    }),
    ...(u.card ? { card: u.card } : {}),
    locked: !!u.locked,
    ...(u.unlock ? { unlock: u.unlock } : {}),
  };
}

interface MonsterJson { hp: number; speed: number; radius: number; dmg: number; swims?: boolean; greedy?: boolean; shell?: boolean; dives?: boolean; boss?: boolean }

function monster(m: MonsterJson): MonsterSpec {
  return { hp: m.hp, speed: perTick(m.speed), radius: toFp(m.radius), dmg: m.dmg, swims: !!m.swims, greedy: !!m.greedy, shell: !!m.shell, dives: !!m.dives, boss: !!m.boss };
}

export const B = {
  crane: { d: toFp(j.crane.d), w: toFp(j.crane.w), reach: toFp(j.crane.reach), aimOffset: toFp(j.crane.aimOffset) },
  dock: { hp: j.dock.hp, edge: toFp(j.dock.edge) },
  hook: {
    castSpeed: perTick(j.hook.castSpeed),
    reelSpeed: perTick(j.hook.reelSpeed),
    weightDrag: pm(j.hook.weightDrag),
    step: toFp(j.hook.step),
    tip: toFp(j.hook.tip),
    startLen: toFp(j.hook.startLen),
    homeLen: toFp(j.hook.homeLen),
    margin: toFp(j.hook.margin),
    swingRate: bradPerTick(j.hook.swingRate),
    spread: toFp(j.hook.spread),
    magnetMinLen: toFp(j.hook.magnetMinLen),
    magnetBase: toFp(j.hook.magnetBase),
    magnetPer: toFp(j.hook.magnetPer),
    aimSlow: pm(j.hook.aimSlow),
  },
  throw: {
    speed: perTick(j.throw.speed),
    step: toFp(j.throw.step),
    radius: toFp(j.throw.radius),
    offset: toFp(j.throw.offset),
    margin: toFp(j.throw.margin),
    behindDock: toFp(j.throw.behindDock),
    aimSlow: pm(j.throw.aimSlow),
    stun: sec(j.throw.stun),
    knock: toFp(j.throw.knock),
    blastBase: toFp(j.throw.blastBase),
    blastPer: toFp(j.throw.blastPer),
  },
  bounce: { stun: sec(j.bounce.stun), knock: toFp(j.bounce.knock) },
  mine: {
    max: j.mine.max,
    radius: toFp(j.mine.radius),
    dmgBase: j.mine.dmgBase,
    dmgPerWave: pm(j.mine.dmgPerWave),
    stun: sec(j.mine.stun),
    knock: toFp(j.mine.knock),
  },
  monsters: {
    grunt: monster(j.monsters.grunt),
    darter: monster(j.monsters.darter),
    brute: monster(j.monsters.brute),
    glutton: monster(j.monsters.glutton),
    hermit: monster(j.monsters.hermit),
    ray: monster(j.monsters.ray),
    boss: monster(j.monsters.boss),
    kraken: monster(j.monsters.kraken),
  } satisfies Record<MonsterKind, MonsterSpec>,
  /** The giant turtle: every `every` waves, halfway through the wave, with a chest on its back worth
   *  `chest` coins at wave 1 (growing like a catch's value); it takes `knock` permille of a knock
   *  and brings `pearls` home when killed. */
  boss: { every: j.boss.every, chest: j.boss.chest, knock: pm(j.boss.knock), pearls: j.boss.pearls },
  /** The kraken: the boss of every `every`th wave from wave `from` instead of the turtle, with a chest `chest`
   *  permille of the turtle's; every `summon` ticks it calls up `brood` crabs beside it, `max` in
   *  all; it brings `pearls` home. */
  kraken: { from: j.kraken.from, every: j.kraken.every, chest: pm(j.kraken.chest), summon: sec(j.kraken.summon), brood: j.kraken.brood, max: j.kraken.max, pearls: j.kraken.pearls },
  /** A diver (the ray) is under for `under` ticks of every `every`, but never within `near` FP of
   *  the dock, where it stays up to be dealt with. */
  dive: { every: sec(j.dive.every), under: sec(j.dive.under), near: toFp(j.dive.near) },
  monster: {
    hpPerWave: pm(mon.hpPerWave),
    speedPerWave: pm(mon.speedPerWave),
    farBeyond: toFp(mon.farBeyond),
    farMargin: toFp(mon.farMargin),
    sideFromWave: mon.sideFromWave,
    sideChance: pm(mon.sideChance),
    sideBeyond: toFp(mon.sideBeyond),
    sideMinD: toFp(mon.sideMinD),
    sideMaxD: toFp(mon.sideMaxD),
    wobbleRate: bradPerTick(mon.wobbleRate),
    wobble: pm(mon.wobble),
    knockBeyond: toFp(mon.knockBeyond),
    eatSmall: sec(mon.eatSmall),
    eatBig: sec(mon.eatBig),
    eatReach: toFp(mon.eatReach),
    gluttonLure: toFp(mon.gluttonLure),
    gluttonGrowSmall: mon.gluttonGrowSmall,
    gluttonGrowBig: mon.gluttonGrowBig,
    gluttonGrowRadius: toFp(mon.gluttonGrowRadius),
    gluttonMaxRadius: toFp(mon.gluttonMaxRadius),
  },
  waves: {
    mix: j.waves.mix satisfies Record<CrewKind, { from: number; base: number; offset: number; per: number }>,
    debutSlot: j.waves.debutSlot,
    firstDelay: sec(j.waves.firstDelay),
    gapStart: sec(j.waves.gapStart),
    gapPerWave: pm(j.waves.gapPerWave),
    gapMin: sec(j.waves.gapMin),
    jitterMin: pm(j.waves.jitterMin),
    jitterMax: pm(j.waves.jitterMax),
    clearDelay: sec(j.waves.clearDelay),
  },
  tide: { waves: j.tide.waves, pace: pm(j.tide.pace) },
  meta: { perWave: j.meta.perWave, upgrades: j.meta.upgrades.map(upgradeSpec) },
  catch: {
    startFish: c.startFish,
    startJunk: c.startJunk,
    restockFish: c.restockFish,
    restockJunk: c.restockJunk,
    fishCap: c.fishCap,
    junkCap: c.junkCap,
    chestChance: pm(c.chestChance),
    fishRadius: toFp(c.fishRadius),
    chestRadius: toFp(c.chestRadius),
    junkRadius: toFp(c.junkRadius),
    fishWeight: c.fishWeight,
    chestWeight: c.chestWeight,
    junkWeight: c.junkWeight,
    wallMargin: toFp(c.wallMargin),
    nearMargin: toFp(c.nearMargin),
    farMargin: toFp(c.farMargin),
    spacing: toFp(c.spacing),
    tries: c.tries,
    valueSpan: toFp(c.valueSpan),
    fishValue: c.fishValue,
    fishValueFar: c.fishValueFar,
    chestValue: c.chestValue,
    chestValueFar: c.chestValueFar,
    valuePerWave: pm(c.valuePerWave),
    dropChest: c.dropChest,
    returnMargin: toFp(c.returnMargin),
    returnNear: toFp(c.returnNear),
  },
  shop: {
    cards: j.shop.cards,
    priceGrowth: pm(j.shop.priceGrowth),
    rerollBase: j.shop.rerollBase,
    rerollPer: j.shop.rerollPer,
    repairBase: j.shop.repairBase,
    repairPerWave: j.shop.repairPerWave,
    repairHp: j.shop.repairHp,
    mineBase: j.shop.mineBase,
    minePerWave: j.shop.minePerWave,
  },
  grounds: { valueBonus: pm(j.grounds.valueBonus), restockBonus: j.grounds.restockBonus, capBonus: j.grounds.capBonus },
  /** Salvage level L leaves junk behind every (every - L)th monster sunk. */
  salvage: { every: j.salvage.every as number },
  /** The seas (seas.ts), the home bay first. */
  seas: (j.seas as SeaSpec[]).map((s) => ({ ...s })),
  /** The captain's log (goals.ts): [kind, stat, n, pearls] each. */
  goals: (j.goals as [string, string, number, number][]).map(([kind, stat, n, pearls]): GoalSpec => ({
    id: `${kind}.${stat}.${n}`,
    kind: kind as GoalSpec['kind'],
    stat,
    n,
    pearls,
  })),
  start: Object.fromEntries(Object.entries(j.start).map(([k, v]) => [k, STAT_UNIT[k as StatKey](v)])) as unknown as Stats,
  upgrades: j.upgrades.map(upgradeSpec),
};


