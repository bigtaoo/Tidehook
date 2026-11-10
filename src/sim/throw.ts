// Thrown junk and mines (prototype fire's throw, updShots and bomb). Junk flies straight along
// the aim, hurts and knocks back what it hits, goes through `pierce` more monsters and, with the
// blast upgrade, splashes those around. A mine goes off when the hook meets a monster too heavy
// to lift, hurting everything near it.

import { B } from './balance';
import { alive, hitAt } from './collide';
import { emit } from './events';
import { LANE_LEN_FP, LANE_WIDTH_FP } from './lane';
import { dist, muldiv } from './math/fixed';
import { cosB, sinB } from './math/trig';
import { damage, knock } from './monsters';
import { mineDamage } from './shop';
import type { Monster, World } from './world';

const T = B.throw;

/** Throws the junk in the crane's hand along `ang` (brads; the current aim by default). */
export function throwJunk(w: World, ang = w.hook.ang): void {
  const ud = cosB(ang);
  const uw = sinB(ang);
  w.shots.push({
    d: B.crane.d + muldiv(ud, T.offset, 1000),
    w: B.crane.w + muldiv(uw, T.offset, 1000),
    ud,
    uw,
    pierce: w.up.pierce,
    hit: [],
  });
  w.held = null;
  w.st.throws++;
  emit(w, { e: 'throw' });
}

export function updateShots(w: World): void {
  for (let i = w.shots.length - 1; i >= 0; i--) {
    const s = w.shots[i];
    let mv = T.speed;
    let gone = false;
    while (mv > 0 && !gone) {
      const st = Math.min(T.step, mv);
      mv -= st;
      s.d += muldiv(s.ud, st, 1000);
      s.w += muldiv(s.uw, st, 1000);
      if (s.w < -T.margin || s.w > LANE_WIDTH_FP + T.margin || s.d > LANE_LEN_FP + T.margin || s.d < B.dock.edge - T.behindDock) {
        gone = true;
        break;
      }
      const o = hitAt(w, s.d, s.w, T.radius, true, s.hit);
      if (o?.t !== 'mon') continue;
      hitWith(w, o.m, s.ud, s.uw);
      s.hit.push(o.m.id);
      if (--s.pierce < 0) gone = true;
    }
    if (gone) w.shots.splice(i, 1);
  }
}

function hitWith(w: World, m: Monster, ud: number, uw: number): void {
  const dmg = w.up.heft;
  m.eat = 0;
  damage(w, m, dmg, true);
  if (alive(w, m)) {
    m.stun = T.stun + w.up.tar;
    knock(m, ud, uw, T.knock);
  }
  if (!w.up.blast) return;
  const rad = T.blastBase + T.blastPer * w.up.blast;
  emit(w, { e: 'blast', d: m.d, w: m.w, r: rad });
  const splash = Math.floor((dmg + 1) / 2);
  for (const o of [...w.mons]) {
    if (o !== m && !o.grab && dist(o.d - m.d, o.w - m.w) < rad) damage(w, o, splash, true);
  }
}

/** Sets off a mine on `at`: everything around it is hurt, stunned and blown outward. */
export function mineBlast(w: World, at: Monster): void {
  const M = B.mine;
  w.mines--;
  w.st.mines++;
  const dmg = mineDamage(w);
  const cd = at.d;
  const cw = at.w;
  emit(w, { e: 'mine', d: cd, w: cw, r: M.radius });
  for (const m of [...w.mons]) {
    if (m.grab || !alive(w, m)) continue;
    const dd = m.d - cd;
    const dw = m.w - cw;
    const len = dist(dd, dw);
    if (len >= M.radius + m.r) continue;
    m.eat = 0;
    damage(w, m, dmg, true);
    if (!alive(w, m)) continue;
    m.stun = M.stun;
    const n = len || 1;
    knock(m, muldiv(dd, 1000, n), muldiv(dw, 1000, n), M.knock);
  }
}
