// The tutorial (docs/02-onboarding.md): it watches the game and says what to try next, one cue at
// a time, and never plays for the player. A cue is a step, its line of words, what it points at
// and what the aim line should glow on. The first two steps hold the lane (World.calm) so waiting
// can never lose; the rest only point. Done steps are saved and never come back. No Pixi: the
// view draws the cue (view/hud/pointer.ts), the Session feeds the events and taps.

import type { TextKey } from '../../i18n';
import type { KeyValueStore } from '../../platform/types';
import type { SimEvent } from '../../sim/events';
import { FP } from '../../sim/math/fixed';
import { BRAD_FULL } from '../../sim/math/trig';
import { rayFirst } from '../../sim/ray';
import { B } from '../../sim/balance';
import type { Calm, World } from '../../sim/world';
import { loadGuide, saveGuide } from './store';
import { shopPick, type ShopPick } from './shopPick';

export type StepId = 'cast' | 'crab' | 'throw' | 'junk' | 'shop';
export const STEP_IDS: readonly StepId[] = ['cast', 'crab', 'throw', 'junk', 'shop'];
/** The one-time game over lesson's id in the save. */
const LOST = 'lost';

/** What the aim line glows on. */
export type Want = 'fish' | 'mon' | 'junk';

export type CueTarget = { t: 'item'; id: number } | { t: 'mon'; id: number } | { t: 'shop'; pick: ShopPick };

export interface Cue {
  step: StepId;
  /** The line of words over the lane, or null (the shop points without words). */
  text: TextKey | null;
  target: CueTarget | null;
  /** Whether the hand shows now (it waits, see FIRST_MS and REST_MS). */
  hand: boolean;
  want: Want | null;
}

export interface StepLog {
  step: string;
  /** Seconds of play when the step first showed and when it was done (-1: skipped). */
  shownS: number;
  doneS: number;
}

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
/** "Fish eaten" past which the game over lesson is about fish. */
const EATEN_LESSON = 3;

export class Guide {
  readonly done: Set<string>;
  games: number;
  cue: Cue | null = null;
  /** The first game over's one lesson, while that card is up. */
  lesson: TextKey | null = null;
  readonly log: StepLog[] = [];
  private playMs = 0;
  private realMs = 0;
  private current: StepId | null = null;
  private stepMs = 0;
  private restMs = 0;
  private tapped = false;
  private skipAt = -Infinity;
  private visits = 0;
  private bruteLeaks = 0;
  private readonly shownAt = new Map<string, number>();

  constructor(private readonly store: KeyValueStore | null) {
    const save = loadGuide(store);
    this.done = new Set(save.done);
    this.games = save.games;
  }

  /** A new player: the first game starts at once, on the first seed. */
  get fresh(): boolean {
    return !this.done.has('cast');
  }

  get finished(): boolean {
    return STEP_IDS.every((s) => this.done.has(s));
  }

  /** The shop marks the Top pick card in the first few games. */
  get tagOn(): boolean {
    return this.games <= TAG_GAMES;
  }

  /** The first skip press is waiting for the second. */
  get skipArmed(): boolean {
    return this.realMs - this.skipAt <= SKIP_MS;
  }

  /** A game started. */
  begin(): void {
    this.games++;
    this.bruteLeaks = 0;
    this.lesson = null;
    this.save();
  }

  /** The player tapped the lane (a cast or a throw): the hand rests a while. */
  tap(): void {
    this.tapped = true;
    this.restMs = 0;
  }

  /** Skip: the first press arms, a second within SKIP_MS skips every step. True when skipped. */
  skip(): boolean {
    if (!this.skipArmed) {
      this.skipAt = this.realMs;
      return false;
    }
    for (const s of STEP_IDS) if (!this.done.has(s)) this.log.push({ step: s, shownS: this.secs(this.shownAt.get(s)), doneS: -1 });
    for (const s of STEP_IDS) this.done.add(s);
    this.cue = null;
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
      else if (ev.e === 'waveStart' && ev.wave > 1 && !this.done.has('shop') && ++this.visits >= SHOP_VISITS) this.finish('shop');
      else if (ev.e === 'over' && !this.done.has(LOST)) {
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
    this.cue = step ? this.cueFor(step, w) : null;
  }

  /** The hold for the steps still to do: no monsters before the first catch, then one at a time;
   *  none once that step has waited HOLD_MS. */
  calm(): Calm {
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
      const id = nearestInSwing(w, 'fish');
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

  private finish(step: StepId): void {
    if (this.done.has(step)) return;
    this.done.add(step);
    this.log.push({ step, shownS: this.secs(this.shownAt.get(step)), doneS: this.secs(this.playMs) });
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
    saveGuide(this.store, { done: [...this.done], games: this.games });
  }
}

/** Whether a cast (or throw) along the aim now would find what the cue wants: tested with the
 *  radius that really hits (the hook's tip, or the thrown junk's), so the gold line never promises
 *  a catch the hook would miss. */
export function aimFinds(w: World, want: Want | null): boolean {
  if (!want || w.hook.st !== 'swing' || w.phase !== 'wave') return false;
  const r = rayFirst(w, w.hook.ang, want === 'mon', w.held ? B.throw.radius : B.hook.tip);
  if (!r) return false;
  if (want === 'mon') return r.o.t === 'mon';
  return r.o.t === 'item' && r.o.item.kind === want;
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
function nearestMonster(w: World): number {
  let best = 0;
  let bd = Infinity;
  for (const m of w.mons) {
    if (m.grab) continue;
    const dist = Math.hypot(m.d - B.crane.d, m.w - B.crane.w);
    if (dist < bd) {
      bd = dist;
      best = m.id;
    }
  }
  return best;
}
