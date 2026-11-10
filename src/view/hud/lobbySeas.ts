// The harbour's seas tab (docs/04-content.md section 3.5): a card for each sea, with its rules, the
// best wave reached there, and a button to buy its chart, to pick it for the next voyage, or the
// wave the sea before it must be reached to first.

import { Container, Graphics } from 'pixi.js';
import type { Harbour } from '../../game/meta/harbour';
import { t, type TextKey } from '../../i18n';
import { B } from '../../sim/balance';
import { Button } from '../kit/button';
import { P } from '../kit/palette';
import { fitIn, label } from '../kit/text';
import type { Rect } from './frame';

export interface SeaActions {
  chart(i: number): void;
  pick(i: number): void;
  denied?(): void;
}

const GAP = 20;
const PAD = 16;

/** A sea's name. */
export function seaName(i: number): string {
  return t(`seas.${B.seas[i].id}.name` as TextKey);
}

/** The seas in `r`, side by side. */
export function drawSeas(h: Harbour, r: Rect, k: number, act: SeaActions): Container {
  const box = new Container();
  const n = B.seas.length;
  const cw = (r.w - GAP * (n - 1)) / n;
  B.seas.forEach((_, i) => {
    const c = card(h, i, cw, r.h, k, act);
    c.position.set(r.x + i * (cw + GAP), r.y);
    box.addChild(c);
  });
  return box;
}

function card(h: Harbour, i: number, cw: number, ch: number, k: number, act: SeaActions): Container {
  const s = B.seas[i];
  const box = new Container();
  const own = h.owns(i);
  const here = h.sea === i;
  const paper = new Graphics();
  paper.roundRect(0, 0, cw, ch, 24).fill(own ? P.paper : P.paperDark).stroke({ color: here ? P.brass : P.line, width: here ? 9 : 5 });
  box.addChild(paper);
  const inner = cw - PAD * 2;
  const btnH = Math.min(100, ch * 0.2);
  const nameH = ch * 0.16;
  const name = label(seaName(i), 40 * k, { fill: P.ink, stroke: false, wrap: inner });
  fitIn(name, inner, nameH);
  name.anchor.set(0.5);
  name.position.set(cw / 2, PAD + nameH / 2);
  const best = h.best[s.id] ?? 0;
  const rec = label(best > 0 ? t('lobby.best', { n: best }) : t('lobby.unsailed'), 28 * k, { fill: P.brassDark, stroke: false });
  fitIn(rec, inner, ch * 0.09);
  rec.anchor.set(0.5);
  rec.position.set(cw / 2, PAD + nameH + ch * 0.05);
  const descTop = PAD + nameH + ch * 0.11;
  const locked = !own && h.chartPrice(i) === null;
  const desc = label(t(`seas.${s.id}.desc` as TextKey), 28 * k, { fill: P.ink, stroke: false, weight: '600', wrap: inner });
  fitIn(desc, inner, ch - descTop - btnH - PAD * 2 - (locked ? ch * 0.15 : 0));
  desc.anchor.set(0.5, 0);
  desc.position.set(cw / 2, descTop);
  box.addChild(name, rec, desc);
  const price = h.chartPrice(i);
  const o = { w: inner, h: btnH, size: 32 * k };
  const b = here
    ? new Button({ ...o, text: t('lobby.here'), color: P.brass, enabled: false, onPress: () => {} })
    : own
      ? new Button({ ...o, text: t('lobby.pick'), color: P.wood, onPress: () => act.pick(i) })
      : new Button({ ...o, text: '', size: 42 * k, price: price ?? s.price, pearl: true, enabled: !locked && h.pearls >= (price ?? 0), onPress: () => act.chart(i), onDenied: () => act.denied?.() });
  if (locked) {
    // the condition sits above the price, in words big enough to read
    const needs = label(t('lobby.needs', { n: s.needs, sea: seaName(i - 1) }), 26 * k, { fill: P.red, stroke: false, wrap: inner });
    fitIn(needs, inner, ch * 0.14);
    needs.anchor.set(0.5, 1);
    needs.position.set(cw / 2, ch - btnH - PAD * 2);
    box.addChild(needs);
  }
  b.position.set(PAD, ch - btnH - PAD);
  box.addChild(b);
  return box;
}
