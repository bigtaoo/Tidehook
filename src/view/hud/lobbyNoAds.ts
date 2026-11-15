// The remove-ads card at the end of the harbour's upgrades (game/noAds.ts): the kit's card
// (kit/card.ts) like every other, with a brass edge to mark it as the one real purchase, the
// host's own price on its button instead of pearls, and a thank-you once bought. Shown only where
// the host sells it.

import type { Container } from 'pixi.js';
import type { NoAdsState } from '../../game/noAds';
import { t } from '../../i18n';
import { card } from '../kit/card';
import { P } from '../kit/palette';
import { STROKE } from '../kit/tokens';

/** What the card shows. */
export interface NoAdsView {
  state: NoAdsState;
  price: string;
  busy: boolean;
}

export const NO_SALE: NoAdsView = { state: 'none', price: '', busy: false };

export function drawNoAds(v: NoAdsView, cw: number, ch: number, k: number, wide: boolean, buy: () => void): Container {
  const owned = v.state === 'owned';
  return card({
    w: cw,
    h: ch,
    wide,
    k,
    fill: owned ? P.paperDark : P.paper,
    line: P.brass,
    width: STROKE.panel,
    name: t('lobby.noAds.name'),
    sub: t('lobby.noAds.lv'),
    desc: t('lobby.noAds.desc'),
    action: owned ? { text: t('lobby.noAds.owned'), enabled: false, onPress: () => {} } : { text: v.price, color: P.go, enabled: !v.busy, onPress: buy },
  });
}
