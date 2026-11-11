// One sitting at the game: the title, a run of waves, the game over, the harbour between games
// (meta/harbour.ts, docs/02-onboarding.md section 7) and the next game. It owns
// the World, runs it at the fixed tick rate (view/fixedStep.ts) and is the only thing that
// commands it, so the player's taps and keys, the ?autoplay bot and tests all come through here.
// No Pixi: the view reads `world`, `prev` and the drained events to draw.

import { Pilot } from '../sim/bot/bot';
import type { SimEvent } from '../sim/events';
import { TICK_RATE } from '../sim/math/fixed';
import { BRAD_FULL } from '../sim/math/trig';
import { buyCard, buyMine, buyRepair, fire, nextWave, reroll, startGame, step } from '../sim/step';
import { B, type GoalSpec } from '../sim/balance';
import { counts } from '../sim/goals';
import { seaOf } from '../sim/seas';
import { pearlsFor } from '../sim/meta';
import { revive } from '../sim/revive';
import type { Shot, World } from '../sim/world';
import { FixedStep } from '../view/fixedStep';
import type { Guide } from './guide/guide';
import { BF } from '../sim/balanceFun';
import { dailySea, daySeed } from './meta/daily';
import type { Harbour } from './meta/harbour';

export type Mode = 'title' | 'play' | 'over' | 'lobby';

/** How the last game went: its wave, the pearls it brought home and the log entries it met. */
export interface LastGame {
  wave: number;
  /** Everything it brought home; `won` is the game's own share (waves and bosses), without the log. */
  pearls: number;
  won: number;
  log: GoalSpec[];
  /** The sea sailed (sim/seas.ts), and whether the wave beat that sea's best before it. */
  sea: number;
  record: boolean;
  /** A daily voyage (meta/daily.ts): `record` is then the day's best. */
  daily: boolean;
  /** The captain took the way home at the voyage's end (sim/waves.ts), with its pearls. */
  home: boolean;
  /** The codex's pearls for kinds first sunk, and the daily streak paid (meta/harbour.ts). */
  codex: number;
  streak: { n: number; pearls: number } | null;
}

export interface SessionOptions {
  seed: number;
  /** Game speed: 2 runs twice the ticks per second. */
  speed: number;
  /** A bot persona (bot.ts) that plays instead of the player, or null. */
  autoplay: string | null;
  /** The first game's seed, when it differs from `seed` (a new player's, guide/firstSeed.ts). */
  firstSeed?: number;
  /** Waves of slow tide each game opens with (sim/tide.ts) instead of the player's B.tide.waves
   *  (?ease, dev builds; 0 a bare game). */
  ease?: number;
  /** How long a tap comes after the picture it answers was drawn, ms (SEEN_MS; ?lag). Unset (the
   *  headless tests and bots): a tap casts along the aim as it is in the sim. */
  lagMs?: number;
}

/** How much further back than the drawn aim a tap looks, ms, for the time the screen takes to show
 *  a frame and report a finger. 0: the tap recorder (src/game/rec/) showed players tapping right
 *  on the aim as drawn, their eye's lead on a swinging line making up the screen's lag; at 50 ms
 *  casts went some 5 degrees behind it and half as many hit. What stays is the part of a tick
 *  the view draws behind the sim and the time the event waited (Session.lookBack). */
export const SEEN_MS = 0;

