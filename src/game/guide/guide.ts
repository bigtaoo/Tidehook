// The tutorial (docs/02-onboarding.md): it watches the game and says what to try next, one cue at
// a time, and never plays for the player. A cue is a step, its line of words, what it points at
// and what the aim line should glow on. The first two steps hold a plain voyage's lane
// (World.calm) so waiting can never lose; the rest only point. Done steps are saved and never
// come back. No Pixi: the
// view draws the cue (view/hud/pointer.ts), the Session feeds the events and taps.

import type { TextKey } from '../../i18n';
import type { KeyValueStore } from '../../platform/types';
import type { SimEvent } from '../../sim/events';
import { FP } from '../../sim/math/fixed';
import { BRAD_FULL } from '../../sim/math/trig';
import { throwFirst } from '../../sim/lead';
import { rayFirst } from '../../sim/ray';
import { B } from '../../sim/balance';
import { liftable } from '../../sim/monsters';
import type { Calm, Monster, World } from '../../sim/world';
import { loadGuide, saveGuide } from './store';
import { shopPick, type ShopPick } from './shopPick';

export type StepId = 'cast' | 'crab' | 'throw' | 'junk' | 'shop';
export const STEP_IDS: readonly StepId[] = ['cast', 'crab', 'throw', 'junk', 'shop'];
/** The one-time game over lesson's id in the save. */
const LOST = 'lost';
/** Saved once the first shop is left, so the shop's teach line does not come back after a reload. */
const SHOP_SEEN = 'shopSeen';
/** Saved once a card has been bought, ever: until then the shop keeps tagging its Top pick
 *  (tagOn), the way the harbour keeps pointing while nothing has been bought (meta/tip.ts). */
const BOUGHT = 'bought';
/** Saved when the player skips the tutorial: they asked to be left alone, so no nudge either. */
const SKIPPED = 'skipped';

/** What the aim line glows on. */
export type Want = 'fish' | 'mon' | 'junk';

export type CueTarget = { t: 'item'; id: number } | { t: 'mon'; id: number } | { t: 'shop'; pick: ShopPick };

export interface Cue {
  /** A step, or 'nudge': no step, the idle reminder of what the game is about (NUDGE_MS). */
  step: StepId | 'nudge';
  /** The line of words over the lane, or null (the shop points without words). */
  text: TextKey | null;
  target: CueTarget | null;
  /** Whether the hand shows now (it waits, see FIRST_MS and REST_MS). */
  hand: boolean;
  want: Want | null;
}

export interface StepLog {
  step: string;
  /** The game it was done in, counted as Guide.games counts. */
  game: number;
  /** Seconds into that game when the step first showed and when it was done (-1: skipped). */
  shownS: number;
  doneS: number;
  /** The cast step only: how the first catch came about (see CastFreeze). */
  freeze?: CastFreeze;
}

/** How a game's first catch came about. 'tap': tapped while the freeze held the lane on a fish;
 *  'released': the freeze came, but the hold let it go first; 'none': caught before any freeze
 *  came; 'off': a game the freeze never comes to (the daily voyage, a bot at the helm), kept apart
 *  so it does not read as a player who knew to tap. */
export type CastFreeze = 'tap' | 'released' | 'none' | 'off';

/** A step's hand shows this long after the step begins, ms: as soon as it can be acted on. */
export const FIRST_MS = 600;
/** After the player's own tap the hand rests this long, ms, so it never chases them. */
export const REST_MS = 2000;
/** Skip asks twice: the second press must come within this, ms. */
export const SKIP_MS = 3000;
/** A hold lets go after its step has shown this long, ms (Swarm Orbit's lesson: a hold that never
 *  ends is a wall); the step's cue stays up. */
export const HOLD_MS = 30_000;
/** The shop's hand shows on this many visits; the Top pick tag for this many games. */
const SHOP_VISITS = 3;
const TAG_GAMES = 3;
/** Players watched on 2026-11-21 often stood still once the steps were done, not knowing what to
 *  do next. In their first NUDGE_GAMES games, a wave whose hook swings NUDGE_MS without a cast
 *  while a monster it could lift walks in points at the nearest such one, with the goal in words.
 *  Not a step: nothing is saved, a tap puts it away, and a player who skipped the tutorial never
 *  sees it. */
export const NUDGE_MS = 5000;
const NUDGE_GAMES = 5;
/** "Fish eaten" past which the game over lesson is about fish. */
const EATEN_LESSON = 3;

