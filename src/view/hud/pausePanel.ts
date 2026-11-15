// The pause cover's panel (game/session.ts): the player's settings as toggles, and under them the
// way to put in early — end the voyage here and bring the catch home instead of losing it. The
// Overlay's card takes no taps, so this lives over it, in the slot the card leaves for it (like
// hud/overAds.ts). The button carries the pearls it would bank, so the choice is an honest one.

import { Container } from 'pixi.js';
import type { SettingId, Settings } from '../../game/settings';
import { t } from '../../i18n';
import { Button } from '../kit/button';
import { P } from '../kit/palette';
import { slotButtonW, type Slot } from './overAds';
import { drawToggles } from './settingsPanel';

const GAP = 24;
const BTN_W = 380;
const BTN_H = 96;
/** Setting toggles to a row; hud/overlay.ts PAUSE_ROWS leaves the slot room for them and the button. */
const COLS = 2;

/** What the panel's button does. */
export interface PauseActions {
  putIn(): void;
}

export class PausePanel extends Container {
  private key = '';

  constructor(
    private readonly boost: number,
    private readonly settings: Settings | null,
    private readonly ids: readonly SettingId[],
    private readonly onToggle: (id: SettingId) => void,
    private readonly act: PauseActions | null = null,
  ) {
    super();
  }

  /** `slot`: where the cover left room, null while the cover is down. `pearls`: what putting in
   *  here would bring home; `canPutIn`: whether to offer it at all (never in the first game, where
   *  the tutorial is still talking). */
  update(slot: Slot | null, pearls = 0, canPutIn = false): void {
    const s = this.settings;
    const put = canPutIn && !!this.act;
    const key = slot ? `${s?.key ?? ''}|${slot.x}|${slot.y}|${slot.w}|${slot.h}|${put ? pearls : -1}` : '';
    if (key === this.key) return;
    this.key = key;
    for (const c of this.removeChildren()) c.destroy({ children: true });
    if (!slot) return;
    const k = this.boost;
    const rows = s ? Math.ceil(this.ids.length / COLS) : 0;
    const bh = BTN_H * k;
    const togglesH = rows ? rows * bh + (rows - 1) * GAP : 0;
    const total = togglesH + (put ? bh + (rows ? GAP : 0) : 0);
    let y = slot.y - total / 2;
    if (s && rows) {
      const w = Math.min(slot.w, BTN_W * k * COLS + GAP);
      this.addChild(drawToggles(s, this.ids, { x: slot.x - w / 2, y, w, h: togglesH }, k, COLS, this.onToggle));
      y += togglesH + GAP;
    }
    if (put) {
      const w = slotButtonW(slot, BTN_W * k, GAP);
      const b = new Button({ w, h: bh, text: t('overlay.putIn'), size: 34 * k, price: pearls, pearl: true, color: P.woodLight, onPress: () => this.act?.putIn() });
      b.position.set(slot.x - w / 2, y);
      this.addChild(b);
    }
  }
}
