// The harbour between games (docs/02-onboarding.md section 7): the pearls the player has, the
// upgrade levels bought with them, and the captain's log (sim/goals.ts: each stat's best game, the
// totals over every game, the goals done), the sea charts owned and the sea picked (sim/seas.ts),
// the paint bought and worn (paint.ts) and the daily voyage's streak, kept in the platform's storage. Bad or missing data reads as
// an empty harbour; a store that throws is the SafeStore's problem, not ours.

import type { KeyValueStore } from '../../platform/types';
import { B } from '../../sim/balance';
import type { GoalSpec } from '../../sim/balance';
import { BF } from '../../sim/balanceFun';
import { addCounts, bestCounts, firstSunk, newlyMet, type Counts } from '../../sim/goals';
import { metaLevel, metaPrice, type MetaLevels } from '../../sim/meta';
import { chartOpen } from '../../sim/seas';
import { dayIndex } from './daily';
import { FREE_PAINT, freePaint, paintOf, paintPrice, type PaintKind } from './paint';

export const HARBOUR_KEY = 'tidehook.harbour';

interface HarbourSave {
  pearls: number;
  lv: Record<string, number>;
  best: Record<string, number>;
  totals: Record<string, number>;
  done: string[];
  charts: string[];
  sea: string;
  flat: number;
  daily: { day: string; best: number };
  paints: string[];
  wear: Record<PaintKind, string>;
  streak: Streak;
}

/** The daily voyage's days in a row: the last day sailed and how many before it without a gap. */
export interface Streak {
  day: string;
  n: number;
}

export class Harbour {
  pearls = 0;
  private lv: Record<string, number> = {};
  /** Each stat's best in one game, and its total over every game (sim/goals.ts). */
  best: Counts = {};
  totals: Counts = {};
  /** Log entries met, by id. */
  done: string[] = [];
  /** Sea charts bought, by sea id; the home bay needs none. */
  charts: string[] = [];
  /** The sea the next game sails, an index into B.seas. */
  sea = 0;
  /** Games in a row that made nothing better: no best wave on their sea, no log entry, and nothing
   *  bought since. The player most likely to give up (docs/04-content.md section 4); game/meta/tip.ts
   *  points them somewhere. */
  flat = 0;
  /** The best wave of the daily voyage (daily.ts) on `day`. */
  daily = { day: '', best: 0 };
  /** Paint bought (paint.ts), the free ones not among them, and the paint worn on each. */
  paints: string[] = [];
  wear: Record<PaintKind, string> = { ...FREE_PAINT };
  streak: Streak = { day: '', n: 0 };
  /** The pearls the codex paid in the last logGame: each kind first sunk. */
  lastCodex = 0;

  constructor(private readonly store: KeyValueStore | null) {
    const save = load(store);
    this.pearls = save.pearls;
    for (const u of B.meta.upgrades) {
      const n = metaLevel(save.lv, u.id);
      if (n > 0) this.lv[u.id] = n;
    }
    this.best = save.best;
    this.totals = save.totals;
    this.done = save.done;
    this.charts = save.charts.filter((id) => B.seas.some((s) => s.id === id));
    const sea = B.seas.findIndex((s) => s.id === save.sea);
    this.sea = sea > 0 && this.owns(sea) ? sea : 0;
    this.flat = save.flat;
    this.daily = save.daily;
    this.paints = save.paints.filter((id) => paintOf(id) && !freePaint(id));
    for (const kind of ['rope', 'hook'] as const) {
      const id = save.wear[kind];
      if (this.hasPaint(id) && paintOf(id)?.kind === kind) this.wear[kind] = id;
    }
    this.streak = save.streak;
  }

  /** Whether paint `id` is the captain's: bought, or free. */
  hasPaint(id: string): boolean {
    return freePaint(id) || this.paints.includes(id);
  }

  /** The pearls for the next paint. */
  get paintPrice(): number {
    return paintPrice(this.paints.length);
  }

