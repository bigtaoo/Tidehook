// One sitting at the game: the title, a run of waves, the game over and the next game. It owns
// the World, runs it at the fixed tick rate (view/fixedStep.ts) and is the only thing that
// commands it, so the player's taps and keys, the ?autoplay bot and tests all come through here.
// No Pixi: the view reads `world`, `prev` and the drained events to draw.

import { Pilot } from '../sim/bot/bot';
import type { SimEvent } from '../sim/events';
import { buyCard, buyMine, buyRepair, fire, nextWave, reroll, startGame, step } from '../sim/step';
import type { World } from '../sim/world';
import { FixedStep } from '../view/fixedStep';

export type Mode = 'title' | 'play' | 'over';

export interface SessionOptions {
  seed: number;
  /** Game speed: 2 runs twice the ticks per second. */
  speed: number;
  /** A bot persona (bot.ts) that plays instead of the player, or null. */
  autoplay: string | null;
}

/** A lane point a tick ago, FP. */
export interface Was {
  d: number;
  w: number;
}

/** Ticks the bot waits in the shop, so its visits can be seen. */
const BOT_SHOP_TICKS = 30;
/** After the dock falls, taps wait this long (ms) before starting again: a tap meant for the
 *  last monster must not skip the game over. */
export const OVER_LOCK_MS = 800;

export class Session {
  mode: Mode = 'title';
  paused = false;
  world: World;
  /** Every monster's and item's position before the last step, by id; the hook's aim and rope. */
  readonly prev = new Map<number, Was>();
  prevHook = { ang: 0, len: 0 };
  /** How many games have started. */
  games = 0;
  private readonly fixed = new FixedStep();
  private pilot: Pilot | null = null;
  private shopWait = 0;
  private events: SimEvent[] = [];
  private overMs = 0;

  constructor(readonly opts: SessionOptions) {
    this.world = startGame(opts.seed);
  }

  /** How far into the next tick to draw, 0 to 1. */
  get alpha(): number {
    return this.mode === 'play' && !this.paused ? this.fixed.alpha : 1;
  }

  /** A new game: the first on the title's world, then a new seed each time. */
  start(): void {
    if (this.games > 0) this.world = startGame(this.opts.seed + this.games);
    this.games++;
    this.mode = 'play';
    this.paused = false;
    this.pilot = this.opts.autoplay ? new Pilot(this.world.seed, this.opts.autoplay) : null;
    this.shopWait = 0;
    this.snapshot();
    this.collect();
  }

  /** Runs the ticks `frameMs` of real time is worth; returns how many ran. */
  update(frameMs: number): number {
    if (this.mode === 'over') this.overMs += frameMs;
    if (this.mode !== 'play' || this.paused) return 0;
    const n = this.fixed.advance(frameMs, this.opts.speed);
    for (let i = 0; i < n; i++) {
      const w = this.world;
      if (w.phase === 'shop') {
        if (this.pilot && ++this.shopWait >= BOT_SHOP_TICKS) {
          this.shopWait = 0;
          this.pilot.tick(w);
          this.collect();
        }
        if (w.phase === 'shop') continue;
      }
      this.snapshot();
      this.pilot?.tick(w);
      this.collect();
      step(w);
      this.events.push(...w.events);
      if (w.phase === 'over') {
        this.mode = 'over';
        this.overMs = 0;
        break;
      }
    }
    return n;
  }

  /** The events since the last drain, for the view and audio. */
  drain(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** A tap on the lane or Space: start, resume, or cast. */
  tap(): void {
    if (this.mode === 'over' && this.overMs < OVER_LOCK_MS) return;
    if (this.mode !== 'play') this.start();
    else if (this.paused) this.paused = false;
    else if (!this.pilot) {
      fire(this.world);
      this.collect();
    }
  }

  togglePause(): void {
    if (this.mode === 'play') this.paused = !this.paused;
  }

  pause(): void {
    if (this.mode === 'play') this.paused = true;
  }

  /** Shop commands; false when not possible (not in the shop, too dear, sold out). */
  buy(i: number): boolean {
    return this.shopping() && buyCard(this.world, i);
  }

  repair(): boolean {
    return this.shopping() && buyRepair(this.world);
  }

  mine(): boolean {
    return this.shopping() && buyMine(this.world);
  }

  reroll(): boolean {
    return this.shopping() && reroll(this.world);
  }

  nextWave(): boolean {
    if (!this.shopping()) return false;
    this.snapshot();
    const ok = nextWave(this.world);
    this.collect();
    return ok;
  }

  /** The player may shop: in the shop, not paused, not the bot's turn. */
  shopping(): boolean {
    return this.mode === 'play' && !this.paused && !this.pilot && this.world.phase === 'shop';
  }

  /** Takes the events a command raised outside a step (a cast, a throw, the wave starting), which
   *  the next step would otherwise clear unseen. */
  private collect(): void {
    this.events.push(...this.world.events);
    this.world.events = [];
  }

  private snapshot(): void {
    const w = this.world;
    this.prev.clear();
    for (const m of w.mons) this.prev.set(m.id, { d: m.d, w: m.w });
    for (const it of w.items) this.prev.set(it.id, { d: it.d, w: it.w });
    for (const g of w.hook.grabs) if (g.t === 'item') this.prev.set(g.item.id, { d: g.item.d, w: g.item.w });
    this.prevHook = { ang: w.hook.ang, len: w.hook.len };
  }
}
