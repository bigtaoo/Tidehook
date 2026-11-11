// Sea monsters: they spawn out at sea, crawl toward the crane, stop to eat fish on the way, and
// hurt the dock when they reach it (prototype spawn, updMons, dmgMon, killMon, knock).

import { B, type MonsterKind } from './balance';
import { BF } from './balanceFun';
import { emit } from './events';
import { afterKill, byWave } from './fun';
import { dropFish, dropJunk } from './items';
import { LANE_LEN_FP, LANE_WIDTH_FP } from './lane';
import { clamp, dist, muldiv, roundDiv, times, toFp } from './math/fixed';
import { BRAD_FULL, sinB } from './math/trig';
import { isBoss } from './kinds';
import { seaOf } from './seas';
import { level } from './tide';
import { nextId, type Item, type Monster, type World } from './world';

const M = B.monster;
/** Under the tutorial's hold (World.calm 2) monsters halt this far down the lane, FP: well in
 *  reach of the hook, where the aim crosses a crab for longest short of crowding the dock. */
export const CALM_D = toFp(300);

export function spawn(w: World, kind: MonsterKind): Monster {
  const spec = B.monsters[kind];
  const rng = w.rng.spawn;
  // growth since wave 1 in permille of a wave (tide.ts: slower in a new player's games)
  const lv = level(w);
  const grown = lv - 1000;
  const hp = Math.max(1, roundDiv(spec.hp * (1_000_000 + M.hpPerWave * grown), 1_000_000));
  let pw: number;
  let pd: number;
  const boss = spec.boss;
  if (boss) {
    // straight up the middle, from far out, so it is seen coming
    pw = LANE_WIDTH_FP / 2;
    pd = LANE_LEN_FP + M.farBeyond + spec.radius;
  } else if (spec.swims || (lv >= M.sideFromWave * 1000 && rng.int(1000) < M.sideChance)) {
    pw = rng.int(2) === 0 ? -M.sideBeyond : LANE_WIDTH_FP + M.sideBeyond;
    pd = rng.range(M.sideMinD, M.sideMaxD);
  } else {
    pw = rng.range(M.farMargin, LANE_WIDTH_FP - M.farMargin);
    pd = LANE_LEN_FP + M.farBeyond;
  }
  const m: Monster = {
    id: nextId(w),
    kind,
    d: pd,
    w: pw,
    hp,
    hp0: hp,
    r: spec.radius,
    speed: muldiv(muldiv(spec.speed, 1_000_000 + M.speedPerWave * grown, 1_000_000), seaOf(w).speed, 1000),
    stun: 0,
    eat: 0,
    eatT: 0,
    full: 0,
    // the boss's chest (and a moray's purse): coins inside it like a glutton's, dropped where it
    // dies (kill)
    ate: boss ? (kind === 'kraken' ? muldiv(bossChest(w), B.kraken.chest, 1000) : bossChest(w)) : spec.tugs ? byWave(w, BF.moray.coins) : 0,
    ph: rng.int(BRAD_FULL),
    grab: false,
    shell: spec.shell ? 1 : 0,
    cd: kind === 'kraken' ? B.kraken.summon : 0,
    brood: 0,
    bounty: false,
    tug: 0,
  };
  w.mons.push(m);
  emit(w, { e: 'spawn', id: m.id, kind });
  return m;
}

/** The coins on the boss's back now: B.boss.chest, grown by wave like a catch's value. */
export function bossChest(w: World): number {
  return roundDiv(B.boss.chest * (1000 + B.catch.valuePerWave * Math.max(0, w.wave - 1)), 1000);
}

/** Whether the hook can lift it: its weight (= hit points) within the grip, and no shell on. Never
 *  a boss: it has to be sunk at sea, and its chest fished up. */
export function liftable(w: World, m: Monster): boolean {
  return !isBoss(m.kind) && !m.shell && m.hp <= w.up.grip;
}

/** Pushes a monster `k` FP along the permille direction (ud, uw), kept inside the lane. */
export function knock(m: Monster, ud: number, uw: number, k: number): void {
  // the boss barely budges
  if (isBoss(m.kind)) k = muldiv(k, B.boss.knock, 1000);
  m.w = clamp(m.w + muldiv(uw, k, 1000), m.r, LANE_WIDTH_FP - m.r);
  m.d = Math.min(LANE_LEN_FP + M.knockBeyond, m.d + muldiv(ud, k, 1000));
}

