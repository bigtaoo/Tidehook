// Everything that moves on the lane: the catch, the monsters with their hit points as pips (steel
// squares for the ones over the hook's grip), the hook on its rope with what it carries (and a
// mine riding the rope while one is stocked), thrown junk, the winch with the junk on its pulley
// and, at rest, the aim (gold when the tutorial's step would be met by a tap now; with junk in
// hand, the throw's sight out to the monster it would hit, sight.ts). Bodies are
// sprites (art.ts); a sprite that is not loaded falls back to its grey-box shape. Positions are
// drawn `alpha` of the way from where they were a tick ago (Session.prev) to where they are.
// All of it is clipped to the lane, so a monster coming in from beside or beyond the sea swims in
// over the picture's edge instead of walking on the frame around it.

import { Container, Graphics } from 'pixi.js';
import { aimFinds } from '../../game/guide/guide';
import { wornColors } from '../../game/meta/paint';
import type { Session } from '../../game/session';
import { B } from '../../sim/balance';
import { FP } from '../../sim/math/fixed';
import { BRAD_FULL } from '../../sim/math/trig';
import type { Item, Monster } from '../../sim/world';
import { CATCH, HEAVY, MON, P } from '../kit/palette';
import { toDesign, type Field } from '../orient';
import { areaScale, tex } from '../art';
import { LANE_LEN } from '../../sim/lane';
import { bandRect } from './field';
import { isBoss, diving } from '../../sim/kinds';
import { clarity } from '../../sim/weather';
import { fishArt, hasOwnArt, lookRadius, monsterArt, pips, step } from './look';
import { inDanger, lowDock } from './danger';
import { throwSight } from './sight';
import { SpritePool } from './sprites';

const CRANE_D = B.crane.d / FP;
const CRANE_W = B.crane.w / FP;
/** How far the aim line reaches at rest, world units. */
const AIM_LEN = 260;
/** The winch's and the hook's drawn size, world units of area radius. */
const WINCH_R = 34;
/** Where the winch sprite's pulley wheel is, as a share of its height (it is centred across). */
const WINCH_PULLEY = 0.142;
const HOOK_R = 9;
/** Where the hook sprite's mouth (inside its J) and its ring are, as a share of its height. The
 *  mouth sits on the sim's tip, where it catches; the rope ends at the ring. */
