// The player's settings as buttons (game/settings.ts): music, sounds, vibration and calm motion, each
// a plate that reads "Music: on" and flips on a press. Drawn into a rect by drawToggles, used by the
// pause cover (PauseSettings, in the slot the Overlay leaves) and the harbour's cabin tab.

import { Container } from 'pixi.js';
import type { SettingId, Settings } from '../../game/settings';
import { t } from '../../i18n';
import { Button } from '../kit/button';
import { P } from '../kit/palette';
import type { Rect } from './frame';
import type { Slot } from './overAds';

const GAP = 24;

/** The settings a device shows: no vibration where it cannot buzz. */
export function shownSettings(ids: readonly SettingId[], canBuzz: boolean): SettingId[] {
  return ids.filter((id) => id !== 'buzz' || canBuzz);
}

/** One button per setting in `ids`, `cols` to a row, filling `r`. */
export function drawToggles(s: Settings, ids: readonly SettingId[], r: Rect, k: number, cols: number, onToggle: (id: SettingId) => void): Container {
  const box = new Container();
  const rows = Math.max(1, Math.ceil(ids.length / cols));
  const w = (r.w - GAP * (cols - 1)) / cols;
  const h = (r.h - GAP * (rows - 1)) / rows;
  ids.forEach((id, i) => {
    const on = s.get(id);
    const text = t('settings.line', { name: t(`settings.${id}`), state: t(on ? 'settings.on' : 'settings.off') });
    const b = new Button({ w, h, text, size: 38 * k, color: on ? P.brass : P.woodLight, onPress: () => onToggle(id) });
    b.position.set(r.x + (i % cols) * (w + GAP), r.y + Math.floor(i / cols) * (h + GAP));
    box.addChild(b);
  });
  return box;
}

const BTN_W = 380;
const BTN_H = 96;

/** The toggles on the pause cover, in its slot; rebuilt when a setting or the slot changes. */
export class PauseSettings extends Container {
  private key = '';

  constructor(
    private readonly boost: number,
    private readonly settings: Settings | null,
    private readonly ids: readonly SettingId[],
    private readonly onToggle: (id: SettingId) => void,
  ) {
    super();
  }

  update(slot: Slot | null): void {
    const s = this.settings;
    const key = s && slot ? `${s.key}|${slot.x}|${slot.y}|${slot.w}|${slot.h}` : '';
    if (key === this.key) return;
    this.key = key;
    for (const c of this.removeChildren()) c.destroy({ children: true });
    if (!s || !slot) return;
    const k = this.boost;
    const cols = 2;
    const rows = Math.ceil(this.ids.length / cols);
    const w = Math.min(slot.w, BTN_W * k * cols + GAP);
    const h = Math.min(slot.h, BTN_H * k * rows + GAP * (rows - 1));
    this.addChild(drawToggles(s, this.ids, { x: slot.x - w / 2, y: slot.y - h / 2, w, h }, k, cols, this.onToggle));
  }
}