/** Damage from anything but the crane's crush; `thrown` counts the kill as a junk kill. */
export function damage(w: World, m: Monster, dmg: number, thrown: boolean): void {
  if (m.shell) {
    // the shell takes the hit and comes off
    m.shell = 0;
    w.st.shells++;
    emit(w, { e: 'shell', id: m.id, d: m.d, w: m.w });
    return;
  }
  m.hp -= dmg;
  emit(w, { e: 'hit', id: m.id, dmg, d: m.d, w: m.w, thrown });
  if (m.hp <= 0) {
    if (thrown) w.st.junkKills++;
    kill(w, m, false);
  }
}

/** Removes a monster. Crushed on the dock, a glutton (or the boss) spits its coins out; killed at
 *  sea, it drops them as a fish (a chest, if enough) to catch. */
export function kill(w: World, m: Monster, crushed: boolean): void {
  const i = w.mons.indexOf(m);
  if (i < 0) return;
  w.mons.splice(i, 1);
  w.st.kills++;
  if (crushed) w.st.crush++;
  if (isBoss(m.kind)) w.st.bosses++;
  if (m.kind === 'kraken') w.st.krakens++;
  if (m.kind === 'ray') w.st.rays++;
  if (m.kind === 'moray') w.st.morays++;
  w.sunk[m.kind] = (w.sunk[m.kind] ?? 0) + 1;
  emit(w, { e: 'kill', id: m.id, kind: m.kind, crushed, d: m.d, w: m.w });
  afterKill(w, m, crushed);
  if (B.monsters[m.kind].bursts) puffed(w, m, crushed);
  if (!crushed && w.up.salvage && w.st.kills % (B.salvage.every - w.up.salvage) === 0) dropJunk(w, m);
  if (m.ate <= 0) return;
  if (crushed) {
    w.coins += m.ate;
    w.st.spat += m.ate;
    emit(w, { e: 'coins', amount: m.ate, spat: true });
  } else {
    dropFish(w, m);
    emit(w, { e: 'drop', val: m.ate, d: m.d, w: m.w });
  }
}

/** A pufferfish dies: at sea it bursts, hurting what is near (which may burst in turn); crushed on
 *  the dock it is a bomb in the crane's hand, if the hand is free. */
function puffed(w: World, m: Monster, crushed: boolean): void {
  const P = BF.puffer;
  if (crushed) {
    if (w.held) return;
    w.held = { id: nextId(w), kind: 'puffer', chest: false, d: m.d, w: m.w, r: m.r, val: 0, wt: 0, dropped: false, gold: false };
    emit(w, { e: 'held' });
    return;
  }
  emit(w, { e: 'burst', d: m.d, w: m.w, r: P.burst });
  for (const o of [...w.mons]) {
    if (!o.grab && w.mons.includes(o) && dist(o.d - m.d, o.w - m.w) < P.burst + o.r) damage(w, o, P.burstDmg, false);
  }
}

export function gameOver(w: World): void {
  w.hp = 0;
  w.phase = 'over';
  emit(w, { e: 'over', wave: w.wave });
}

/** Finishes a meal: the item is gone; a glutton grows heavier and keeps the coins inside. */
function eaten(w: World, m: Monster, it: Item): void {
  w.items.splice(w.items.indexOf(it), 1);
  w.st.eaten += it.val;
  m.eat = 0;
  m.full++;
  for (const o of w.mons) if (o.eat === it.id) o.eat = 0;
  const greedy = B.monsters[m.kind].greedy;
  if (greedy) {
    const grew = it.chest ? M.gluttonGrowBig : M.gluttonGrowSmall;
    m.hp += grew;
    m.hp0 += grew;
    m.ate += it.val;
    m.r = Math.min(M.gluttonMaxRadius, m.r + M.gluttonGrowRadius);
  }
  emit(w, { e: 'eaten', id: m.id, val: it.val, grew: greedy });
}

/** The nearest fish within the monster's lure range, or null. */
function nearestFish(w: World, m: Monster): { it: Item; at: number } | null {
  let best: Item | null = null;
  let bd = B.monsters[m.kind].greedy ? w.up.lure + M.gluttonLure : w.up.lure;
  for (const it of w.items) {
    if (it.kind !== 'fish') continue;
    const dd = dist(it.w - m.w, it.d - m.d);
    if (dd < bd) {
      bd = dd;
      best = it;
    }
  }
  return best ? { it: best, at: bd } : null;
}

