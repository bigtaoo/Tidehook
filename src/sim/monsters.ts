// Sea monsters: they spawn out at sea, crawl toward the crane, stop to eat fish on the way, and
// hurt the dock when they reach it (prototype spawn, updMons, dmgMon, killMon, knock).

import { B, type MonsterKind } from './balance';
import { emit } from './events';
import { dropFish } from './items';
import { LANE_LEN_FP, LANE_WIDTH_FP } from './lane';
import { clamp, dist, muldiv, roundDiv, times, toFp } from './math/fixed';
import { BRAD_FULL, sinB } from './math/trig';
import { nextId, type Item, type Monster, type World } from './world';

const M = B.monster;
/** Under the tutorial's hold (World.calm 2) monsters halt this far down the lane, FP: well in
 *  reach of the hook, where the aim crosses a crab for longest short of crowding the dock. */
export const CALM_D = toFp(300);

export function spawn(w: World, kind: MonsterKind): Monster {
  const spec = B.monsters[kind];
  const rng = w.rng.spawn;
  const grown = w.wave - 1;
  const hp = Math.max(1, roundDiv(spec.hp * (1000 + M.hpPerWave * grown), 1000));
  let pw: number;
  let pd: number;
  if (spec.swims || (w.wave >= M.sideFromWave && rng.int(1000) < M.sideChance)) {
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
    r: spec.radius,
    speed: times(spec.speed, 1000 + M.speedPerWave * grown),
    stun: 0,
    eat: 0,
    eatT: 0,
    full: 0,
    ate: 0,
    ph: rng.int(BRAD_FULL),
    grab: false,
  };
  w.mons.push(m);
  emit(w, { e: 'spawn', id: m.id, kind });
  return m;
}

/** Whether the hook can lift it: its weight (= hit points) within the grip. */
export function liftable(w: World, m: Monster): boolean {
  return m.hp <= w.up.grip;
}

/** Pushes a monster `k` FP along the permille direction (ud, uw), kept inside the lane. */
export function knock(m: Monster, ud: number, uw: number, k: number): void {
  m.w = clamp(m.w + muldiv(uw, k, 1000), m.r, LANE_WIDTH_FP - m.r);
  m.d = Math.min(LANE_LEN_FP + M.knockBeyond, m.d + muldiv(ud, k, 1000));
}

/** Damage from anything but the crane's crush; `thrown` counts the kill as a junk kill. */
export function damage(w: World, m: Monster, dmg: number, thrown: boolean): void {
  m.hp -= dmg;
  emit(w, { e: 'hit', id: m.id, dmg, d: m.d, w: m.w });
  if (m.hp <= 0) {
    if (thrown) w.st.junkKills++;
    kill(w, m, false);
  }
}

/** Removes a monster. Crushed on the dock, a glutton spits its coins out; killed at sea, it
 *  drops them as a fish to catch. */
export function kill(w: World, m: Monster, crushed: boolean): void {
  const i = w.mons.indexOf(m);
  if (i < 0) return;
  w.mons.splice(i, 1);
  w.st.kills++;
  if (crushed) w.st.crush++;
  emit(w, { e: 'kill', id: m.id, kind: m.kind, crushed, d: m.d, w: m.w });
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
    m.hp += it.chest ? M.gluttonGrowBig : M.gluttonGrowSmall;
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
    let td = B.crane.d + B.crane.aimOffset;
    let tw = B.crane.w;
    if (!spec.swims && (spec.greedy || m.full < 1)) {
      const near = nearestFish(w, m);
      if (near) {
        if (near.at < m.r + near.it.r + M.eatReach) {
          m.eat = near.it.id;
          m.eatT = times(near.it.chest ? M.eatBig : M.eatSmall, w.up.chew);
          emit(w, { e: 'eatStart', id: m.id });
          continue;
        }
        td = near.it.d;
        tw = near.it.w;
      }
    }
    if (w.calm === 2 && m.d <= CALM_D) continue;
    step(w, m, td, tw, spec.swims);
    if (dist(m.d - B.crane.d, m.w - B.crane.w) < B.crane.reach + m.r) {
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

/** One tick of crawling toward (td, tw); a swimmer weaves across its path as it goes. */
function step(w: World, m: Monster, td: number, tw: number, swims: boolean): void {
  const dd = td - m.d;
  const dw = tw - m.w;
  const len = dist(dd, dw) || 1;
  let vd = muldiv(dd, 1000, len);
  let vw = muldiv(dw, 1000, len);
  if (swims) {
    const wb = muldiv(sinB(w.tick * M.wobbleRate + m.ph), M.wobble, 1000);
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
}
