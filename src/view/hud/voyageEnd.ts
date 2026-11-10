// The voyage's end (game/session.ts): the last wave of the voyage is cleared, and the captain
// chooses home, with its pearls, or to sail on. The card is the Overlay's, which takes no taps, so
// the two buttons live here, over it, in the slot it leaves for them (like hud/overAds.ts).

import { Container } from 'pixi.js';
import { t } from '../../i18n';
import { Button } from '../kit/button';
import { P } from '../kit/palette';
import type { Frame } from './frame';
import { slotButtonW, type Slot } from './overAds';

/** What the buttons do. */
export interface VoyageActions {
  home(): void;
  sailOn(): void;
}

const BTN_W = 420;
const BTN_H = 120;
const GAP = 32;

export class VoyageEnd extends Container {
  private key = '';

  constructor(
    private readonly fr: Frame,
    private readonly act: VoyageActions,
  ) {
    super();
  }

  /** `bonus`: the pearls home brings on top; `slot`: where the card left room, null for none. */
  update(bonus: number, slot: Slot | null): void {
    const key = slot ? `${bonus}|${slot.x}|${slot.y}|${slot.w}` : '';
    if (key === this.key) return;
    this.key = key;
    for (const c of this.removeChildren()) c.destroy({ children: true });
    if (!slot) return;
    const k = this.fr.boost;
    const w = slotButtonW(slot, BTN_W * k, GAP);
    const h = BTN_H * k;
    const buttons = [
      new Button({ w, h, text: t('voyage.goHome', { n: bonus }), size: 40 * k, color: P.go, onPress: () => this.act.home() }),
      new Button({ w, h, text: t('voyage.sailOn'), size: 40 * k, onPress: () => this.act.sailOn() }),
    ];
    const total = buttons.length * w + (buttons.length - 1) * GAP;
    buttons.forEach((b, i) => {
      b.position.set(slot.x - total / 2 + i * (w + GAP), slot.y - h / 2);
      this.addChild(b);
    });
  }
}