export class Guide {
  readonly done: Set<string>;
  games: number;
  cue: Cue | null = null;
  /** The first cast's freeze: the aim has found a fish, and the lane stands still on it until the
   *  player taps (Session.run), so the very first tap of a first game is sure to catch. Only while
   *  the cast step holds the lane (calm), so a player who just watches is let go after HOLD_MS. */
  freeze = false;
  /** The first game over's one lesson, while that card is up. */
  lesson: TextKey | null = null;
  readonly log: StepLog[] = [];
  /** Play time in this game, ms: the step clock, which starts over with every game. */
  private playMs = 0;
  private realMs = 0;
  /** Whether this game's lane may be held for a step (see begin()). */
  private holds = true;
  private current: StepId | null = null;
  private stepMs = 0;
  private restMs = 0;
  private tapped = false;
  /** Live wave time since the last tap, ms (the nudge). */
  private idleMs = 0;
  /** Whether this game's lane may freeze on the first cast (see begin()). */
  private freezes = true;
  /** This game's first catch so far, as the cast step's log will carry it. */
  private castFreeze: CastFreeze = 'none';
  private skipAt = -Infinity;
  /** Shops left while the shop step waited, this save's running total (see store.ts). */
  private visits: number;
  private bruteLeaks = 0;
  /** Levels owned at this game’s first frame, -1 before it: the shop is the only thing that grows them. */
  private lv0 = -1;
  private readonly shownAt = new Map<string, number>();

  constructor(private readonly store: KeyValueStore | null) {
    const save = loadGuide(store);
    this.done = new Set(save.done);
    this.games = save.games;
    this.visits = save.shops;
  }

  /** A new player: the first game starts at once, on the first seed. */
  get fresh(): boolean {
    return !this.done.has('cast');
  }

  get finished(): boolean {
    return STEP_IDS.every((s) => this.done.has(s));
  }

  /** The shop marks its Top pick card in the first few games, and goes on marking it for a player
   *  who has never bought a card at all: three games of tag are nothing to someone who has not
   *  understood yet what the shop is for, and they are the ones the seas stay shut for
   *  (docs/04-content.md section 5). The harbour points the same way (meta/tip.ts). */
  get tagOn(): boolean {
    return this.games <= TAG_GAMES || !this.done.has(BOUGHT);
  }

  /** The first shop of a new player: its title says what the shop is for (fish, coins, cards). */
  get shopTeach(): boolean {
    return !this.done.has('shop') && !this.done.has(SHOP_SEEN);
  }

  /** Whether `id` was spent by once(). */
  has(id: string): boolean {
    return this.done.has(id);
  }

  /** A shop left: marks the teach line seen on this save (the first), counts the visit and says
   *  when the hand is done. The count is saved like the rest, so closing the tab between waves
   *  does not hand the player the hand again from the top. */
  private leftShop(): boolean {
    this.visits++;
    this.done.add(SHOP_SEEN);
    this.save();
    return this.visits >= SHOP_VISITS;
  }

  /** True the first time `id` is asked about on this save, never after: a one-time hint (the
   *  first sea event's explanation). */
  once(id: string): boolean {
    if (this.done.has(id)) return false;
    this.done.add(id);
    this.save();
    return true;
  }

  /** The first skip press is waiting for the second. */
  get skipArmed(): boolean {
    return this.realMs - this.skipAt <= SKIP_MS;
  }

  /** A game started. `hold` says whether its lane may be held for a step: never the daily
   *  voyage's, which is the same world for everyone on the board. `freezes` says whether it may
   *  freeze on the first cast: never under a bot (Session's autoplay), which no freeze waits for.
   *
   *  The step clock starts over, so a player who fumbled one game meets the same gentle start in
   *  the next, instead of that turning on whether they happened to reload the page. */
  begin(hold = true, freezes = true): void {
    this.games++;
    this.bruteLeaks = 0;
    this.lv0 = -1;
    this.lesson = null;
    this.holds = hold;
    this.playMs = 0;
    this.idleMs = 0;
    this.current = null;
    this.freeze = false;
    this.settle(hold, freezes);
    this.shownAt.clear();
    this.save();
  }

  /** A sitting that opens inside a game already in progress (game/meta/resume.ts). begin() ran in
   *  an earlier sitting, so what it settled for this game - above all whether its lane may be held
   *  - is gone, and a daily voyage picked up from storage would otherwise be held like any other:
   *  the same world for everyone on the board, made easier for the one who reloaded. The step
   *  clock starts over as it does for any game, so a player coming back to a first game still
   *  meets the gentle start. */
  resume(hold: boolean, freezes = true): void {
    this.settle(hold, freezes);
  }

  private settle(hold: boolean, freezes: boolean): void {
    this.holds = hold;
    this.freezes = freezes;
    this.castFreeze = hold && freezes ? 'none' : 'off';
  }

