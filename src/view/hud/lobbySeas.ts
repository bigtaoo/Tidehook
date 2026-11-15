// The harbour's seas tab (docs/04-content.md section 3.5): a card for each sea, with its rules, the
// best wave reached there, and a button to buy its chart, to pick it for the next voyage, or the
// wave the sea before it must be reached to first. The card itself is the kit's (kit/card.ts).

import { Container } from 'pixi.js';
import type { Harbour } from '../../game/meta/harbour';
import { t, type TextKey } from '../../i18n';
import { B } from '../../sim/balance';
import { card } from '../kit/card';
import { P } from '../kit/palette';
import { STROKE } from '../kit/tokens';
import type { Rect } from './frame';

export interface SeaActions {
  chart(i: number): void;
  pick(i: number): void;
  denied?(): void;
}

const GAP = 20;

/** A sea's name. */
export function seaName(i: number): string {
  return t(`seas.${B.seas[i].id}.name` as TextKey);
}

/** The seas in `r`, side by side. */
export function drawSeas(h: Harbour, r: Rect, k: number, wide: boolean, act: SeaActions): Container {
  const box = new Container();
  const n = B.seas.length;
  const cw = (r.w - GAP * (n - 1)) / n;
  B.seas.forEach((_, i) => {
    const c = seaCard(h, i, cw, r.h, k, wide, act);
    c.position.set(r.x + i * (cw + GAP), r.y);
    box.addChild(c);
  });
  return box;
}

function seaCard(h: Harbour, i: number, cw: number, ch: number, k: number, wide: boolean, act: SeaActions): Container {
  const s = B.seas[i];
  const own = h.owns(i);
  const here = h.sea === i;
  const price = h.chartPrice(i);
  const locked = !own && price === null;
  const best = h.best[s.id] ?? 0;
  return card({
    w: cw,
    h: ch,
    wide,
    k,
    fill: own ? P.paper : P.paperDark,
    // the sea the captain sails next: a brass edge, and a heavier one, so it is not colour alone
    line: here ? P.brass : P.line,
    width: here ? STROKE.mark : STROKE.card,
    name: seaName(i),
    sub: best > 0 ? t('lobby.best', { n: best }) : t('lobby.unsailed'),
    desc: t(`seas.${s.id}.desc` as TextKey),
    // the condition sits above the price, in words big enough to read
    note: locked ? t('lobby.needs', { n: s.needs, sea: seaName(i - 1) }) : undefined,
    action: here
      ? { text: t('lobby.here'), color: P.brass, enabled: false, onPress: () => {} }
      : own
        ? { text: t('lobby.pick'), color: P.secondary, onPress: () => act.pick(i) }
        : { text: '', price: price ?? s.price, pearl: true, enabled: !locked && h.pearls >= (price ?? 0), onPress: () => act.chart(i), onDenied: () => act.denied?.() },
  });
}