  /** Buys paint `id` and wears it; false when it is owned, unknown or too dear. */
  buyPaint(id: string): boolean {
    const p = paintOf(id);
    if (!p || this.hasPaint(id) || this.paintPrice > this.pearls) return false;
    this.pearls -= this.paintPrice;
    this.paints = [...this.paints, id];
    this.wear = { ...this.wear, [p.kind]: id };
    this.save();
    return true;
  }

  /** Wears paint `id`; false when it is not the captain's. */
  wearPaint(id: string): boolean {
    const p = paintOf(id);
    if (!p || !this.hasPaint(id)) return false;
    this.wear = { ...this.wear, [p.kind]: id };
    this.save();
    return true;
  }

  /** A daily voyage sailed on `day`: on the day's first, the streak grows (or starts again after
   *  a day missed) and pays its pearls. Returns the streak and what it paid (0 after the first). */
  sailDaily(day: string): { n: number; pearls: number } {
    if (this.streak.day === day) return { n: this.streak.n, pearls: 0 };
    const next = dayIndex(day) - dayIndex(this.streak.day) === 1 ? this.streak.n + 1 : 1;
    this.streak = { day, n: next };
    const pearls = streakPearls(next);
    this.pearls += pearls;
    this.save();
    return { n: next, pearls };
  }

  /** The streak as of `day`: sailed today (`today`), or what sailing today would make it. */
  streakOn(day: string): { n: number; today: boolean; pearls: number } {
    if (this.streak.day === day) return { n: this.streak.n, today: true, pearls: 0 };
    const n = dayIndex(day) - dayIndex(this.streak.day) === 1 ? this.streak.n + 1 : 1;
    return { n, today: false, pearls: streakPearls(n) };
  }

  /** The best wave of `day`'s daily voyage, 0 when not sailed that day. */
  dailyBest(day: string): number {
    return this.daily.day === day ? this.daily.best : 0;
  }

  /** Takes in a daily voyage's wave; true when it is the day's best. */
  logDaily(day: string, wave: number): boolean {
    if (wave <= this.dailyBest(day)) return false;
    this.daily = { day, best: wave };
    this.flat = 0;
    this.save();
    return true;
  }

  /** Whether sea `i` can be sailed. */
  owns(i: number): boolean {
    return i === 0 || this.charts.includes(B.seas[i]?.id ?? '');
  }

  /** Pearls for sea `i`'s chart, or null when it is owned or not on sale yet (seas.ts). */
  chartPrice(i: number): number | null {
    const s = B.seas[i];
    if (!s || this.owns(i) || !chartOpen(i, this.best)) return null;
    return s.price;
  }

  /** Buys sea `i`'s chart and picks that sea; false when it cannot. */
  buyChart(i: number): boolean {
    const p = this.chartPrice(i);
    if (p === null || p > this.pearls) return false;
    this.pearls -= p;
    this.charts = [...this.charts, B.seas[i].id];
    this.sea = i;
    this.flat = 0;
    this.save();
    return true;
  }

  /** Picks sea `i` for the next game; false when it is not owned. */
  pick(i: number): boolean {
    if (!this.owns(i)) return false;
    this.sea = i;
    this.save();
    return true;
  }

  /** Takes in a finished game's counts: the log entries it meets are done and their pearls
   *  earned. Returns them. */
  logGame(c: Counts): GoalSpec[] {
    this.lastCodex = firstSunk(this.totals, c).length * BF.codex.pearls;
    this.pearls += this.lastCodex;
    const better = B.seas.some((s) => (c[s.id] ?? 0) > (this.best[s.id] ?? 0));
    this.best = bestCounts(this.best, c);
    this.totals = addCounts(this.totals, c);
    const met = newlyMet(this.done, this.best, this.totals);
    this.done = [...this.done, ...met.map((g) => g.id)];
    this.pearls += met.reduce((s, g) => s + g.pearls, 0);
    this.flat = better || met.length || this.lastCodex ? 0 : this.flat + 1;
    this.save();
    return met;
  }

  /** The levels owned, for a new game (sim/meta.ts). */
  get levels(): MetaLevels {
    return { ...this.lv };
  }