  /** The player tapped the lane (a cast or a throw): the hand rests a while. */
  tap(): void {
    this.tapped = true;
    this.restMs = 0;
    this.idleMs = 0;
    if (this.freeze) this.castFreeze = 'tap';
    this.freeze = false;
  }

  /** Skip: the first press arms, a second within SKIP_MS skips every step. True when skipped. */
  skip(): boolean {
    if (!this.skipArmed) {
      this.skipAt = this.realMs;
      return false;
    }
    for (const s of STEP_IDS) if (!this.done.has(s)) this.log.push({ step: s, game: this.games, shownS: this.secs(this.shownAt.get(s)), doneS: -1 });
    for (const s of STEP_IDS) this.done.add(s);
    this.done.add(SKIPPED);
    this.cue = null;
    this.freeze = false;
    this.current = null;
    this.save();
    return true;
  }

  /** What happened in the world: steps are done by doing them, whenever that is. */
  observe(events: readonly SimEvent[], w: World): void {
    for (const ev of events) {
      if (ev.e === 'coins' && !ev.spat) this.finish('cast');
      else if (ev.e === 'kill') this.finish('crab');
      else if (ev.e === 'held') this.finish('junk');
      else if (ev.e === 'throw') {
        this.finish('throw');
        this.finish('junk');
      }
      else if (ev.e === 'leak' && ev.kind === 'brute') this.bruteLeaks++;
      else if (ev.e === 'waveStart' && ev.wave > 1 && !this.done.has('shop') && this.leftShop()) this.finish('shop');
      // the one lesson is the first game over's. A revive (game/ads.ts) can end that same game
      // twice, so it says what lost it in the end, not what the fall before the ad looked like.
      else if (ev.e === 'over' && (this.lesson !== null || !this.done.has(LOST))) {
        this.lesson = this.lessonFor(w);
        this.done.add(LOST);
        this.save();
      }
    }
  }

  /** Once a frame, after the ticks: holds the lane for the steps that need it and picks the cue. */
  update(w: World, playing: boolean, frameMs: number): void {
    this.realMs += frameMs;
    w.calm = this.calm();
    // a card bought, this game or any: only the shop grows the levels owned, so a rise says a
    // card was taken and the Top pick’s tag has done its work (tagOn)
    const owned = Object.values(w.lv).reduce((a, b) => a + b, 0);
    if (this.lv0 < 0) this.lv0 = owned;
    else if (owned > this.lv0 && !this.done.has(BOUGHT)) {
      this.done.add(BOUGHT);
      this.save();
    }
    if (!playing) return;
    this.playMs += frameMs;
    const step = this.pick(w);
    if (step !== this.current) {
      this.current = step;
      this.stepMs = 0;
      this.tapped = false;
      if (step && !this.shownAt.has(step)) this.shownAt.set(step, this.playMs);
    }
    this.stepMs += frameMs;
    this.restMs += frameMs;
    // idle only while the hook swings waiting for a cast: a long reel or a held catch is play
    this.idleMs = w.phase === 'wave' && w.hook.st === 'swing' ? this.idleMs + frameMs : 0;
    this.cue = step ? this.cueFor(step, w) : this.nudge(w);
    this.freeze = this.freezes && step === 'cast' && this.calm() === 1 && this.stepMs >= FIRST_MS && aimFinds(w, 'fish');
    if (this.freeze && this.castFreeze === 'none') this.castFreeze = 'released';
  }

  /** The hold for the steps still to do: no monsters before the first catch, then one at a time;
   *  none in a game that may not hold, and none once that step has waited HOLD_MS of this game. */
  calm(): Calm {
    if (!this.holds) return 0;
    const held = (s: StepId) => this.playMs - (this.shownAt.get(s) ?? this.playMs) < HOLD_MS;
    if (!this.done.has('cast')) return held('cast') ? 1 : 0;
    if (!this.done.has('crab')) return held('crab') ? 2 : 0;
    return 0;
  }

  private pick(w: World): StepId | null {
    if (w.phase === 'shop') return this.done.has('shop') ? null : 'shop';
    if (w.phase !== 'wave') return null;
    if (w.held && !this.done.has('throw')) return 'throw';
    if (!this.done.has('cast')) return 'cast';
    if (!this.done.has('crab')) return 'crab';
    if (!this.done.has('throw') && !this.done.has('junk') && !w.held && w.mons.some((m) => m.kind === 'brute')) return 'junk';
    return null;
  }

