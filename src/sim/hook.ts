// The crane's hook (prototype fire, updHook, hookHit, placeGrabs, deliver). At rest it swings;
// a tap casts it along the aim, where it grabs fish, junk and monsters light enough to lift (up
// to 1 + multi of them), bounces off heavier ones (knocking a hermit's shell off as junk), and reels back slower the more it carries.
// With junk in the crane's hand a tap throws it instead (throw.ts). The swing slows while a tap now
// would land: a lot while a throw would hit a monster (at full speed a far one sat under the aim
// for some 50 ms, gone before the player could react), a little while a cast would catch.

import { B } from './balance';
import { BF } from './balanceFun';
import { alive, hitAt, type Target } from './collide';
import { perfectOn } from './fun';
import { eventPay } from './seaEvents';
import { emit } from './events';
import { dropJunk, returnJunk } from './items';
import { LANE_LEN_FP, LANE_WIDTH_FP } from './lane';
import { dist, muldiv, times } from './math/fixed';
import { cosB, normBrad, sinB } from './math/trig';
import { damage, kill, knock, liftable } from './monsters';
import { throwFirst } from './lead';
import { rayFirst } from './ray';
import { mineBlast, throwJunk } from './throw';
import { drift, seen } from './weather';
import type { Grab, Monster, World } from './world';

const H = B.hook;
const T = B.throw;
/** The most swing a tap can look back over, ticks (Session.tap: the screen and the finger lag). */
const BACK_TICKS = 5;

/** The player's one action: cast the hook, or throw the junk in hand. False when not ready.
 *  `back` (brads of swing phase, at most BACK_TICKS' worth) aims where the hook was that long ago:
 *  the angle the player saw when they tapped, as the screen and the touch run a little behind. */
export function fire(w: World, back = 0): boolean {
  const h = w.hook;
  if (w.phase === 'wave' && h.st === 'back') return yank(w);
  if (w.phase !== 'wave' || h.st !== 'swing') return false;
  const ph = normBrad(h.ph - Math.min(Math.max(back, 0), h.rate * BACK_TICKS));
  const ang = muldiv(w.up.swing, sinB(ph), 1000);
  if (w.held) throwJunk(w, ang);
  else {
    // the swing picks up from here when the hook is back, so it does not jump
    h.ph = ph;
    h.ang = ang;
    h.st = 'out';
    h.len = H.startLen;
    h.grabs = [];
    w.st.casts++;
    emit(w, { e: 'cast' });
    // aimed dead on its catch, the cast flies and reels faster (fun.ts)
    const r = rayFirst(w, ang, false, H.tip);
    h.perfect = !!r && perfectOn(w, ang, r.o);
    if (h.perfect) {
      const t = r!.o.t === 'item' ? r!.o.item : r!.o.m;
      w.st.perfects++;
      emit(w, { e: 'perfect', d: t.d, w: t.w });
    }
  }
  return true;
}

/** A tap while a caught moray fights the hook: a yank that shortens the fight. */
function yank(w: World): boolean {
  const m = tugging(w);
  if (!m) return false;
  m.tug = Math.max(0, m.tug - BF.moray.yank);
  emit(w, { e: 'yank', id: m.id });
  return true;
}

/** The caught moray still fighting the hook, if any. */
export function tugging(w: World): Monster | null {
  for (const g of w.hook.grabs) {
    if (g.t !== 'mon') continue;
    const m = w.mons.find((o) => o.id === g.id);
    if (m && m.tug > 0) return m;
  }
  return null;
}

/** The hook's tip, as a lane point. */
export function hookTip(w: World): { d: number; w: number } {
  const h = w.hook;
  return { d: B.crane.d + muldiv(cosB(h.ang), h.len, 1000), w: B.crane.w + muldiv(sinB(h.ang), h.len, 1000) };
}

/** What a grab weighs on the winch: an item its weight, a monster its hit points. */
export function grabWeight(w: World, g: Grab): number {
  if (g.t === 'item') return g.item.wt;
  return w.mons.find((m) => m.id === g.id)?.hp ?? 0;
}

/** One tick of the swing. It moves in slow steps and stops at the first one where a tap would
 *  land, so the aim slows from the edge of a target, not from wherever a full step (some 3.7°,
 *  more than a far monster's whole width) happened to land in it. */
function swing(w: World): void {
  const h = w.hook;
  const slow = Math.max(1, muldiv(H.swingRate, w.held ? T.aimSlow : H.aimSlow, 1000));
  let moved = 0;
  while (moved < H.swingRate) {
    const s = Math.min(slow, H.swingRate - moved);
    moved += s;
    h.ph = normBrad(h.ph + s);
    h.ang = muldiv(w.up.swing, sinB(h.ph), 1000);
    if (onTarget(w, h.ang)) break;
  }
  h.rate = moved;
}

/** Whether a tap along `ang` would land: a throw on a monster, or a cast on a fish, chest or piece
 *  of junk in sight (not in the fog, weather.ts). Not on a monster: slowing on those made the
 *  defence too easy (balance guard). */
export function onTarget(w: World, ang: number): boolean {
  if (w.held) return throwFirst(w, ang) !== null;
  const r = rayFirst(w, ang, false, H.tip);
  return r?.o.t === 'item' && seen(w, r.o.item.d);
}

