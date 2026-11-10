// The rewarded ads' buttons on the game over card (game/ads.ts): revive the dock or give up while
// the revive is on offer, then double the game's pearls. The card itself is the Overlay, which
// takes no taps, so the buttons live here, over it, in the slot it leaves for them.

import { Container } from 'pixi.js';
import type { Offer } from '../../game/ads';
import { t } from '../../i18n';
import { Button } from '../kit/button';
import { P } from '../kit/palette';
import type { Frame } from './frame';

/** What the buttons do. */
export interface AdActions {
  revive(): void;
  giveUp(): void;
  double(): void;
}

/** The slot the card leaves: its centre, design units. */
export interface Slot {
  x: number;
  y: number;
}

const BTN_W = 420;
const BTN_H = 120;
const GAP = 32;

export class OverAds extends Container {
  private key = '';

  constructor(
    private readonly fr: Frame,
    private readonly act: AdActions,
  ) {
    super();
  }

  update(offer: Offer, slot: Slot | null): void {
    const key = offer && slot ? `${offer}|${slot.x}|${slot.y}` : '';
    if (key === this.key) return;
    this.key = key;
    for (const c of this.removeChildren()) c.destroy({ children: true });
    if (!offer || !slot) return;
    const k = this.fr.boost;
    const w = Math.min(BTN_W * k, (this.fr.fit.w - 3 * GAP) / 2);
    const h = BTN_H * k;
    const buttons =
      offer === 'revive'
        ? [
            new Button({ w, h, text: t('ads.revive'), size: 44 * k, color: P.go, icon: 'play', onPress: () => this.act.revive() }),
            new Button({ w, h, text: t('ads.giveUp'), size: 44 * k, onPress: () => this.act.giveUp() }),
          ]
        : [new Button({ w, h, text: t('ads.double'), size: 44 * k, color: P.go, icon: 'play', onPress: () => this.act.double() })];
    const total = buttons.length * w + (buttons.length - 1) * GAP;
    buttons.forEach((b, i) => {
      b.position.set(slot.x - total / 2 + i * (w + GAP), slot.y - h / 2);
      this.addChild(b);
    });
  }
}