const HOOK_MOUTH = 0.8;
const HOOK_RING = 0.09;
const MINE_R = 9;
/** The smallest half-width of the too-heavy weight, world units. */
const WEIGHT_MIN = 7;
const HELD_R = 11;
const TAU = Math.PI * 2;
/** A boss's chest's drawn size in boss radii. */
const BOSS_CHEST = 0.55;
/** A diving ray: how see-through, and its shadow's darkness. */
const DIVE_ALPHA = 0.3;
/** The hermit's shell, drawn over a crab while the hermit has no sprite of its own. */
const SHELL = 0x8e9cb0;
/** A glutton's coins over its head: one for every COINS_EACH it has eaten, at most MAX_COINS. */
const COINS_EACH = 6;
const MAX_COINS = 5;

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
    const lane = bandRect(f, 0, LANE_LEN);
    const mask = new Graphics().rect(lane.x, lane.y, lane.w, lane.h).fill(0xffffff);
    this.addChild(this.bodies.shade, this.under, this.bodies, this.over, mask);
    this.mask = mask;
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
    const item = (it: Item, p: Pt, seen = 1) => {
      const bob = Math.sin(time * 2.2 + it.id) * 0.06;
      const art = fishArt(w, it, f.wide);
      const r = lookRadius(art, (it.r / FP) * k, f.wide);
      const pose = { rot: it.kind === 'junk' ? 0 : bob, flip: it.kind === 'fish' && !it.chest && it.id % 2 === 1, alpha: seen };
      // a gold fish shines, with a glint going round it
      if (it.gold) {
        const pulse = 0.5 + 0.5 * Math.sin(time * 6 + it.id);
        g.circle(p.x, p.y, r * (1.15 + pulse * 0.2)).fill({ color: P.brassLight, alpha: (0.25 + pulse * 0.2) * seen });
        const gl = time * 3 + it.id;
        over.star(p.x + Math.cos(gl) * r * 1.1, p.y + Math.sin(gl) * r * 1.1, 4, r * 0.28, r * 0.1).fill({ color: P.cream, alpha: seen });
      }
      // coins a glutton spilled glow, so the player sees their money back in the water
      if (it.dropped) {
        const pulse = 0.5 + 0.5 * Math.sin(time * 5 + it.id);
        g.circle(p.x, p.y, r * (1.05 + pulse * 0.25)).fill({ color: P.brassLight, alpha: 0.18 + pulse * 0.17 });
      }
      if (!bodies.put(art, p.x, p.y, r, pose)) drawItemShape(g, it, p, k);
    };

    // what is out in the fog is not drawn, and fades in over its edge (sim/weather.ts)
    for (const it of w.items) {
      const c = clarity(w, it.d);
      if (c > 0) item(it, at(it.id, it.d, it.w), c / 1000);
    }

    // monsters before the hook, so a grabbed one hangs under it
    for (const m of w.mons) {
      const c = clarity(w, m.d);
      if (c > 0) this.monster(m, at(m.id, m.d, m.w), w.up.grip, time, diving(w, m), c / 1000);
    }
    if (lowDock(w)) drawCracks(g, f, time);

    // the hook: the rope from the crane to the tip, between last tick's aim and length and now's
    const h = w.hook;
    const ang = rad(s.prevHook.ang + (h.ang - s.prevHook.ang) * a);
    const len = (s.prevHook.len + (h.len - s.prevHook.len) * a) / FP;
    const hub = toDesign(f, CRANE_D, CRANE_W);
    if (h.st === 'swing') {
      // with junk in hand the aim is the throw's sight: as far as the shot flies, and the monster
      // it would hit ringed
      const sight = w.held ? throwSight(w, h.ang) : null;
      const reach = sight ? sight.len : AIM_LEN;
      const end = toDesign(f, CRANE_D + Math.cos(ang) * reach, CRANE_W + Math.sin(ang) * reach);
      // the tutorial lights it gold while a tap now would get what its step asks for
      const gold = aimFinds(w, s.guide?.cue?.want ?? null);
      const color = gold ? P.brassLight : w.held ? P.red : P.cream;
      const alpha = gold ? 0.95 : sight ? 0.6 : 0.45;
      g.moveTo(hub.x, hub.y).lineTo(end.x, end.y).stroke({ color, width: (gold ? 7 : 4) * k, alpha });
      if (sight?.m) {
        const p = at(sight.m.id, sight.m.d, sight.m.w);
        over.circle(p.x, p.y, (sight.m.r / FP) * k * 1.3 + 4 * k).stroke({ color: P.red, width: 4 * k, alpha: 0.9 });
      }
    } else {
      const tip = toDesign(f, CRANE_D + Math.cos(ang) * len, CRANE_W + Math.sin(ang) * len);
      const dir = Math.atan2(tip.y - hub.y, tip.x - hub.x);
      // the hook hangs along the rope with its mouth on the tip, so it catches where it looks to
      const hook = tex('hook');
      const ring = hook ? (HOOK_MOUTH - HOOK_RING) * hook.height * areaScale('hook', HOOK_R * k) : 0;
      const end = { x: tip.x - Math.cos(dir) * ring, y: tip.y - Math.sin(dir) * ring };
      const paint = wornColors(s.harbour?.wear);
      g.moveTo(hub.x, hub.y).lineTo(end.x, end.y).stroke({ color: paint.rope, width: 4 * k });
      if (w.mines > 0 && len > 30 + ring / k) {
        const back = 24 * k;
        bodies.put('mine', end.x - Math.cos(dir) * back, end.y - Math.sin(dir) * back, MINE_R * k);
      }
      if (!bodies.put('hook', tip.x, tip.y, HOOK_R * k, { rot: dir - Math.PI / 2, ay: HOOK_MOUTH, tint: paint.hook })) {
        g.circle(tip.x, tip.y, 7 * k).fill(P.brassDark).stroke({ color: P.line, width: 2.5 * k });
      }
      for (const gr of h.grabs) if (gr.t === 'item') item(gr.item, at(gr.item.id, gr.item.d, gr.item.w));
    }

    // thrown junk flies ~27 units a tick, so it is drawn between ticks too or it judders
    for (const sh of w.shots) {
      // one thrown this tick starts a step back, at its launch point
      const was = s.prevShots.get(sh) ?? { d: sh.d - (sh.ud * B.throw.speed) / 1000, w: sh.w - (sh.uw * B.throw.speed) / 1000 };
      const d = was.d + (sh.d - was.d) * a;
      const wv = was.w + (sh.w - was.w) * a;
      const p = toDesign(f, d / FP, wv / FP);
      const r = (B.catch.junkRadius / FP) * k;
      if (!bodies.put('junk_barrel', p.x, p.y, lookRadius('junk_barrel', r, f.wide), { rot: (d + wv) / FP / 12 })) {
        g.roundRect(p.x - r, p.y - r, r * 2, r * 2, r / 3).fill(CATCH.junk).stroke({ color: P.line, width: 2.5 * k });
      }
    }

    // the winch: still and symmetric, with its pulley wheel on the launch point, so the rope and the
    // aim start from its middle. A turning boom swung about too much to watch, and its pulley off
    // to one side made the launch point look shifted.
    if (!bodies.put('winch', hub.x, hub.y, WINCH_R * k, { ay: WINCH_PULLEY })) {
      g.circle(hub.x, hub.y, 24 * k).fill(P.brass).stroke({ color: P.line, width: 3.5 * k });
    }
    if (w.held) {
      const r = HELD_R * k;
      if (!bodies.put(fishArt(w, w.held, f.wide), hub.x, hub.y, r)) {
        g.roundRect(hub.x - r, hub.y - r, r * 2, r * 2, r / 3).fill(CATCH.junk).stroke({ color: P.line, width: 2.5 * k });
      }
    }
    bodies.end();
  }

  private monster(m: Monster, p: Pt & { d: number }, grip: number, time: number, under: boolean, seen: number): void {
    const { f, under: g, bodies, over } = this;
    const k = f.scale;
    const r = (m.r / FP) * k;
    const stunned = m.stun > 0;
    const st = stunned || m.grab ? { up: 0, rot: 0, sx: 1, sy: 1 } : step(m, p.d);
    const boss = isBoss(m.kind);
    const { art, tint } = monsterArt(m.kind, f.wide, m.shell > 0);
    const drawn = bodies.put(art, p.x, p.y - st.up * r, lookRadius(art, r, f.wide), {
      // a hooked moray pulling the rope out thrashes
      rot: st.rot + (m.grab ? Math.sin(p.x * 0.05) * 0.2 : 0) + (m.tug > 0 ? Math.sin(time * 40) * 0.35 : 0),
      sx: st.sx,
      sy: st.sy,
      // a diving ray is a dark shape under the water: out of reach until it surfaces
      alpha: (under ? DIVE_ALPHA : stunned ? 0.75 : 1) * seen,
      tint: under ? 0x3a4a78 : stunned ? 0xb8c4d6 : tint,
    });
    // a hermit borrowing the crab's sprite carries its shell on its back
    if (m.shell > 0 && !hasOwnArt(m.kind, f.wide)) drawShell(over, p.x, p.y - st.up * r - r * 0.25, r * 0.85, k);
    // a boss's chest rides on its back: what killing it at sea drops
    // a bounty wears a brass ring that beats: the marked one with a purse on it (sim/seaEvents.ts)
    if (m.bounty) {
      const beat = 0.5 + 0.5 * Math.sin(time * 6);
      over.circle(p.x, p.y, r * (1.35 + beat * 0.12)).stroke({ color: P.brassLight, width: 5 * k, alpha: (0.6 + beat * 0.4) * seen });
      over.star(p.x, p.y - r * 1.55, 5, r * 0.32, r * 0.14).fill({ color: P.brassLight, alpha: seen }).stroke({ color: P.line, width: 2 * k });
    }
    if (boss) bodies.put('chest', p.x, p.y - st.up * r - r * 0.35, r * BOSS_CHEST, { rot: st.rot });
    // a glutton shows the coins it has eaten: one coin for every few, over its head
    else if (m.ate > 0) drawCoins(over, p.x, p.y - r * 1.6, Math.min(MAX_COINS, Math.ceil(m.ate / COINS_EACH)), k);
    if (!drawn) {
      g.circle(p.x, p.y, r).fill({ color: MON[m.kind], alpha: stunned ? 0.6 : 1 }).stroke({ color: P.line, width: 3 * k });
      // eyes: red, the one warm thing a monster may carry
      g.circle(p.x - r * 0.35, p.y - r * 0.2, r * 0.18).fill(P.red);
      g.circle(p.x + r * 0.35, p.y - r * 0.2, r * 0.18).fill(P.red);
    }
    if (m.grab) over.circle(p.x, p.y, r * 1.25).stroke({ color: P.brassLight, width: 3 * k, alpha: 0.9 });
    if (m.eat) over.circle(p.x, p.y, r * 1.35).stroke({ color: CATCH.fish, width: 2 * k, alpha: 0.8 });
    // hit points as pips under it; the ones over the hook's grip are steel squares, so a monster
    // the hook will bounce off says so before the cast; none until it is out of the fog
    if (under || seen < 1) return;
    const { n, heavy } = pips(m.hp, boss ? 0 : grip);
    const pr = 2.6 * k;
    const left = p.x - ((n - 1) * pr * 2.6) / 2;
    const y = p.y + r * 1.3 + pr * 2;
    const line = { color: P.line, width: 1.2 * k };
    for (let i = 0; i < n; i++) {
      const x = left + i * pr * 2.6;
      if (i < n - heavy) over.circle(x, y, pr).fill(P.cream).stroke(line);
      else over.rect(x - pr * 1.05, y - pr * 1.05, pr * 2.1, pr * 2.1).fill(HEAVY).stroke(line);
    }
    // and a weight on its shoulder, big enough to see on a phone, while it is too heavy to lift
    if (heavy > 0) drawWeight(over, p.x + r * 1.25, p.y - r * 1.1, Math.max(WEIGHT_MIN, (m.r / FP) * 0.5) * k, k);
    // a red "!" when it will reach the dock in a moment (danger.ts)
    if (inDanger(m)) drawAlert(over, p.x - r * 1.15, p.y - r * 1.15, (12 + 2 * Math.sin(time * 12)) * k, k);
  }
}

