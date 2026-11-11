// Short flashes for what the sim reports (sim/events.ts): rings for hits, blasts, mines and kills,
// a rising "+7" when coins come in, and a red wash over the dock when a monster gets through. A
// thrown hit lands far out, often 700 from the crane, so it gets a wide brass ring and its damage
// rising from the monster: a small cream ring up there went unseen.
// The fun layer's (sim/fun.ts) get words: a streak's pay, "Perfect!", a gold fish, a bounty.
// Grey-box stand-ins for the particles of M4.

import { Container, Graphics, Text } from 'pixi.js';
import { t } from '../../i18n';
import { B } from '../../sim/balance';
import type { SimEvent } from '../../sim/events';
import { LANE_LEN } from '../../sim/lane';
import { FP } from '../../sim/math/fixed';
import { MON, P } from '../kit/palette';
import { Redraw } from '../kit/redraw';
import { label } from '../kit/text';
import { toDesign, type Field } from '../orient';
import { bandRect } from './field';

interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  color: number;
  ms: number;
  life: number;
}

interface Pop {
  text: Text;
  ms: number;
}

const RING_MS = 350;
const THROWN_MS = 550;
/** How far out from a hit monster its damage starts rising, world units. */
const DMG_LIFT = 30;
const POP_MS = 900;
const LEAK_MS = 400;

export class Fx extends Container {
  private readonly g = new Graphics();
  private readonly redraw = new Redraw();
  private rings: Ring[] = [];
  private pops: Pop[] = [];
  private leakMs = 0;

  constructor(private readonly f: Field) {
    super();
    this.addChild(this.g);
  }

  add(events: readonly SimEvent[]): void {
    const f = this.f;
    const ring = this.ring;
    for (const ev of events) {
      if (ev.e === 'hit' && ev.thrown) {
        ring(ev.d, ev.w, 10, 48, P.brassLight, THROWN_MS);
        // starts just seaward of the monster, the way it rises, so it does not cover it (but inside
        // the lane, not under the top bar)
        this.pop(t('fx.damage', { n: ev.dmg }), toDesign(f, Math.min(ev.d / FP + DMG_LIFT, LANE_LEN - DMG_LIFT), ev.w / FP), P.brassLight);
      } else if (ev.e === 'hit' || ev.e === 'bounce') ring(ev.d, ev.w, 8, 26, P.cream);
      else if (ev.e === 'shell') ring(ev.d, ev.w, 10, 40, P.brassLight, 400);
      else if (ev.e === 'summon') ring(ev.d, ev.w, 14, 70, P.red, 600);
      else if (ev.e === 'blast') ring(ev.d, ev.w, 10, ev.r / FP, P.brassLight, 450);
      else if (ev.e === 'mine') ring(ev.d, ev.w, 10, ev.r / FP, P.red, 600);
      else if (ev.e === 'kill') ring(ev.d, ev.w, 6, 34, ev.crushed ? P.brassLight : P.cream);
      else if (ev.e === 'coins') this.pop(t('fx.coins', { n: ev.amount }), toDesign(f, B.crane.d / FP + 30, B.crane.w / FP + 40), P.brassLight);
      else if (ev.e === 'leak') this.leakMs = LEAK_MS;
      else this.fun(ev);
    }
  }

  /** The fun layer's flashes (sim/fun.ts): streaks, perfect casts, gold, bounties, the pufferfish. */
  private fun(ev: SimEvent): void {
    const f = this.f;
    const ring = this.ring;
    const at = (d: number, w: number) => toDesign(f, Math.min(d / FP + DMG_LIFT, LANE_LEN - DMG_LIFT), w / FP);
    const crane = (lift = 0) => toDesign(f, B.crane.d / FP + 30 + lift, B.crane.w / FP - 60);
    if (ev.e === 'combo') this.pop(t('fx.combo', { n: ev.n, c: ev.coins }), at(ev.d, ev.w), ev.n >= 4 ? P.red : P.brassLight, 30 + Math.min(ev.n, 8) * 3);
    else if (ev.e === 'perfect') {
      ring(ev.d, ev.w, 6, 40, P.cream, 400);
      this.pop(t('fx.perfect'), at(ev.d, ev.w), P.cream, 34);
    } else if (ev.e === 'gold') this.pop(t('fx.gold', { n: ev.amount }), crane(20), P.brassLight, 40);
    else if (ev.e === 'bounty') {
      ring(ev.d, ev.w, 10, 90, P.brassLight, 700);
      this.pop(t('fx.bounty', { n: ev.coins }), at(ev.d, ev.w), P.brassLight, 42);
    } else if (ev.e === 'keg') this.pop(t('fx.keg'), crane(40), P.cream);
    else if (ev.e === 'barnacle') this.pop(t('fx.barnacle', { n: ev.hp }), crane(40), P.cream);
    else if (ev.e === 'burst') ring(ev.d, ev.w, 10, ev.r / FP, MON.puffer, 500);
    else if (ev.e === 'boom') {
      ring(ev.d, ev.w, 10, ev.r / FP, P.red, 650);
      ring(ev.d, ev.w, 6, (ev.r / FP) * 0.6, MON.puffer, 450);
      this.pop(t('fx.boom'), at(ev.d, ev.w), P.red, 44);
    } else if (ev.e === 'tug') this.pop(t('fx.tug'), crane(80), P.red, 40);
  }

  /** A ring that opens from r0 to r1 over `life` at the lane point (d, w), both in FP. */
  private readonly ring = (d: number, w: number, r0: number, r1: number, color: number, life = RING_MS): void => {
    const f = this.f;
    const p = toDesign(f, d / FP, w / FP);
    this.rings.push({ x: p.x, y: p.y, r0: r0 * f.scale, r1: r1 * f.scale, color, ms: 0, life });
  };

  /** Words that pop up on `p` and rise: coins beside the crane, damage on a monster. */
  private pop(text: string, p: { x: number; y: number }, fill: number, size = 30): void {
    const tx = label(text, size * this.f.scale, { fill });
    tx.anchor.set(0.5);
    tx.position.set(p.x, p.y);
    this.addChild(tx);
    this.pops.push({ text: tx, ms: 0 });
  }

  update(frameMs: number): void {
    if (this.leakMs > 0) this.leakMs -= frameMs;
    this.rings = this.rings.filter((r) => (r.ms += frameMs) < r.life);
    // a quiet lane shows neither, and clearing an empty layer still costs (kit/redraw.ts)
    if (this.redraw.needed(this.leakMs > 0 || this.rings.length > 0)) {
      const g = this.g.clear();
      if (this.leakMs > 0) {
        const r = bandRect(this.f, 0, B.dock.edge / FP);
        g.rect(r.x, r.y, r.w, r.h).fill({ color: P.red, alpha: 0.45 * Math.max(0, this.leakMs / LEAK_MS) });
      }
      for (const r of this.rings) {
        const u = r.ms / r.life;
        g.circle(r.x, r.y, r.r0 + (r.r1 - r.r0) * u).stroke({ color: r.color, width: 4 * this.f.scale * (1 - u) + 1, alpha: 1 - u });
      }
    }
    const rise = this.f.wide ? { x: 1, y: 0 } : { x: 0, y: -1 };
    for (const p of this.pops) {
      p.ms += frameMs;
      const step = (frameMs / POP_MS) * 60 * this.f.scale;
      p.text.position.set(p.text.x + rise.x * step, p.text.y + rise.y * step);
      p.text.alpha = 1 - p.ms / POP_MS;
      if (p.ms >= POP_MS) p.text.destroy();
    }
    this.pops = this.pops.filter((p) => p.ms < POP_MS);
  }
}
