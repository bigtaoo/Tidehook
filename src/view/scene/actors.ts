// Everything that moves on the lane: the catch, the monsters with their hit points as pips, the
// hook on its rope with what it carries (and a mine riding the rope while one is stocked), thrown
// junk, the crane with the junk in its hand and, at rest, the aim (gold when the tutorial's step
// would be met by a tap now). Bodies are sprites (art.ts);
// a sprite that is not loaded falls back to its grey-box shape. Positions are drawn `alpha` of
// the way from where they were a tick ago (Session.prev) to where they are.

import { Container, Graphics } from 'pixi.js';
import { aimFinds } from '../../game/guide/guide';
import type { Session } from '../../game/session';
import { B } from '../../sim/balance';
import { FP } from '../../sim/math/fixed';
import { BRAD_FULL } from '../../sim/math/trig';
import type { Item, Monster } from '../../sim/world';
import { CATCH, MON, P } from '../kit/palette';
import { toDesign, type Field } from '../orient';
import { areaScale, tex } from '../art';
import { fishArt, lookRadius, monsterArt, step } from './look';
import { SpritePool } from './sprites';

const CRANE_D = B.crane.d / FP;
const CRANE_W = B.crane.w / FP;
/** How far the aim line reaches at rest, world units. */
const AIM_LEN = 260;
/** The crane's and the hook's drawn size, world units of area radius. */
const CRANE_R = 36;
const HOOK_R = 9;
/** Where the hook sprite's mouth (inside its J) and its ring are, as a share of its height. The
 *  mouth sits on the sim's tip, where it catches; the rope ends at the ring. */
const HOOK_MOUTH = 0.72;
const HOOK_RING = 0.13;
const MINE_R = 9;
const HELD_R = 11;
const TAU = Math.PI * 2;

const rad = (brads: number) => (brads / BRAD_FULL) * TAU;

type Pt = { x: number; y: number };

export class Actors extends Container {
  /** Under the bodies: the aim, the rope and any grey-box stand-ins. */
  private readonly under = new Graphics();
  readonly bodies = new SpritePool();
  /** Over the bodies: hit point pips and the rings of grabbed and eating monsters. */
  private readonly over = new Graphics();

  constructor(private readonly f: Field) {
    super();
    this.addChild(this.under, this.bodies, this.over);
  }