/** One tap in a game, for the dev tap recorder (recorder.ts). Angles in brads. */
export interface TapInfo {
  /** Whether it cast or threw (false: the hook was out, or not in a wave). */
  fired: boolean;
  ageMs: number;
  alpha: number;
  /** The aim as drawn on the last frame, the sim's before the tap, and the cast's. */
  shown: number;
  sim: number;
  cast: number;
  back: number;
  /** Which way the swing was going: 1 to +w, -1 to -w. */
  dir: number;
  threw: boolean;
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
  /** Each thrown shot's position before the last step. Shots have no id; the sim moves the same
   *  object every tick, so it is the key. A shot thrown this tick has none. */
  readonly prevShots = new WeakMap<Shot, Was>();
  /** Hears every tap in a game (the dev tap recorder), or null. */
  tapWatch: ((t: TapInfo) => void) | null = null;
  /** How many games have started. */
  games = 0;
  private readonly fixed = new FixedStep();
  private pilot: Pilot | null = null;
  private shopWait = 0;
  private events: SimEvent[] = [];
  private overMs = 0;
  /** Waiting on the captain's choice at the voyage's end (atVoyageEnd). */
  private finish = false;
  /** The last game's wave, the pearls it brought home (the captain's log's included) and the log
   *  entries it met, for the game over and the harbour. */
  last: LastGame = { wave: 0, pearls: 0, won: 0, log: [], sea: 0, record: false, daily: false, home: false, codex: 0, streak: null };
  /** An ad is on screen (game/ads.ts): nothing runs and taps do nothing, with no pause cover. */
  hold = false;
  /** Whether a fallen dock may be revived (a rewarded ad is there to watch); set by game/ads.ts. */
  canRevive: () => boolean = () => false;
  /** The dock fell and the revive is on offer: the game's pearls are not counted yet. */
  pending = false;
  /** This game's one revive, pearl doubling and free reroll, once used. */
  revived = false;
  doubled = false;
  freeRerolled = false;
  /** The day of the daily voyage being sailed (meta/daily.ts), or null for a plain voyage. */
  daily: string | null = null;

  /** The tutorial and the harbour; null for the bot and in tests that do not ask for them. */
  constructor(
    readonly opts: SessionOptions,
    readonly guide: Guide | null = null,
    readonly harbour: Harbour | null = null,
  ) {
    this.world = this.newWorld();
  }

  /** A player's game opens on a slow tide (sim/tide.ts). The bot and the tests have no guide and
   *  play bare games, unless ?ease says otherwise. */
  private ease(): number {
    return this.opts.ease ?? (this.guide ? B.tide.waves : 0);
  }

  /** The next game's world: the first on the first seed, then a new seed each time; with the
   *  harbour's upgrades as they are now. */
  private newWorld(): World {
    if (this.daily) return startGame(daySeed(this.daily), B.daily.ease, {}, dailySea(this.daily));
    const seed = this.games === 0 ? (this.opts.firstSeed ?? this.opts.seed) : this.opts.seed + this.games;
    return startGame(seed, this.ease(), this.harbour?.levels ?? {}, this.harbour?.sea ?? 0);
  }

  /** How far into the next tick to draw, 0 to 1. */
  get alpha(): number {
    return this.mode === 'play' && !this.paused ? this.fixed.alpha : 1;
  }

  /** A new game (built again, so upgrades bought since the title count). */
  start(): void {
    this.world = this.newWorld();
    this.games++;
    this.mode = 'play';
    this.paused = false;
    this.pilot = this.opts.autoplay ? new Pilot(this.world.seed, this.opts.autoplay) : null;
    this.shopWait = 0;
    this.pending = this.revived = this.doubled = this.freeRerolled = this.finish = false;
    this.guide?.begin(!this.daily);
    this.guide?.update(this.world, true, 0);
    this.snapshot();
    this.collect();
  }

  /** Runs the ticks `frameMs` of real time is worth; returns how many ran. */
  update(frameMs: number): number {
    const n = this.run(frameMs);
    this.guide?.update(this.world, this.mode === 'play' && !this.paused, frameMs);
    return n;
  }