export function updateHook(w: World): void {
  const h = w.hook;
  if (h.st === 'swing') {
    swing(w);
    return;
  }
  let mv = times(H.castSpeed, w.up.cast);
  if (h.perfect) mv = times(mv, BF.perfect.boost);
  // a storm's gust bends the hook as it flies (weather.ts); the rope follows it back
  if (h.st === 'out') h.ang += drift(w, mv);
  const ud = cosB(h.ang);
  const uw = sinB(h.ang);
  if (h.st === 'out') {
    while (mv > 0) {
      const s = Math.min(H.step, mv);
      mv -= s;
      h.len += s;
      const tip = hookTip(w);
      if (tip.w < -H.margin || tip.w > LANE_WIDTH_FP + H.margin || tip.d > LANE_LEN_FP + H.margin) {
        h.st = 'back';
        break;
      }
      const o = hitAt(w, tip.d, tip.w, H.tip, false);
      if (o && !hookHit(w, o, ud, uw)) break;
    }
  } else {
    // a moray on the line pulls it back out to sea until it tires (or is yanked)
    const eel = tugging(w);
    if (eel) {
      eel.tug--;
      h.len = Math.min(h.len + BF.moray.tugSpeed, LANE_LEN_FP);
      placeGrabs(w, ud, uw);
      return;
    }
    let wt = 0;
    for (const g of h.grabs) wt += grabWeight(w, g);
    const reel = h.perfect ? times(times(H.reelSpeed, w.up.winch), BF.perfect.boost) : times(H.reelSpeed, w.up.winch);
    h.len -= muldiv(reel, 1000, 1000 + H.weightDrag * wt);
    if (w.up.magnet && h.len > H.magnetMinLen) magnet(w);
    if (h.len <= H.homeLen) {
      h.st = 'swing';
      h.len = 0;
      h.perfect = false;
      const gs = h.grabs;
      h.grabs = [];
      for (const g of gs) deliver(w, g);
      return;
    }
  }
  placeGrabs(w, ud, uw);
}

/** The magnet upgrade pulls fish near the reeling hook onto it. */
function magnet(w: World): void {
  const tip = hookTip(w);
  const rad = H.magnetBase + H.magnetPer * w.up.magnet;
  for (const it of [...w.items]) {
    if (it.kind !== 'fish' || dist(it.d - tip.d, it.w - tip.w) >= rad + it.r) continue;
    w.items.splice(w.items.indexOf(it), 1);
    w.hook.grabs.push({ t: 'item', item: it });
    emit(w, { e: 'magnet', d: it.d, w: it.w });
  }
}

/** The hook meets `o` on its way out; true when it keeps flying (room for another catch). */
function hookHit(w: World, o: Target, ud: number, uw: number): boolean {
  const h = w.hook;
  if (o.t === 'item') {
    w.items.splice(w.items.indexOf(o.item), 1);
    h.grabs.push({ t: 'item', item: o.item });
    emit(w, { e: 'grab', what: o.item.kind === 'fish' ? 'fish' : 'junk', d: o.item.d, w: o.item.w });
  } else if (liftable(w, o.m)) {
    o.m.grab = true;
    o.m.eat = 0;
    h.grabs.push({ t: 'mon', id: o.m.id });
    emit(w, { e: 'grab', what: 'monster', d: o.m.d, w: o.m.w });
    if (B.monsters[o.m.kind].tugs) {
      o.m.tug = BF.moray.tug;
      emit(w, { e: 'tug', id: o.m.id });
    }
  } else {
    const m = o.m;
    h.st = 'back';
    // a hermit's shell comes off first, and floats there as junk; no mine is spent on it
    const shelled = m.shell > 0;
    if (w.mines > 0 && !shelled) {
      mineBlast(w, m);
      return false;
    }
    damage(w, m, w.up.barb, false);
    if (shelled) dropJunk(w, m);
    w.st.bounce++;
    emit(w, { e: 'bounce', id: m.id, d: m.d, w: m.w });
    if (alive(w, m)) {
      m.stun = B.bounce.stun;
      knock(m, ud, uw, B.bounce.knock);
    }
    return false;
  }
  if (h.grabs.length >= 1 + w.up.multi) {
    h.st = 'back';
    return false;
  }
  return true;
}

/** Hangs what the hook carries off its tip: the first on the rope, the rest fanned across it. */
function placeGrabs(w: World, ud: number, uw: number): void {
  const tip = hookTip(w);
  w.hook.grabs.forEach((g, i) => {
    const o = i ? (i % 2 ? 1 : -1) * Math.ceil(i / 2) * H.spread : 0;
    const thing = g.t === 'item' ? g.item : w.mons.find((m) => m.id === g.id);
    if (!thing) return;
    const along = times(thing.r, 700);
    thing.d = tip.d + muldiv(ud, along, 1000) + muldiv(uw, o, 1000);
    thing.w = tip.w + muldiv(uw, along, 1000) - muldiv(ud, o, 1000);
  });
}

/** A catch reaches the dock: fish pay out, junk goes to the crane's hand, monsters are crushed. */
function deliver(w: World, g: Grab): void {
  if (g.t === 'mon') {
    const m = w.mons.find((o) => o.id === g.id);
    if (m) kill(w, m, true);
    return;
  }
  const it = g.item;
  if (it.kind === 'fish') {
    const val = eventPay(w, it.val);
    w.coins += val;
    w.st.mined += val;
    if (it.dropped) w.st.recaught += val;
    if (it.gold) {
      w.st.golds++;
      emit(w, { e: 'gold', amount: val });
    }
    emit(w, { e: 'coins', amount: val, spat: false });
  } else if (w.held) returnJunk(w, it);
  else {
    w.held = it;
    emit(w, { e: 'held' });
  }
}