/** A spiral shell, its base on (x, y) and `s` its radius. */
function drawShell(g: Graphics, x: number, y: number, s: number, k: number): void {
  g.ellipse(x, y - s * 0.35, s, s * 0.75).fill(SHELL).stroke({ color: P.line, width: 2.5 * k });
  g.moveTo(x + s * 0.55, y - s * 0.3);
  for (let i = 1; i <= 16; i++) {
    const a = i * 0.7;
    const rr = s * 0.55 * (1 - i / 18);
    g.lineTo(x + Math.cos(a) * rr, y - s * 0.35 + Math.sin(a) * rr * 0.75);
  }
  g.stroke({ color: P.line, width: 2 * k, alpha: 0.7 });
}

/** A red round badge with a "!" in it, centred on (x, y), `s` its radius. */
function drawAlert(g: Graphics, x: number, y: number, s: number, k: number): void {
  g.circle(x, y, s).fill(P.red).stroke({ color: P.line, width: 1.5 * k });
  g.roundRect(x - s * 0.16, y - s * 0.62, s * 0.32, s * 0.78, s * 0.16).fill(P.cream);
  g.circle(x, y + s * 0.42, s * 0.17).fill(P.cream);
}

/** Cracks across the dock's planks and a slow red throb on it, while the dock is about to fall. */
function drawCracks(g: Graphics, f: Field, time: number): void {
  const dock = B.dock.edge / FP;
  const k = f.scale;
  const throb = 0.5 + 0.5 * Math.sin(time * 4);
  const a = toDesign(f, 0, 0);
  const b = toDesign(f, dock, LANE_W);
  g.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)).fill({ color: P.red, alpha: 0.12 + throb * 0.2 });
  for (const [w0, d0, w1, d1] of CRACKS) {
    const pts = [0, 1, 2, 3, 4].map((i) => {
      const u = i / 4;
      // a zigzag: every other point steps off the line
      const off = i % 2 ? (i === 1 ? 9 : -8) : 0;
      return toDesign(f, (d0 + (d1 - d0) * u) * dock + off, w0 + (w1 - w0) * u);
    });
    // a pale split with a dark gap down its middle, so it reads as broken wood, not rope
    for (const [color, width] of [[P.cream, 7], [0x1a0e08, 3.5]] as const) {
      g.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
      g.stroke({ color, width: width * k, alpha: 0.9, cap: 'round', join: 'miter' });
    }
  }
}

