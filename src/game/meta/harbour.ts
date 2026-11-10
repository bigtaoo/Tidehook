// The harbour between games (docs/02-onboarding.md section 7): the pearls the player has, the
// upgrade levels bought with them, and the captain's log (sim/goals.ts: each stat's best game, the
// totals over every game, the goals done), the sea charts owned and the sea picked (sim/seas.ts), kept in the platform's storage. Bad or missing data reads as
// an empty harbour; a store that throws is the SafeStore's problem, not ours.

import type { KeyValueStore } from '../../platform/types';
import { B } from '../../sim/balance';
import type { GoalSpec } from '../../sim/balance';
import { addCounts, bestCounts, newlyMet, type Counts } from '../../sim/goals';
import { metaLevel, metaPrice, type MetaLevels } from '../../sim/meta';
import { chartOpen } from '../../sim/seas';

export const HARBOUR_KEY = 'tidehook.harbour';

interface HarbourSave {
  pearls: number;
  lv: Record<string, number>;
  best: Record<string, number>;
  totals: Record<string, number>;
  done: string[];
  charts: string[];
  sea: string;
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
    this.best = bestCounts(this.best, c);
    this.totals = addCounts(this.totals, c);
    const met = newlyMet(this.done, this.best, this.totals);
    this.done = [...this.done, ...met.map((g) => g.id)];
    this.pearls += met.reduce((s, g) => s + g.pearls, 0);
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
    this.save();
    return true;
  }

  earn(pearls: number): void {
    if (pearls <= 0) return;
    this.pearls += pearls;
    this.save();
  }

  private save(): void {
    const save: HarbourSave = { pearls: this.pearls, lv: this.lv, best: { ...this.best }, totals: { ...this.totals }, done: this.done, charts: this.charts, sea: B.seas[this.sea].id };
    this.store?.setItem(HARBOUR_KEY, JSON.stringify(save));
  }
}

function load(store: KeyValueStore | null): HarbourSave {
  const empty: HarbourSave = { pearls: 0, lv: {}, best: {}, totals: {}, done: [], charts: [], sea: 'bay' };
  const raw = store?.getItem(HARBOUR_KEY);
  if (!raw) return empty;
  try {
    const v = JSON.parse(raw) as Partial<HarbourSave>;
    const pearls = Number.isSafeInteger(v.pearls) && (v.pearls as number) > 0 ? (v.pearls as number) : 0;
    const lv = v.lv && typeof v.lv === 'object' ? (v.lv as Record<string, number>) : {};
    return { pearls, lv, best: numbers(v.best), totals: numbers(v.totals), done: strings(v.done), charts: strings(v.charts), sea: typeof v.sea === 'string' ? v.sea : 'bay' };
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

/** The strings in a saved list; anything else is dropped. */
function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((d): d is string => typeof d === 'string') : [];
}
