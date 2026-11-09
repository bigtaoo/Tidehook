// The dev tap recorder (on in dev builds; rec/wire.ts): every tap in a game, what the player saw when they made it and what
// came of it, one JSON object each, handed to `send` (app.ts posts them to the dev server, which
// writes them to recordings/; scripts/recSink.mjs). scripts/rec/analyze.mjs reads them back: which
// target each tap most likely meant, how far off the hook went and which way. It only reads the
// Session; nothing here touches the sim.

import { B } from '../../sim/balance';
import { hookTip } from '../../sim/hook';
import { FP } from '../../sim/math/fixed';
import { BRAD_FULL } from '../../sim/math/trig';
import type { SimEvent } from '../../sim/events';
import type { Shot, World } from '../../sim/world';
import type { Session, TapInfo } from '../session';

const CD = B.crane.d / FP;
const CW = B.crane.w / FP;
const r1 = (x: number) => Math.round(x * 10) / 10;
const deg = (brads: number) => r1((brads / BRAD_FULL) * 360);
/** A lane point's bearing from the crane, degrees (0 straight out, + towards +w). */
const bearing = (d: number, w: number) => r1((Math.atan2(w - CW, d - CD) * 180) / Math.PI);

/** A thing on the lane as the player saw it at the tap, world units. */
export interface Seen {
  id: number;
  what: string;
  d: number;
  w: number;
  r: number;
  /** Bearing from the crane, degrees, and distance. */
  ang: number;
  dist: number;
}

/** How close the hook (or the thrown junk) came to a thing on its way out. */
export interface Near {
  id: number;
  /** Closest gap between the hook's catching circle and the thing, world units (<= 0: touched). */
  gap: number;
  /** The thing's bearing minus the hook's, degrees, times the swing's way: + it was further along
   *  the swing than the hook went (the tap came early), - behind it (late). */
  off: number;
}

export interface TapRecord {
  k: 'tap';
  n: number;
  /** Seconds since the recorder started, wave, tick. */
  s: number;
  wave: number;
  tick: number;
  fired: boolean;
  threw: boolean;
  /** The hook's state and rope length when a tap did nothing. */
  st?: string;
  len?: number;
  ageMs: number;
  alpha: number;
  /** Swing look-back, degrees of aim; the swing's way; the aims (TapInfo) in degrees. */
  back: number;
  dir: number;
  shown: number;
  sim: number;
  cast: number;
  /** Swing half-width, degrees, and the catching radius, world units. */
  swing: number;
  reach: number;
  seen: Seen[];
  out?: { grabs: string[]; got: number[]; bounce: boolean; hits: number[]; turn: number; near: Near[] };
}

type Open = {
  rec: TapRecord;
  near: Map<number, Near>;
  shot: Shot | null;
  bounce: boolean;
  hits: number[];
  /** Where the tip was at the last look, world units: a frame's gap is to the stretch it swept. */
  last: { d: number; w: number } | null;
};

export class TapRecorder {
  private n = 0;
  private ms = 0;
  private open: Open | null = null;

  constructor(private readonly send: (rec: object) => void) {}

  /** Session.tapWatch. */
  tap(s: Session, t: TapInfo): void {
    // a tap that did nothing leaves the cast in flight to finish
    if (this.open && t.fired) this.close(s.world);
    const w = s.world;
    const rec: TapRecord = {
      k: 'tap',
      n: ++this.n,
      s: r1(this.ms / 1000),
      wave: w.wave,
      tick: w.tick,
      fired: t.fired,
      threw: t.threw,
      ageMs: Math.round(t.ageMs),
      alpha: Math.round(t.alpha * 100) / 100,
      back: r1((deg(t.sim) - deg(t.cast)) * t.dir),
      dir: t.dir,
      shown: deg(t.shown),
      sim: deg(t.sim),
      cast: deg(t.cast),
      swing: deg(w.up.swing),
      reach: (t.threw ? B.throw.radius : B.hook.tip) / FP,
      seen: seen(s),
    };
    if (!t.fired) {
      rec.st = w.hook.st;
      rec.len = Math.round(w.hook.len / FP);
      this.send(rec);
      return;
    }
    const shot = t.threw ? w.shots[w.shots.length - 1] : null;
    this.open = { rec, near: new Map(), shot, bounce: false, hits: [], last: null };
    this.track(w);
  }

