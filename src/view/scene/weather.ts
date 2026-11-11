// The weather over the actors (sim/weather.ts): in the Fog Bank a wall of fog past the fog line,
// thinning in over the fog band, with slow wisps along its edge, so what the sim hides is hidden on
// screen too; in the Storm Reach streaks blowing across the lane with the gust, longer and brighter
// the harder it blows, so a player can see which way a cast will bend. The water's tint under the
// actors is field.ts drawWeather.

import { Container, Graphics } from 'pixi.js';
import type { Session } from '../../game/session';
import { B } from '../../sim/balance';
import { LANE_LEN, LANE_WIDTH } from '../../sim/lane';
import { FP } from '../../sim/math/fixed';
import { seaOf } from '../../sim/seas';
import { gust } from '../../sim/weather';
import { SEA } from '../kit/palette';
import { Redraw } from '../kit/redraw';
import { toDesign, type Field } from '../orient';
import { bandRect } from './field';

/** The fog band drawn in this many steps, then the wall's own opacity past it. */
const FOG_STEPS = 6;
const FOG_WALL = 0.96;
const WISPS = 7;
/** Wind streaks: how many, how fast at the strongest gust (world units a second), how long. */
const STREAKS = 16;
const STREAK_SPEED = 260;
const STREAK_LEN = 46;
const STREAK_COLOR = 0xcfe0ee;

export class WeatherTop extends Container {
  private readonly wall = new Graphics();
  private readonly moving = new Graphics();
  private readonly redraw = new Redraw();
  private sea = '';
  /** The wind's travel so far, world units across the lane (signed). */
  private blown = 0;
  private time = 0;

  constructor(private readonly f: Field) {
    super();
    // nothing of the weather spills off the lane
    const lane = bandRect(f, 0, LANE_LEN);
    const mask = new Graphics().rect(lane.x, lane.y, lane.w, lane.h).fill(0xffffff);
    this.addChild(this.wall, this.moving, mask);
    this.mask = mask;
  }

  draw(s: Session, frameMs: number): void {
    const w = s.world;
    const sea = seaOf(w);
    if (sea.id !== this.sea) {
      this.sea = sea.id;
      this.drawWall(sea.fog / FP);
    }
    const dt = s.paused ? 0 : frameMs / 1000;
    this.time += dt;
    if (sea.wind > 0) this.blown += (gust(w) / sea.wind) * STREAK_SPEED * dt;
    // the bay has neither, and clearing an empty layer still costs (kit/redraw.ts)
    if (!this.redraw.needed(sea.fog > 0 || sea.wind > 0)) return;
    const g = this.moving;
    g.clear();
    if (sea.fog > 0) this.wisps(g, sea.fog / FP);
    if (sea.wind > 0) this.streaks(g, gust(w) / sea.wind);
  }

  private drawWall(fog: number): void {
    const g = this.wall;
    g.clear();
    if (fog <= 0) return;
    const line = B.crane.d / FP + fog;
    const band = B.weather.fogBand / FP;
    for (let i = 0; i < FOG_STEPS; i++) {
      const r = bandRect(this.f, line + (band * i) / FOG_STEPS, line + (band * (i + 1)) / FOG_STEPS);
      g.rect(r.x, r.y, r.w, r.h).fill({ color: SEA.fog, alpha: (FOG_WALL * (i + 1)) / (FOG_STEPS + 1) });
    }
    const r = bandRect(this.f, line + band, LANE_LEN);
    g.rect(r.x, r.y, r.w, r.h).fill({ color: SEA.fog, alpha: FOG_WALL });
  }

  /** Soft puffs drifting along the fog's edge. */
  private wisps(g: Graphics, fog: number): void {
    const line = B.crane.d / FP + fog;
    const k = this.f.scale;
    for (let i = 0; i < WISPS; i++) {
      const across = (((i * 83 + this.time * (9 + i * 3)) % (LANE_WIDTH + 80)) + LANE_WIDTH + 80) % (LANE_WIDTH + 80) - 40;
      const out = line - 6 + Math.sin(this.time * 0.7 + i * 1.9) * 10;
      const p = toDesign(this.f, out, across);
      const rx = (34 + (i % 3) * 12) * k;
      g.ellipse(p.x, p.y, this.f.wide ? rx * 0.55 : rx, this.f.wide ? rx : rx * 0.55).fill({ color: SEA.fog, alpha: 0.35 });
    }
  }

  /** Streaks across the lane, blowing with the gust (`share` of the sea's strongest, signed). */
  private streaks(g: Graphics, share: number): void {
    const strength = Math.abs(share);
    if (strength < 0.05) return;
    const span = LANE_WIDTH + STREAK_LEN * 2;
    const dock = B.dock.edge / FP;
    const len = STREAK_LEN * (0.3 + 0.7 * strength) * Math.sign(share);
    const k = this.f.scale;
    const heads: { x: number; y: number }[] = [];
    for (let i = 0; i < STREAKS; i++) {
      const d = dock + 20 + ((i * 241) % (LANE_LEN - dock - 40));
      const across = ((((i * 157 + this.blown * (0.8 + (i % 4) * 0.15)) % span) + span) % span) - STREAK_LEN;
      // slanted out to sea at the tail, so a still frame shows the way it blows too
      const a = toDesign(this.f, d + Math.abs(len) * 0.35, across - len);
      const b = toDesign(this.f, d, across);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y);
      heads.push(b);
    }
    const alpha = 0.15 + 0.4 * strength;
    g.stroke({ color: STREAK_COLOR, width: 3 * k, alpha, cap: 'round' });
    for (const h of heads) g.circle(h.x, h.y, 3.2 * k);
    g.fill({ color: STREAK_COLOR, alpha: Math.min(1, alpha + 0.2) });
  }
}
