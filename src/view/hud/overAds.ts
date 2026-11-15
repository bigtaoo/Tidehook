// The rewarded ads' buttons on the game over card (game/ads.ts): revive the dock or give up while
// the revive is on offer, then double the game's pearls. The card itself is the Overlay, which
// takes no taps, so the buttons live here, over it, in the slot it leaves for them (hud/slotRow.ts,
// which also sizes the row: the revive carries a play mark, so its words get less room than "give
// up" beside it and the two would otherwise come out at two sizes).

import { Container } from 'pixi.js';
import type { Offer } from '../../game/ads';
import { t } from '../../i18n';
import { P } from '../kit/palette';
import type { Frame } from './frame';
import { slotRow, type Slot } from './slotRow';

/** What the buttons do. */
export interface AdActions {
  revive(): void;
  giveUp(): void;
  double(): void;
}

export class OverAds extends Container {
  private key = '';

  constructor(
    private readonly fr: Frame,
    private readonly act: AdActions,
  ) {
    super();
  }

  update(offer: Offer, slot: Slot | null): void {
    const key = offer && slot ? `${offer}|${slot.x}|${slot.y}|${slot.w}` : '';
    if (key === this.key) return;
    this.key = key;
    for (const c of this.removeChildren()) c.destroy({ children: true });
    if (!offer || !slot) return;
    const items =
      offer === 'revive'
        ? [
            { text: t('ads.revive'), color: P.go, icon: 'play' as const, onPress: () => this.act.revive() },
            { text: t('ads.giveUp'), color: P.secondary, onPress: () => this.act.giveUp() },
          ]
        : [{ text: t('ads.double'), color: P.go, icon: 'play' as const, onPress: () => this.act.double() }];
    this.addChild(...slotRow(items, slot, this.fr.boost));
  }
}