  /** Once a frame, after the ticks, with the frame's events: follows the open cast or throw until
   *  it is over. */
  frame(s: Session, frameMs: number, events: readonly SimEvent[]): void {
    this.ms += frameMs;
    const o = this.open;
    if (!o) return;
    const w = s.world;
    for (const ev of events) {
      if (ev.e === 'bounce') o.bounce = true;
      if (ev.e === 'hit' && !o.hits.includes(ev.id)) o.hits.push(ev.id);
    }
    const flying = o.shot ? w.shots.includes(o.shot) : w.hook.st === 'out';
    // one last look too: a cast often catches on the tick it turns back, and a shot keeps where it
    // was when it hit and left the lane
    this.track(w);
    if (!flying) this.close(w);
  }

  private track(w: World): void {
    const o = this.open!;
    const tip = o.shot ? { d: o.shot.d, w: o.shot.w } : hookTip(w);
    const reach = o.rec.reach;
    const td = tip.d / FP;
    const tw = tip.w / FP;
    const from = o.last ?? { d: td, w: tw };
    o.last = { d: td, w: tw };
    const heading = bearing(td, tw);
    if (o.shot) for (const id of o.shot.hit) if (!o.hits.includes(id)) o.hits.push(id);
    for (const t of o.rec.seen) {
      const at = where(w, t.id);
      if (!at) continue;
      const gap = r1(toSegment(at, from, o.last) - t.r - reach);
      const was = o.near.get(t.id);
      if (!was || gap < was.gap) o.near.set(t.id, { id: t.id, gap, off: r1((bearing(at.d, at.w) - heading) * o.rec.dir) });
    }
  }

  private close(w: World): void {
    const o = this.open!;
    this.open = null;
    const near = [...o.near.values()].filter((n) => n.gap < 40).sort((a, b) => a.gap - b.gap);
    o.rec.out = {
      grabs: o.shot ? [] : w.hook.grabs.map((g) => (g.t === 'item' ? what(g.item) : (w.mons.find((m) => m.id === g.id)?.kind ?? 'mon'))),
      got: o.shot ? [] : w.hook.grabs.map((g) => (g.t === 'item' ? g.item.id : g.id)),
      bounce: o.bounce,
      hits: o.hits,
      turn: Math.round(w.hook.len / FP),
      near,
    };
    this.send(o.rec);
  }
}

const what = (it: { kind: string; chest: boolean }) => (it.chest ? 'chest' : it.kind);

/** Everything on the lane where the view drew it at the tap (between the last two ticks). */
function seen(s: Session): Seen[] {
  const w = s.world;
  const out: Seen[] = [];
  const add = (id: number, kind: string, d: number, wv: number, r: number) => {
    const p = s.prev.get(id);
    const dd = (p ? p.d + (d - p.d) * s.alpha : d) / FP;
    const ww = (p ? p.w + (wv - p.w) * s.alpha : wv) / FP;
    out.push({ id, what: kind, d: r1(dd), w: r1(ww), r: r / FP, ang: bearing(dd, ww), dist: Math.round(Math.hypot(dd - CD, ww - CW)) });
  };
  for (const it of w.items) add(it.id, what(it), it.d, it.w, it.r);
  for (const m of w.mons) if (!m.grab) add(m.id, m.kind, m.d, m.w, m.r);
  return out;
}

/** Where a thing is now, world units, or null once it is gone (caught, eaten, killed). */
function where(w: World, id: number): { d: number; w: number } | null {
  let it = w.items.find((i) => i.id === id);
  for (const g of w.hook.grabs) if (g.t === 'item' && g.item.id === id) it = g.item;
  if (it) return { d: it.d / FP, w: it.w / FP };
  const m = w.mons.find((mm) => mm.id === id);
  return m ? { d: m.d / FP, w: m.w / FP } : null;
}

/** A point's distance to the stretch from a to b. */
function toSegment(p: { d: number; w: number }, a: { d: number; w: number }, b: { d: number; w: number }): number {
  const vd = b.d - a.d;
  const vw = b.w - a.w;
  const len2 = vd * vd + vw * vw;
  const k = len2 > 0 ? Math.min(1, Math.max(0, ((p.d - a.d) * vd + (p.w - a.w) * vw) / len2)) : 0;
  return Math.hypot(p.d - a.d - k * vd, p.w - a.w - k * vw);
}