  draw(s: Session): void {
    const { f, under: g, bodies, over } = this;
    g.clear();
    over.clear();
    bodies.begin();
    const w = s.world;
    const a = s.alpha;
    const k = f.scale;
    /** A thing's drawn spot: between where it was and where it is. */
    const at = (id: number, d: number, wv: number) => {
      const p = s.prev.get(id);
      const dd = p ? p.d + (d - p.d) * a : d;
      const ww = p ? p.w + (wv - p.w) * a : wv;
      return { ...toDesign(f, dd / FP, ww / FP), d: dd / FP };
    };
    const time = (w.tick + a) / 30;
    const item = (it: Item, p: Pt) => {
      const bob = Math.sin(time * 2.2 + it.id) * 0.06;
      const art = fishArt(w, it);
      const r = lookRadius(art, (it.r / FP) * k, f.wide);
      const pose = { rot: it.kind === 'junk' ? 0 : bob, flip: it.kind === 'fish' && !it.chest && it.id % 2 === 1 };
      if (!bodies.put(art, p.x, p.y, r, pose)) drawItemShape(g, it, p, k);
    };

    for (const it of w.items) item(it, at(it.id, it.d, it.w));

    // monsters before the hook, so a grabbed one hangs under it
    for (const m of w.mons) this.monster(m, at(m.id, m.d, m.w));

    // the hook: the rope from the crane to the tip, between last tick's aim and length and now's
    const h = w.hook;
    const ang = rad(s.prevHook.ang + (h.ang - s.prevHook.ang) * a);
    const len = (s.prevHook.len + (h.len - s.prevHook.len) * a) / FP;
    const hub = toDesign(f, CRANE_D, CRANE_W);
    if (h.st === 'swing') {
      const end = toDesign(f, CRANE_D + Math.cos(ang) * AIM_LEN, CRANE_W + Math.sin(ang) * AIM_LEN);
      // the tutorial lights it gold while a tap now would get what its step asks for
      const gold = aimFinds(w, s.guide?.cue?.want ?? null);
      const color = gold ? P.brassLight : w.held ? P.red : P.cream;
      g.moveTo(hub.x, hub.y).lineTo(end.x, end.y).stroke({ color, width: (gold ? 7 : 4) * k, alpha: gold ? 0.95 : 0.45 });
    } else {
      const tip = toDesign(f, CRANE_D + Math.cos(ang) * len, CRANE_W + Math.sin(ang) * len);
      const dir = Math.atan2(tip.y - hub.y, tip.x - hub.x);
      // the hook hangs along the rope with its mouth on the tip, so it catches where it looks to
      const hook = tex('hook');
      const ring = hook ? (HOOK_MOUTH - HOOK_RING) * hook.height * areaScale('hook', HOOK_R * k) : 0;
      const end = { x: tip.x - Math.cos(dir) * ring, y: tip.y - Math.sin(dir) * ring };
      g.moveTo(hub.x, hub.y).lineTo(end.x, end.y).stroke({ color: P.rope, width: 4 * k });
      if (w.mines > 0 && len > 30 + ring / k) {
        const back = 24 * k;
        bodies.put('mine', end.x - Math.cos(dir) * back, end.y - Math.sin(dir) * back, MINE_R * k);
      }
      if (!bodies.put('hook', tip.x, tip.y, HOOK_R * k, { rot: dir - Math.PI / 2, ay: HOOK_MOUTH })) {
        g.circle(tip.x, tip.y, 7 * k).fill(P.brassDark).stroke({ color: P.line, width: 2.5 * k });
      }
      for (const gr of h.grabs) if (gr.t === 'item') item(gr.item, at(gr.item.id, gr.item.d, gr.item.w));
    }

    for (const sh of w.shots) {
      const p = toDesign(f, sh.d / FP, sh.w / FP);
      const r = (B.catch.junkRadius / FP) * k;
      if (!bodies.put('junk_barrel', p.x, p.y, lookRadius('junk_barrel', r, f.wide), { rot: (sh.d + sh.w) / FP / 12 })) {
        g.roundRect(p.x - r, p.y - r, r * 2, r * 2, r / 3).fill(CATCH.junk).stroke({ color: P.line, width: 2.5 * k });
      }
    }

    // the crane: the pulley at the boom's end is where the rope starts, the winch sits back on the
    // dock. The boom rises at 45 degrees towards the top right, which leans out to sea both ways up.
    if (!bodies.put('crane', hub.x, hub.y, CRANE_R * k, { ax: 0.84, ay: 0.36 })) {
      g.circle(hub.x, hub.y, 24 * k).fill(P.brass).stroke({ color: P.line, width: 3.5 * k });
    }
    if (w.held) {
      const r = HELD_R * k;
      if (!bodies.put(fishArt(w, w.held), hub.x, hub.y, r)) {
        g.roundRect(hub.x - r, hub.y - r, r * 2, r * 2, r / 3).fill(CATCH.junk).stroke({ color: P.line, width: 2.5 * k });
      }
    }
    bodies.end();
  }

  private monster(m: Monster, p: Pt & { d: number }): void {
    const { f, under: g, bodies, over } = this;
    const k = f.scale;
    const r = (m.r / FP) * k;
    const stunned = m.stun > 0;
    const st = stunned || m.grab ? { up: 0, rot: 0, sx: 1, sy: 1 } : step(m, p.d);
    const art = monsterArt(m.kind, f.wide);
    const drawn = bodies.put(art, p.x, p.y - st.up * r, lookRadius(art, r, f.wide), {
      rot: st.rot + (m.grab ? Math.sin(p.x * 0.05) * 0.2 : 0),
      sx: st.sx,
      sy: st.sy,
      alpha: stunned ? 0.75 : 1,
      tint: stunned ? 0xb8c4d6 : 0xffffff,
    });
    if (!drawn) {
      g.circle(p.x, p.y, r).fill({ color: MON[m.kind], alpha: stunned ? 0.6 : 1 }).stroke({ color: P.line, width: 3 * k });
      // eyes: red, the one warm thing a monster may carry
      g.circle(p.x - r * 0.35, p.y - r * 0.2, r * 0.18).fill(P.red);
      g.circle(p.x + r * 0.35, p.y - r * 0.2, r * 0.18).fill(P.red);
    }
    if (m.grab) over.circle(p.x, p.y, r * 1.25).stroke({ color: P.brassLight, width: 3 * k, alpha: 0.9 });
    if (m.eat) over.circle(p.x, p.y, r * 1.35).stroke({ color: CATCH.fish, width: 2 * k, alpha: 0.8 });
    // hit points as pips under it
    const n = Math.min(m.hp, 12);
    const pr = 2.6 * k;
    const left = p.x - ((n - 1) * pr * 2.6) / 2;
    const y = p.y + r * 1.3 + pr * 2;
    for (let i = 0; i < n; i++) over.circle(left + i * pr * 2.6, y, pr).fill(P.cream).stroke({ color: P.line, width: 1.2 * k });
  }
}

function drawItemShape(g: Graphics, it: Item, p: Pt, k: number): void {
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
