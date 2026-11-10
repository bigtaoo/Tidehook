// The harbour's log tab (docs/04-content.md section 3.4): the captain's log entries still open,
// the next one of each kind, nearest to done first, each with its progress and the pearls it pays.

import { Container, Graphics } from 'pixi.js';
import type { Harbour } from '../../game/meta/harbour';
import { t, type TextKey } from '../../i18n';
import { B, type GoalSpec } from '../../sim/balance';
import { goalValue } from '../../sim/goals';
import { drawPearl } from '../kit/button';
import { P } from '../kit/palette';
import { fitIn, label } from '../kit/text';
import type { Rect } from './frame';

const GAP = 14;
const HEAD = 54;
/** A row's least height; fewer rows show when the panel is short. */
const MIN_ROW = 76;
const MAX_ROW = 120;

/** What an entry asks, in words. */
export function goalText(g: GoalSpec): string {
  return t(`goals.${g.kind}.${g.stat}` as TextKey, { n: g.n });
}

/** The entries to show: the first open one of each kind and stat, nearest to done first. */
export function openGoals(h: Harbour): GoalSpec[] {
  const seen = new Set<string>();
  const out: GoalSpec[] = [];
  for (const g of B.goals) {
    const chain = `${g.kind}.${g.stat}`;
    if (h.done.includes(g.id) || seen.has(chain)) continue;
    seen.add(chain);
    out.push(g);
  }
  const part = (g: GoalSpec) => Math.min(1, goalValue(g, h.best, h.totals) / g.n);
  return out.sort((a, b) => part(b) - part(a) || a.pearls - b.pearls);
}

/** The log in `r`: a count of entries written, then a row per open entry that fits. */
export function drawLog(h: Harbour, r: Rect, k: number): Container {
  const box = new Container();
  const done = h.done.length;
  const all = done >= B.goals.length;
  const head = label(all ? t('lobby.logAll') : t('lobby.logDone', { n: done, max: B.goals.length }), 34 * k, { fill: P.brassLight, weight: '700' });
  fitIn(head, r.w, HEAD);
  head.anchor.set(0.5);
  head.position.set(r.x + r.w / 2, r.y + HEAD / 2);
  box.addChild(head);
  const goals = openGoals(h);
  const top = r.y + HEAD + GAP;
  const room = r.h - HEAD - GAP;
  const n = Math.min(goals.length, Math.floor((room + GAP) / (MIN_ROW + GAP)));
  if (n === 0) return box;
  const rowH = Math.min(MAX_ROW, (room + GAP) / n - GAP);
  goals.slice(0, n).forEach((g, i) => box.addChild(row(h, g, r.x, top + i * (rowH + GAP), r.w, rowH, k)));
  return box;
}

/** One open entry: what it asks, a bar of how far along it is, and its pearls. */
function row(h: Harbour, g: GoalSpec, x: number, y: number, w: number, rh: number, k: number): Container {
  const box = new Container();
  const pad = 14;
  const payW = Math.min(150, w * 0.22);
  const paper = new Graphics();
  paper.roundRect(x, y, w, rh, 18).fill(P.paper).stroke({ color: P.line, width: 4 });
  const textW = w - payW - pad * 3;
  const said = label(goalText(g), 30 * k, { fill: P.ink, stroke: false, align: 'left' });
  fitIn(said, textW, rh * 0.5);
  said.anchor.set(0, 0.5);
  said.position.set(x + pad, y + rh * 0.34);
  const have = Math.min(g.n, goalValue(g, h.best, h.totals));
  const barY = y + rh * 0.68;
  const barH = Math.max(10, rh * 0.14);
  const barW = textW * 0.7;
  const bar = new Graphics();
  bar.roundRect(x + pad, barY, barW, barH, barH / 2).fill(P.paperDark).stroke({ color: P.line, width: 2 });
  if (have > 0) bar.roundRect(x + pad, barY, Math.max(barH, (barW * have) / g.n), barH, barH / 2).fill(P.brass);
  const count = label(`${have}/${g.n}`, 24 * k, { fill: P.brassDark, stroke: false, weight: '700' });
  fitIn(count, textW - barW - pad, barH * 2.4);
  count.anchor.set(0, 0.5);
  count.position.set(x + pad * 2 + barW, barY + barH / 2);
  const pay = label(String(g.pearls), 36 * k, { fill: P.ink, stroke: false });
  fitIn(pay, payW * 0.55, rh * 0.6);
  pay.anchor.set(1, 0.5);
  pay.position.set(x + w - pad, y + rh / 2);
  const pr = Math.min(16 * k, rh * 0.16);
  const pearl = new Graphics();
  drawPearl(pearl, pay.x - pay.width - pr * 1.5, y + rh / 2, pr);
  box.addChild(paper, bar, said, count, pay, pearl);
  return box;
}
