// The remove-ads card at the end of the harbour's upgrades (game/noAds.ts): drawn like an upgrade
// card, with the host's own price on its button instead of pearls, and a thank-you once bought.
// Shown only where the host sells it.

import { Container, Graphics } from 'pixi.js';
import type { NoAdsState } from '../../game/noAds';
import { t } from '../../i18n';
import { Button } from '../kit/button';
import { P } from '../kit/palette';
import { fitIn, fitWrap, label } from '../kit/text';

/** What the card shows. */
export interface NoAdsView {
  state: NoAdsState;
  price: string;
  busy: boolean;
}

export const NO_SALE: NoAdsView = { state: 'none', price: '', busy: false };

export function drawNoAds(v: NoAdsView, cw: number, ch: number, k: number, wide: boolean, buy: () => void): Container {
  const box = new Container();
  const owned = v.state === 'owned';
  const paper = new Graphics();
  paper.roundRect(0, 0, cw, ch, 24).fill(owned ? P.paperDark : P.paper).stroke({ color: P.brass, width: 6 });
  box.addChild(paper);
  const pad = 16;
  const inner = cw - pad * 2;
  const btnH = Math.min(100, ch * (wide ? 0.18 : 0.22));
  const nameH = ch * (wide ? 0.23 : 0.2);
  const name = label(t('lobby.noAds.name'), 40 * k, { fill: P.ink, stroke: false, wrap: inner });
  fitWrap(name, inner, nameH);
  name.anchor.set(0.5);
  name.position.set(cw / 2, pad + nameH / 2);
  const lvH = ch * 0.12;
  const lv = label(t('lobby.noAds.lv'), 28 * k, { fill: P.brassDark, stroke: false });
  fitIn(lv, inner, lvH);
  lv.anchor.set(0.5);
  lv.position.set(cw / 2, pad + nameH + lvH * 0.6);
  const descTop = pad + nameH + lvH + ch * 0.03;
  const desc = label(t('lobby.noAds.desc'), 28 * k, { fill: P.ink, stroke: false, weight: '600', wrap: inner });
  fitWrap(desc, inner, ch - descTop - btnH - pad * 1.5);
  desc.anchor.set(0.5, 0);
  desc.position.set(cw / 2, descTop);
  const b = owned
    ? new Button({ w: inner, h: btnH, text: t('lobby.noAds.owned'), size: 30 * k, enabled: false, onPress: () => {} })
    : new Button({ w: inner, h: btnH, text: v.price, size: 40 * k, color: P.go, enabled: !v.busy, onPress: buy });
  b.position.set(pad, ch - btnH - pad);
  box.addChild(name, lv, desc, b);
  return box;
}
