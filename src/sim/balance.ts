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

export type MonsterKind = 'grunt' | 'darter' | 'brute' | 'glutton';
export const MONSTER_KINDS: readonly MonsterKind[] = ['grunt', 'darter', 'brute', 'glutton'];

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
  /** Fishing grounds level: worth, restock and cap of fish. */
  grounds: number;
}
export type StatKey = keyof Stats;

export type Effect = { stat: StatKey | 'dock'; add: number } | { stat: StatKey; mul: number };

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
}

/** How a stat's JSON value turns into its integer unit. */
const STAT_UNIT: Record<StatKey | 'dock', (v: number) => number> = {
  grip: Math.round, heft: Math.round, barb: Math.round, pierce: Math.round, blast: Math.round,
  multi: Math.round, magnet: Math.round, grounds: Math.round, dock: Math.round,
  winch: pm, cast: pm, chew: pm, lure: toFp, swing: radToBrad,
};

const j = json;
const sec = ticks;
const mon = j.monster;
const c = j.catch;

function monster(m: { hp: number; speed: number; radius: number; dmg: number; swims?: boolean; greedy?: boolean }): MonsterSpec {
  return { hp: m.hp, speed: perTick(m.speed), radius: toFp(m.radius), dmg: m.dmg, swims: !!m.swims, greedy: !!m.greedy };
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
  },
  throw: {
    speed: perTick(j.throw.speed),
    step: toFp(j.throw.step),
    radius: toFp(j.throw.radius),
    offset: toFp(j.throw.offset),
    margin: toFp(j.throw.margin),
    behindDock: toFp(j.throw.behindDock),
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
  } satisfies Record<MonsterKind, MonsterSpec>,
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
    mix: j.waves.mix satisfies Record<MonsterKind, { from: number; base: number; offset: number; per: number }>,
    debutSlot: j.waves.debutSlot,
    firstDelay: sec(j.waves.firstDelay),
    gapStart: sec(j.waves.gapStart),
    gapPerWave: pm(j.waves.gapPerWave),
    gapMin: sec(j.waves.gapMin),
    jitterMin: pm(j.waves.jitterMin),
    jitterMax: pm(j.waves.jitterMax),
    clearDelay: sec(j.waves.clearDelay),
  },
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
  start: Object.fromEntries(Object.entries(j.start).map(([k, v]) => [k, STAT_UNIT[k as StatKey](v)])) as unknown as Stats,
  upgrades: j.upgrades.map((u): UpgradeSpec => ({
    id: u.id,
    base: u.base,
    max: u.max,
    growth: pm('growth' in u && u.growth !== undefined ? u.growth : j.shop.priceGrowth),
    core: 'core' in u && !!u.core,
    ability: 'ability' in u && !!u.ability,
    effects: u.effects.map((e): Effect => {
      const stat = e.stat as StatKey | 'dock';
      if ('mul' in e && e.mul !== undefined) return { stat: stat as StatKey, mul: pm(e.mul) };
      return { stat, add: STAT_UNIT[stat]((e as { add: number }).add) };
    }),
  })),
};