  private run(frameMs: number): number {
    if (this.mode === 'over') this.overMs += frameMs;
    if (this.mode !== 'play' || this.paused || this.hold) return 0;
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
      // collect, not take: the step's events stay in w.events until the next step clears them,
      // so taking them without clearing handed every one on twice (sounds, telemetry, the guide)
      this.collect();
      if (w.phase === 'over') {
        this.mode = 'over';
        this.overMs = 0;
        this.pending = !this.revived && !this.pilot && !!this.harbour && this.canRevive();
        if (!this.pending) this.settle();
        break;
      }
    }
    return n;
  }

  /** Counts the game that just ended: its pearls, the captain's log, the sea's best. `home`: the
   *  captain sailed home at the voyage's end, which brings its own pearls. */
  private settle(home = false): void {
    const w = this.world;
    const pearls = pearlsFor(w) + (home ? BF.voyage.home : 0);
    this.harbour?.earn(pearls);
    const id = seaOf(w).id;
    const was = this.harbour?.best[id] ?? 0;
    const c: Record<string, number> = { ...counts(w) };
    // a daily voyage sails a sea that may not be owned: it counts for the log but not the sea's best
    if (this.daily) delete c[id];
    const log = this.harbour?.logGame(c) ?? [];
    const record = this.daily ? !!this.harbour?.logDaily(this.daily, w.wave) : was > 0 && w.wave > was;
    const codex = this.harbour?.lastCodex ?? 0;
    const streak = this.daily && this.harbour ? this.harbour.sailDaily(this.daily) : null;
    const extra = log.reduce((s, g) => s + g.pearls, 0) + codex + (streak?.pearls ?? 0);
    this.last = { wave: w.wave, pearls: pearls + extra, won: pearls, log, sea: w.sea, record, daily: !!this.daily, home, codex, streak };
  }

  /** The voyage's last wave is cleared: the captain chooses home (the game ends, with pearls) or
   *  sails on (the shop opens as after any wave). */
  atVoyageEnd(): boolean {
    return this.finish && this.mode === 'play';
  }

  /** Home at the voyage's end: the game is over and counted, nothing lost. */
  home(): boolean {
    if (!this.atVoyageEnd()) return false;
    this.finish = false;
    this.mode = 'over';
    this.overMs = 0;
    this.pending = false;
    this.settle(true);
    return true;
  }

  /** Sails on past the voyage's end: the shop opens and the sea keeps climbing. */
  sailOn(): boolean {
    if (!this.atVoyageEnd()) return false;
    this.finish = false;
    return true;
  }

  /** Turns down the revive: the game ends and is counted. */
  giveUp(): boolean {
    if (this.mode !== 'over' || !this.pending) return false;
    this.pending = false;
    this.overMs = 0;
    this.settle();
    return true;
  }

  /** The revive's ad paid: the dock is patched and the wave goes on (sim/revive.ts). */
  revive(): boolean {
    if (this.mode !== 'over' || !this.pending || !revive(this.world)) return false;
    this.pending = false;
    this.revived = true;
    this.mode = 'play';
    this.paused = false;
    this.snapshot();
    this.collect();
    return true;
  }

  /** The pearl doubling's ad paid: the game's own pearls come home twice. The captain's log's
   *  are left alone: doubled, they halved the content for a player who watches every game
   *  (docs/04-content.md section 4). */
  double(): boolean {
    if (this.mode !== 'over' || this.pending || this.doubled || !this.harbour) return false;
    this.doubled = true;
    this.harbour.earn(this.last.won);
    this.last = { ...this.last, pearls: this.last.pearls + this.last.won, won: this.last.won * 2 };
    return true;
  }

  /** The free reroll's ad paid: fresh cards at no cost, once a game. */
  freeReroll(): boolean {
    if (this.freeRerolled || !this.shopping() || !reroll(this.world, true)) return false;
    this.freeRerolled = true;
    return true;
  }

  /** The events since the last drain, for the view and audio. */
  drain(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** A tap on the lane or Space: start, resume, or cast; after a game over, on to the harbour.
   *  In the harbour only its buttons do anything. `ageMs`: how long the input waited before it got
   *  here (the event's own time stamp). */
  tap(ageMs = 0): void {
    if (this.mode === 'lobby' || this.hold) return;
    if (this.mode === 'over' && (this.pending || this.overMs < OVER_LOCK_MS)) return;
    if (this.mode === 'over' && this.harbour) this.openLobby();
    else if (this.mode !== 'play') this.start();
    else if (this.paused) this.paused = false;
    else if (!this.pilot) {
      const h = this.world.hook;
      const before = { ang: h.ang, prev: this.prevHook.ang, alpha: this.alpha, threw: !!this.world.held };
      const back = this.lookBack(ageMs);
      const fired = fire(this.world, back);
      if (fired) {
        this.guide?.tap();
        // the rope starts on the cast's own angle, not swept from last tick's
        this.prevHook = { ...this.prevHook, ang: h.ang };
      }
      this.tapWatch?.({
        fired,
        ageMs,
        alpha: before.alpha,
        shown: before.prev + (before.ang - before.prev) * before.alpha,
        sim: before.ang,
        cast: !fired ? before.ang : before.threw ? shotAng(this.world) : h.ang,
        back,
        dir: Math.sign(before.ang - before.prev) || 1,
        threw: fired && before.threw,
      });
      this.collect();
    }
  }

  /** The swing between the aim the player saw and the sim's, brads of phase: the part of a tick the
   *  view drew behind the sim (it draws `alpha` of the way from the last tick), plus the lag. */
  private lookBack(ageMs: number): number {
    const lag = this.opts.lagMs;
    if (lag === undefined) return 0;
    const ticks = 1 - this.alpha + ((lag + ageMs) * TICK_RATE * this.opts.speed) / 1000;
    // at the swing's rate now: it slows while a throw would hit (sim/hook.ts)
    return Math.round(ticks * this.world.hook.rate);
  }

  /** To the harbour between games (also on boot for a returning player). */
  openLobby(): void {
    if (!this.harbour || this.mode === 'play') return;
    this.mode = 'lobby';
  }

  /** Leaves the harbour for a new game; false when not in it. */
  sail(): boolean {
    if (this.mode !== 'lobby') return false;
    this.daily = null;
    this.start();
    return true;
  }

  /** Leaves the harbour for `day`'s daily voyage (meta/daily.ts); false when not in it. */
  sailDaily(day: string): boolean {
    if (this.mode !== 'lobby') return false;
    this.daily = day;
    this.start();
    return true;
  }

  /** Buys a level of a harbour upgrade; false when not in the harbour, too dear or maxed. */
  buyMeta(id: string): boolean {
    return this.mode === 'lobby' && !!this.harbour?.buy(id);
  }

  /** Buys sea `i`'s chart (sim/seas.ts); false when not in the harbour, too dear or not on sale. */
  buyChart(i: number): boolean {
    return this.mode === 'lobby' && !!this.harbour?.buyChart(i);
  }

  /** Picks sea `i` for the next game; false when not in the harbour or not owned. */
  pickSea(i: number): boolean {
    return this.mode === 'lobby' && !!this.harbour?.pick(i);
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
    return this.mode === 'play' && !this.paused && !this.hold && !this.pilot && !this.finish && this.world.phase === 'shop';
  }

  /** Takes the events a command raised outside a step (a cast, a throw, the wave starting), which
   *  the next step would otherwise clear unseen. */
  private collect(): void {
    this.take(this.world.events);
    this.world.events = [];
  }

  private take(events: SimEvent[]): void {
    this.events.push(...events);
    // the bots and a game without a harbour (no pearls to take home) sail straight on
    if (!this.pilot && this.harbour && events.some((e) => e.e === 'voyage')) this.finish = true;
    this.guide?.observe(events, this.world);
  }

  private snapshot(): void {
    const w = this.world;
    this.prev.clear();
    for (const m of w.mons) this.prev.set(m.id, { d: m.d, w: m.w });
    for (const it of w.items) this.prev.set(it.id, { d: it.d, w: it.w });
    for (const g of w.hook.grabs) if (g.t === 'item') this.prev.set(g.item.id, { d: g.item.d, w: g.item.w });
    this.prevHook = { ang: w.hook.ang, len: w.hook.len };
    for (const sh of w.shots) this.prevShots.set(sh, { d: sh.d, w: sh.w });
  }
}

/** The newest thrown junk's heading, brads. */
function shotAng(w: World): number {
  const sh = w.shots[w.shots.length - 1];
  return Math.round((Math.atan2(sh.uw, sh.ud) / (2 * Math.PI)) * BRAD_FULL);
}