/** Where `m` walks this tick: to the crane or, while it is hungry, to the nearest fish it is lured
 *  by; `eat` is that fish when it is close enough to stop and eat it instead. */
export function heading(w: World, m: Monster): { d: number; w: number; eat: Item | null } {
  const spec = B.monsters[m.kind];
  if (!spec.swims && !spec.dives && !spec.boss && (spec.greedy || m.full < 1)) {
    const near = nearestFish(w, m);
    if (near) {
      if (near.at < m.r + near.it.r + M.eatReach) return { d: m.d, w: m.w, eat: near.it };
      return { d: near.it.d, w: near.it.w, eat: null };
    }
  }
  return { d: B.crane.d + B.crane.aimOffset, w: B.crane.w, eat: null };
}

export function updateMonsters(w: World): void {
  for (const m of [...w.mons]) {
    if (m.grab || w.mons.indexOf(m) < 0) continue;
    if (m.stun > 0) {
      m.stun--;
      continue;
    }
    const spec = B.monsters[m.kind];
    if (m.eat) {
      const it = w.items.find((o) => o.id === m.eat);
      if (!it) m.eat = 0;
      else {
        if (--m.eatT <= 0) eaten(w, m, it);
        continue;
      }
    }
    const g = heading(w, m);
    if (g.eat) {
      m.eat = g.eat.id;
      m.eatT = times(g.eat.chest ? M.eatBig : M.eatSmall, w.up.chew);
      emit(w, { e: 'eatStart', id: m.id });
      continue;
    }
    if (w.calm === 2 && m.d <= CALM_D) continue;
    if (m.kind === 'kraken' && m.brood < B.kraken.max && --m.cd <= 0) summon(w, m);
    walk(w.tick, m, g.d, g.w, spec.swims);
    if (reached(m, spec.swims)) {
      w.mons.splice(w.mons.indexOf(m), 1);
      w.hp -= spec.dmg;
      w.st.leak++;
      emit(w, { e: 'leak', kind: m.kind, dmg: spec.dmg });
      if (w.hp <= 0) {
        gameOver(w);
        return;
      }
    }
  }
}

/** The kraken calls up crabs: they climb out of the water on either side of it. */
function summon(w: World, m: Monster): void {
  m.cd = B.kraken.summon;
  emit(w, { e: 'summon', id: m.id, d: m.d, w: m.w });
  for (let i = 0; i < B.kraken.brood && m.brood < B.kraken.max; i++) {
    m.brood++;
    const c = spawn(w, 'grunt');
    const side = i % 2 ? 1 : -1;
    c.d = m.d;
    c.w = clamp(m.w + side * (m.r + c.r + toFp(8)), c.r, LANE_WIDTH_FP - c.r);
  }
}

/** Whether `m` has reached the dock: a walker climbs on and goes for the crane; a swimmer stays in
 *  the water and bites the dock's edge wherever it meets it. */
function reached(m: Monster, swims: boolean): boolean {
  if (swims) return m.d - m.r <= B.dock.edge;
  return dist(m.d - B.crane.d, m.w - B.crane.w) < B.crane.reach + m.r;
}

/** One tick (number `tick`) of crawling toward (td, tw); a swimmer weaves across its path as it
 *  goes, and once in the lane its weave never carries it back out over a side. */
export function walk(tick: number, m: Monster, td: number, tw: number, swims: boolean): void {
  const inLane = m.w >= m.r && m.w <= LANE_WIDTH_FP - m.r;
  const dd = td - m.d;
  const dw = tw - m.w;
  const len = dist(dd, dw) || 1;
  let vd = muldiv(dd, 1000, len);
  let vw = muldiv(dw, 1000, len);
  if (swims) {
    const wb = muldiv(sinB(tick * M.wobbleRate + m.ph), M.wobble, 1000);
    // the perpendicular (-vd, vw) in (w, d), pushed by the weave
    const pw = -vd;
    const pd = vw;
    vw += muldiv(pw, wb, 1000);
    vd += muldiv(pd, wb, 1000);
    const n = dist(vd, vw) || 1;
    vd = muldiv(vd, 1000, n);
    vw = muldiv(vw, 1000, n);
  }
  m.d += muldiv(vd, m.speed, 1000);
  m.w += muldiv(vw, m.speed, 1000);
  if (swims && inLane) m.w = clamp(m.w, m.r, LANE_WIDTH_FP - m.r);
}