const LANE_W = 480;
/** Where the cracks run on the dock: lane w from and to, and depth as a share of the dock. */
const CRACKS: readonly (readonly [number, number, number, number])[] = [
  [40, 0.75, 150, 0.35],
  [210, 0.9, 300, 0.4],
  [360, 0.7, 450, 0.2],
];

/** `n` coins in a little stack centred on (x, y). */
function drawCoins(g: Graphics, x: number, y: number, n: number, k: number): void {
  const cr = 6 * k;
  for (let i = 0; i < n; i++) {
    const cx = x + (i - (n - 1) / 2) * cr * 1.25;
    const cy = y - (i % 2) * cr * 0.6;
    g.circle(cx, cy, cr).fill(P.brassLight).stroke({ color: P.line, width: 1.4 * k });
  }
}

/** A weight (a steel trapezoid with a ring on top) of half-width `s` centred on (x, y). */
function drawWeight(g: Graphics, x: number, y: number, s: number, k: number): void {
  const top = y - s * 0.45;
  const bot = y + s * 0.75;
  g.circle(x, top - s * 0.25, s * 0.38).stroke({ color: P.line, width: 3.6 * k }).stroke({ color: HEAVY, width: 1.6 * k });
  g.poly([x - s * 0.6, top, x + s * 0.6, top, x + s, bot, x - s, bot]).fill(HEAVY).stroke({ color: P.line, width: 1.8 * k });
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
