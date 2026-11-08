// Everything that moves on the lane, redrawn each frame as flat shapes: the catch, the monsters
// with their hit points as pips, the hook on its rope with what it carries, thrown junk, the
// junk in the crane's hand and, at rest, the aim. Positions are drawn `alpha` of the way from
// where they were a tick ago (Session.prev) to where they are.

import { Graphics } from 'pixi.js';
import type { Session } from '../../game/session';
import { B } from '../../sim/balance';
import { FP } from '../../sim/math/fixed';
import { BRAD_FULL } from '../../sim/math/trig';
import type { Item, Monster } from '../../sim/world';
import { CATCH, MON, P } from '../kit/palette';
import { toDesign, type Field } from '../orient';

const CRANE_D = B.crane.d / FP;
const CRANE_W = B.crane.w / FP;
/** How far the aim line reaches at rest, world units. */
const AIM_LEN = 260;
const TAU = Math.PI * 2;

const rad = (brads: number) => (brads / BRAD_FULL) * TAU;

export function drawActors(g: Graphics, s: Session, f: Field): void {
  g.clear();
  const w = s.world;
  const a = s.alpha;
  const k = f.scale;
  /** A thing's drawn spot: between where it was and where it is. */
  const at = (id: number, d: number, wv: number) => {
    const p = s.prev.get(id);
    const dd = p ? p.d + (d - p.d) * a : d;
    const ww = p ? p.w + (wv - p.w) * a : wv;
    return toDesign(f, dd / FP, ww / FP);
  };

  for (const it of w.items) drawItem(g, it, at(it.id, it.d, it.w), k);

  // the hook: the rope from the crane to the tip, between last tick's aim and length and now's
  const h = w.hook;
  const ang = rad(s.prevHook.ang + (h.ang - s.prevHook.ang) * a);
  const len = (s.prevHook.len + (h.len - s.prevHook.len) * a) / FP;
  const hub = toDesign(f, CRANE_D, CRANE_W);
  if (h.st === 'swing') {
    const end = toDesign(f, CRANE_D + Math.cos(ang) * AIM_LEN, CRANE_W + Math.sin(ang) * AIM_LEN);
    g.moveTo(hub.x, hub.y).lineTo(end.x, end.y).stroke({ color: w.held ? P.red : P.cream, width: 4 * k, alpha: 0.45 });
  } else {
    const tip = toDesign(f, CRANE_D + Math.cos(ang) * len, CRANE_W + Math.sin(ang) * len);
    g.moveTo(hub.x, hub.y).lineTo(tip.x, tip.y).stroke({ color: P.rope, width: 4 * k });
    g.circle(tip.x, tip.y, 7 * k).fill(P.brassDark).stroke({ color: P.line, width: 2.5 * k });
    for (const gr of h.grabs) if (gr.t === 'item') drawItem(g, gr.item, at(gr.item.id, gr.item.d, gr.item.w), k);
  }

  for (const m of w.mons) drawMonster(g, m, at(m.id, m.d, m.w), k);

  for (const sh of w.shots) {
    const p = toDesign(f, sh.d / FP, sh.w / FP);
    const r = (B.catch.junkRadius / FP) * k;
    g.roundRect(p.x - r, p.y - r, r * 2, r * 2, r / 3).fill(CATCH.junk).stroke({ color: P.line, width: 2.5 * k });
  }

  // the crane: a brass hub, with the junk it holds
  g.circle(hub.x, hub.y, 24 * k).fill(P.brass).stroke({ color: P.line, width: 3.5 * k });
  if (w.held) {
    const r = 9 * k;
    g.roundRect(hub.x - r, hub.y - r, r * 2, r * 2, r / 3).fill(CATCH.junk).stroke({ color: P.line, width: 2.5 * k });
  }
}

function drawItem(g: Graphics, it: Item, p: { x: number; y: number }, k: number): void {
  const r = (it.r / FP) * k;
  if (it.kind === 'junk') {
    g.roundRect(p.x - r, p.y - r, r * 2, r * 2, r / 3).fill(CATCH.junk).stroke({ color: P.line, width: 2.5 * k });
  } else if (it.chest) {
    g.roundRect(p.x - r, p.y - r * 0.75, r * 2, r * 1.5, r / 4).fill(CATCH.chest).stroke({ color: P.line, width: 2.5 * k });
    g.rect(p.x - r, p.y - r * 0.1, r * 2, r * 0.2).fill(P.brassLight);
  } else {
    g.ellipse(p.x, p.y, r, r * 0.7).fill(CATCH.fish).stroke({ color: P.line, width: 2.5 * k });
  }
}

function drawMonster(g: Graphics, m: Monster, p: { x: number; y: number }, k: number): void {
  const r = (m.r / FP) * k;
  const stunned = m.stun > 0;
  g.circle(p.x, p.y, r).fill({ color: MON[m.kind], alpha: stunned ? 0.6 : 1 }).stroke({ color: m.grab ? P.brassLight : P.line, width: 3 * k });
  // eyes: red, the one warm thing a monster may carry
  g.circle(p.x - r * 0.35, p.y - r * 0.2, r * 0.18).fill(P.red);
  g.circle(p.x + r * 0.35, p.y - r * 0.2, r * 0.18).fill(P.red);
  if (m.eat) g.circle(p.x, p.y, r + 5 * k).stroke({ color: CATCH.fish, width: 2 * k, alpha: 0.8 });
  // hit points as pips under it
  const n = Math.min(m.hp, 12);
  const pr = 2.6 * k;
  const left = p.x - ((n - 1) * pr * 2.6) / 2;
  for (let i = 0; i < n; i++) g.circle(left + i * pr * 2.6, p.y + r + pr * 2.4, pr).fill(P.cream).stroke({ color: P.line, width: 1.2 * k });
}
