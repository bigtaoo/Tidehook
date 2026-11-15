// The voyage's end (game/session.ts): the last wave of the voyage is cleared, and the captain
// chooses home, with its pearls, or to sail on. The card is the Overlay's, which takes no taps, so
// the two buttons live here, over it, in the slot it leaves for them (hud/slotRow.ts, shared with
// hud/overAds.ts: the same row in the same place should not be two sizes).

import { Container } from 'pixi.js';
import { t } from '../../i18n';
import { P } from '../kit/palette';
import type { Frame } from './frame';
import { slotRow, type Slot } from './slotRow';

/** What the buttons do. */
export interface VoyageActions {
  home(): void;
  sailOn(): void;
}

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
    const items = [
      { text: t('voyage.goHome', { n: bonus }), color: P.go, onPress: () => this.act.home() },
      { text: t('voyage.sailOn'), color: P.secondary, onPress: () => this.act.sailOn() },
    ];
    this.addChild(...slotRow(items, slot, this.fr.boost));
  }
}
