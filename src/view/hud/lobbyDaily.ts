// The harbour's daily tab (game/meta/daily.ts): today's voyage, the same sea and tide for everyone,
// with the day's best and a button to sail it; beside it today's leaderboard where the host has one
// (game/board.ts). Portrait stacks the two, landscape puts them side by side.

import { Container, Graphics } from 'pixi.js';
import type { DailyRow } from '../../game/board';
import { dailySea } from '../../game/meta/daily';
import type { Harbour } from '../../game/meta/harbour';
import { t } from '../../i18n';
import { Button } from '../kit/button';
import { P } from '../kit/palette';
import { fitIn, fitWrap, label } from '../kit/text';
import type { Rect } from './frame';
import { seaName } from './lobbySeas';

export interface DailyActions {
  daily(): void;
}

/** What the tab shows: the day, and the board's rows (null: not read yet; absent: no board). */
export interface DailyView {
  day: string;
  rows?: DailyRow[] | null;
}

const GAP = 20;
const PAD = 16;

export function drawDaily(h: Harbour, v: DailyView, r: Rect, k: number, wide: boolean, act: DailyActions): Container {
  const box = new Container();
  const board = v.rows !== undefined;
  const cardR = !board ? r : wide ? { ...r, w: (r.w - GAP) * 0.55 } : { ...r, h: (r.h - GAP) * 0.55 };
  box.addChild(dayCard(h, v.day, cardR, k, act));
  if (board) {
    const listR = wide ? { x: r.x + cardR.w + GAP, y: r.y, w: r.w - cardR.w - GAP, h: r.h } : { x: r.x, y: r.y + cardR.h + GAP, w: r.w, h: r.h - cardR.h - GAP };
    box.addChild(list(v.rows ?? null, listR, k));
  }
  return box;
}

function paper(r: Rect, fill: number): Graphics {
  const g = new Graphics();
  g.roundRect(r.x, r.y, r.w, r.h, 24).fill(fill).stroke({ color: P.line, width: 5 });
  return g;
}

function dayCard(h: Harbour, day: string, r: Rect, k: number, act: DailyActions): Container {
  const box = new Container();
  box.addChild(paper(r, P.paper));
  const inner = r.w - PAD * 2;
  const cx = r.x + r.w / 2;
  const btnH = Math.min(100, r.h * 0.2);
  const rowH = r.h * 0.12;
  const title = label(t('daily.title'), 40 * k, { fill: P.ink, stroke: false });
  fitIn(title, inner, rowH);
  title.anchor.set(0.5);
  title.position.set(cx, r.y + PAD + rowH / 2);
  const sea = label(t('daily.sea', { sea: seaName(dailySea(day)) }), 32 * k, { fill: P.brassDark, stroke: false });
  fitIn(sea, inner, rowH * 0.8);
  sea.anchor.set(0.5);
  sea.position.set(cx, r.y + PAD + rowH * 1.5);
  const n = h.dailyBest(day);
  const best = label(n > 0 ? t('daily.best', { n }) : t('daily.none'), 30 * k, { fill: P.brassDark, stroke: false });
  fitIn(best, inner, rowH * 0.8);
  best.anchor.set(0.5);
  best.position.set(cx, r.y + PAD + rowH * 2.4);
  const descTop = r.y + PAD + rowH * 3;
  const desc = label(t('daily.rules'), 28 * k, { fill: P.ink, stroke: false, weight: '600', wrap: inner });
  fitWrap(desc, inner, r.y + r.h - btnH - PAD * 2 - descTop);
  desc.anchor.set(0.5, 0);
  desc.position.set(cx, descTop);
  const b = new Button({ w: inner, h: btnH, text: t('daily.sail'), size: 36 * k, color: P.go, onPress: () => act.daily() });
  b.position.set(r.x + PAD, r.y + r.h - btnH - PAD);
  box.addChild(title, sea, best, desc, b);
  return box;
}

function list(rows: DailyRow[] | null, r: Rect, k: number): Container {
  const box = new Container();
  box.addChild(paper(r, P.paperDark));
  const inner = r.w - PAD * 2;
  const headH = Math.min(70, r.h * 0.16);
  const head = label(t('daily.board'), 34 * k, { fill: P.ink, stroke: false });
  fitIn(head, inner, headH);
  head.anchor.set(0.5);
  head.position.set(r.x + r.w / 2, r.y + PAD + headH / 2);
  box.addChild(head);
  const top = r.y + PAD + headH;
  const left = r.y + r.h - PAD - top;
  if (!rows || rows.length === 0) {
    const say = label(rows ? t('daily.empty') : t('daily.loading'), 28 * k, { fill: P.brassDark, stroke: false, wrap: inner });
    fitWrap(say, inner, left);
    say.anchor.set(0.5, 0);
    say.position.set(r.x + r.w / 2, top + 8);
    box.addChild(say);
    return box;
  }
  const lineH = left / Math.max(5, rows.length);
  rows.forEach((row, i) => {
    const y = top + i * lineH + lineH / 2;
    const name = label(`${row.rank}. ${row.name || t('daily.anon')}`, 28 * k, { fill: P.ink, stroke: false, weight: '600' });
    fitIn(name, inner * 0.68, lineH * 0.9);
    name.anchor.set(0, 0.5);
    name.position.set(r.x + PAD, y);
    const wave = label(t('daily.wave', { n: row.wave }), 28 * k, { fill: P.brassDark, stroke: false });
    fitIn(wave, inner * 0.3, lineH * 0.9);
    wave.anchor.set(1, 0.5);
    wave.position.set(r.x + r.w - PAD, y);
    box.addChild(name, wave);
  });
  return box;
}