  private cueFor(step: StepId, w: World): Cue | null {
    if (step === 'shop') return { step, text: null, target: { t: 'shop', pick: shopPick(w) }, hand: this.stepMs >= FIRST_MS, want: null };
    const swinging = w.hook.st === 'swing';
    const wait = this.tapped ? REST_MS : FIRST_MS;
    const hand = swinging && this.stepMs >= FIRST_MS && this.restMs >= wait;
    if (step === 'cast') {
      // on the line already (the freeze stops it there): that catch, not the nearest in the swing
      const id = aimedFish(w) || nearestInSwing(w, 'fish');
      return { step, text: 'guide.cast', target: id ? { t: 'item', id } : null, hand: hand && !!id, want: 'fish' };
    }
    if (step === 'junk') {
      const id = nearestInSwing(w, 'junk');
      return { step, text: 'guide.junk', target: id ? { t: 'item', id } : null, hand: hand && !!id, want: 'junk' };
    }
    const m = nearestMonster(w);
    if (step === 'crab' && !m) return null;
    return {
      step,
      text: step === 'crab' ? 'guide.crab' : 'guide.throw',
      target: m ? { t: 'mon', id: m } : null,
      hand: hand && !!m,
      want: m ? 'mon' : null,
    };
  }

  /** The idle reminder (NUDGE_MS), or null. */
  private nudge(w: World): Cue | null {
    if (this.games > NUDGE_GAMES || this.done.has(SKIPPED) || !this.done.has('crab') || w.phase !== 'wave' || this.idleMs < NUDGE_MS) return null;
    // only one the hook can lift: pointing a new player at a boss or a shelled one teaches a miss
    const m = nearestMonster(w, (mon) => liftable(w, mon));
    if (!m) return null;
    return { step: 'nudge', text: 'guide.nudge', target: { t: 'mon', id: m }, hand: w.hook.st === 'swing', want: 'mon' };
  }

  private finish(step: StepId): void {
    if (this.done.has(step)) return;
    this.done.add(step);
    const log: StepLog = { step, game: this.games, shownS: this.secs(this.shownAt.get(step)), doneS: this.secs(this.playMs) };
    if (step === 'cast') log.freeze = this.castFreeze;
    this.log.push(log);
    this.save();
  }

  private lessonFor(w: World): TextKey {
    if (this.bruteLeaks > 0 && w.st.throws === 0) return 'guide.lesson.junk';
    if (Object.keys(w.lv).length === 0) return 'guide.lesson.cards';
    if (w.st.eaten >= EATEN_LESSON) return 'guide.lesson.fish';
    return 'guide.lesson.near';
  }

  private secs(ms: number | undefined): number {
    return ms === undefined ? -1 : Math.round(ms / 100) / 10;
  }

  private save(): void {
    saveGuide(this.store, { done: [...this.done], games: this.games, shops: this.visits });
  }
}

/** Whether a cast (or throw) along the aim now would find what the cue wants: tested the way it
 *  really hits (the hook's tip, or the thrown junk leading a walking monster), so the gold line
 *  never promises a catch the hook would miss. */
export function aimFinds(w: World, want: Want | null): boolean {
  if (!want || w.hook.st !== 'swing' || w.phase !== 'wave') return false;
  if (w.held) return want === 'mon' && throwFirst(w, w.hook.ang) !== null;
  const r = rayFirst(w, w.hook.ang, want === 'mon', B.hook.tip);
  if (!r) return false;
  if (want === 'mon') return r.o.t === 'mon';
  return r.o.t === 'item' && r.o.item.kind === want;
}

/** The fish a cast along the aim now would catch, by id, or 0. */
function aimedFish(w: World): number {
  if (!aimFinds(w, 'fish')) return 0;
  const r = rayFirst(w, w.hook.ang, false, B.hook.tip);
  return r?.o.t === 'item' ? r.o.item.id : 0;
}

/** The closest item of `kind` the hook's swing can reach, by id, or 0. */
function nearestInSwing(w: World, kind: 'fish' | 'junk'): number {
  const reach = (w.up.swing / BRAD_FULL) * Math.PI * 2;
  let best = 0;
  let bd = Infinity;
  for (const it of w.items) {
    if (it.kind !== kind) continue;
    const dd = (it.d - B.crane.d) / FP;
    const dw = (it.w - B.crane.w) / FP;
    const ang = Math.atan2(dw, dd);
    const dist = Math.hypot(dd, dw);
    if (Math.abs(ang) > reach || dist >= bd) continue;
    bd = dist;
    best = it.id;
  }
  return best;
}

/** The monster closest to the dock, by id, or 0. */
function nearestMonster(w: World, ok: (m: Monster) => boolean = () => true): number {
  let best = 0;
  let bd = Infinity;
  for (const m of w.mons) {
    if (m.grab || !ok(m)) continue;
    const dist = Math.hypot(m.d - B.crane.d, m.w - B.crane.w);
    if (dist < bd) {
      bd = dist;
      best = m.id;
    }
  }
  return best;
}
