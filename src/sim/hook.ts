// The crane's hook (prototype fire, updHook, hookHit, placeGrabs, deliver). At rest it swings;
// a tap casts it along the aim, where it grabs fish, junk and monsters light enough to lift (up
// to 1 + multi of them), bounces off heavier ones, and reels back slower the more it carries.
// With junk in the crane's hand a tap throws it instead (throw.ts).

import { B } from './balance';
import { alive, hitAt, type Target } from './collide';
import { emit } from './events';
import { returnJunk } from './items';
import { LANE_LEN_FP, LANE_WIDTH_FP } from './lane';
import { dist, muldiv, times } from './math/fixed';
import { cosB, normBrad, sinB } from './math/trig';
import { damage, kill, knock, liftable } from './monsters';
import { mineBlast, throwJunk } from './throw';
import type { Grab, World } from './world';

const H = B.hook;

/** The player's one action: cast the hook, or throw the junk in hand. False when not ready. */
export function fire(w: World): boolean {
  const h = w.hook;
  if (w.phase !== 'wave' || h.st !== 'swing') return false;
  if (w.held) throwJunk(w);
  else {
    h.st = 'out';
    h.len = H.startLen;
    h.grabs = [];
    w.st.casts++;
    emit(w, { e: 'cast' });
  }
  return true;
}

/** The hook's tip, as a lane point. */
export function hookTip(w: World): { d: number; w: number } {
  const h = w.hook;
  return { d: B.crane.d + muldiv(cosB(h.ang), h.len, 1000), w: B.crane.w + muldiv(sinB(h.ang), h.len, 1000) };
}

function grabWeight(w: World, g: Grab): number {
  if (g.t === 'item') return g.item.wt;
  return w.mons.find((m) => m.id === g.id)?.hp ?? 0;
}

export function updateHook(w: World): void {
  const h = w.hook;
  if (h.st === 'swing') {
    h.ph = normBrad(h.ph + H.swingRate);
    h.ang = muldiv(w.up.swing, sinB(h.ph), 1000);
    return;
  }
  const ud = cosB(h.ang);
  const uw = sinB(h.ang);
  if (h.st === 'out') {
    let mv = times(H.castSpeed, w.up.cast);
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
    let wt = 0;
    for (const g of h.grabs) wt += grabWeight(w, g);
    h.len -= muldiv(times(H.reelSpeed, w.up.winch), 1000, 1000 + H.weightDrag * wt);
    if (w.up.magnet && h.len > H.magnetMinLen) magnet(w);
    if (h.len <= H.homeLen) {
      h.st = 'swing';
      h.len = 0;
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
    emit(w, { e: 'grab', what: o.item.kind, d: o.item.d, w: o.item.w });
  } else if (liftable(w, o.m)) {
    o.m.grab = true;
    o.m.eat = 0;
    h.grabs.push({ t: 'mon', id: o.m.id });
    emit(w, { e: 'grab', what: 'monster', d: o.m.d, w: o.m.w });
  } else {
    const m = o.m;
    h.st = 'back';
    if (w.mines > 0) {
      mineBlast(w, m);
      return false;
    }
    damage(w, m, w.up.barb, false);
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
    w.coins += it.val;
    w.st.mined += it.val;
    emit(w, { e: 'coins', amount: it.val, spat: false });
  } else if (w.held) returnJunk(w, it);
  else {
    w.held = it;
    emit(w, { e: 'held' });
  }
}