  level(id: string): number {
    return metaLevel(this.lv, id);
  }

  /** Pearls for the next level, or null at the max. */
  price(id: string): number | null {
    return metaPrice(this.lv, id);
  }

  /** Buys the next level of `id`; false when it is maxed or too dear. */
  buy(id: string): boolean {
    const p = this.price(id);
    if (p === null || p > this.pearls) return false;
    this.pearls -= p;
    this.lv[id] = this.level(id) + 1;
    this.flat = 0;
    this.save();
    return true;
  }

  earn(pearls: number): void {
    if (pearls <= 0) return;
    this.pearls += pearls;
    this.save();
  }

  private save(): void {
    const save: HarbourSave = { pearls: this.pearls, lv: this.lv, best: { ...this.best }, totals: { ...this.totals }, done: this.done, charts: this.charts, sea: B.seas[this.sea].id, flat: this.flat, daily: { ...this.daily }, paints: this.paints, wear: { ...this.wear }, streak: { ...this.streak } };
    this.store?.setItem(HARBOUR_KEY, JSON.stringify(save));
  }
}

function load(store: KeyValueStore | null): HarbourSave {
  const empty: HarbourSave = { pearls: 0, lv: {}, best: {}, totals: {}, done: [], charts: [], sea: 'bay', flat: 0, daily: { day: '', best: 0 }, paints: [], wear: { ...FREE_PAINT }, streak: { day: '', n: 0 } };
  const raw = store?.getItem(HARBOUR_KEY);
  if (!raw) return empty;
  try {
    const v = JSON.parse(raw) as Partial<HarbourSave>;
    const pearls = Number.isSafeInteger(v.pearls) && (v.pearls as number) > 0 ? (v.pearls as number) : 0;
    const lv = v.lv && typeof v.lv === 'object' ? (v.lv as Record<string, number>) : {};
    return { pearls, lv, best: numbers(v.best), totals: numbers(v.totals), done: strings(v.done), charts: strings(v.charts), sea: typeof v.sea === 'string' ? v.sea : 'bay', flat: Number.isSafeInteger(v.flat) && (v.flat as number) > 0 ? (v.flat as number) : 0, daily: dailyOf(v.daily), paints: strings(v.paints), wear: wearOf(v.wear), streak: streakOf(v.streak) };
  } catch {
    return empty;
  }
}

/** The safe whole numbers in a saved record; anything else is dropped. */
function numbers(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!v || typeof v !== 'object') return out;
  for (const [k, n] of Object.entries(v)) if (Number.isSafeInteger(n) && (n as number) >= 0) out[k] = n as number;
  return out;
}

/** A saved daily best, or none. */
function dailyOf(v: unknown): HarbourSave['daily'] {
  const d = v as Partial<HarbourSave['daily']> | null;
  const ok = !!d && typeof d.day === 'string' && Number.isSafeInteger(d.best) && (d.best as number) > 0;
  return ok ? { day: d.day as string, best: d.best as number } : { day: '', best: 0 };
}

/** The daily streak's pearls on its `n`th day. */
export function streakPearls(n: number): number {
  return BF.streak.per * Math.min(n, BF.streak.cap);
}

/** The saved paint worn; the free ones where it is missing (the constructor checks ownership). */
function wearOf(v: unknown): Record<PaintKind, string> {
  const w = (v ?? {}) as Partial<Record<PaintKind, unknown>>;
  return { rope: typeof w.rope === 'string' ? w.rope : FREE_PAINT.rope, hook: typeof w.hook === 'string' ? w.hook : FREE_PAINT.hook };
}

/** A saved streak, or none. */
function streakOf(v: unknown): Streak {
  const s = v as Partial<Streak> | null;
  const ok = !!s && typeof s.day === 'string' && Number.isSafeInteger(s.n) && (s.n as number) > 0;
  return ok ? { day: s.day as string, n: s.n as number } : { day: '', n: 0 };
}

/** The strings in a saved list; anything else is dropped. */
function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((d): d is string => typeof d === 'string') : [];
}
