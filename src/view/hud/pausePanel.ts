// The pause cover's panel (game/session.ts): the player's settings as toggles, and under them the
// language picker (hud/langPick.ts) beside the way to put in early — end the voyage here and bring
// the catch home instead of losing it. The Overlay's card takes no taps, so this lives over it, in
// the slot the card leaves for it (like hud/overAds.ts). The button carries the pearls it would
// bank, so the choice is an honest one.

import { Container } from 'pixi.js';
import type { SettingId, Settings } from '../../game/settings';
import { t, type Locale } from '../../i18n';
import { Button } from '../kit/button';
import { P } from '../kit/palette';
import { rowSize, type RowItem } from '../kit/row';
import { TYPE } from '../kit/tokens';
import type { Frame } from './frame';
import { drawLangList, langItem, langPlate, type LangPick } from './langPick';
import { slotButtonW, type Slot } from './slotRow';
import { drawToggles } from './settingsPanel';

const GAP = 24;
const BTN_W = 380;
const BTN_H = 96;
/** Setting toggles to a row; hud/overlay.ts PAUSE_ROWS leaves the slot room for them and the row
 *  under them. */
const COLS = 2;

/** What the panel's button does. */
export interface PauseActions {
  putIn(): void;
}

export class PausePanel extends Container {
  private key = '';
  /** The language picker's state; public so a test can drop its list and measure it. */
  readonly lang: LangPick = {
    open: false,
    toggle: () => {
      this.lang.open = !this.lang.open;
    },
    pick: (l: Locale) => {
      this.lang.open = false;
      this.onLang?.(l);
    },
  };

  constructor(
    private readonly fr: Frame,
    private readonly settings: Settings | null,
    private readonly ids: readonly SettingId[],
    private readonly onToggle: (id: SettingId) => void,
    private readonly act: PauseActions | null = null,
    /** Picks a language, null where there is nothing to pick with (a test). */
    private readonly onLang: ((l: Locale) => void) | null = null,
  ) {
    super();
  }

  /** `slot`: where the cover left room, null while the cover is down. `pearls`: what putting in
   *  here would bring home; `canPutIn`: whether to offer it at all (never in the first game, where
   *  the tutorial is still talking). */
  update(slot: Slot | null, pearls = 0, canPutIn = false): void {
    const s = this.settings;
    const put = canPutIn && !!this.act;
    const key = slot ? `${s?.key ?? ''}|${slot.x}|${slot.y}|${slot.w}|${slot.h}|${put ? pearls : -1}|${this.lang.open}` : '';
    if (key === this.key) return;
    this.key = key;
    for (const c of this.removeChildren()) c.destroy({ children: true });
    if (!slot) {
      this.lang.open = false;
      return;
    }
    const k = this.fr.boost;
    const rows = s ? Math.ceil(this.ids.length / COLS) : 0;
    const bh = BTN_H * k;
    const bw = slotButtonW(slot, BTN_W * k, GAP);
    const togglesH = rows ? rows * bh + (rows - 1) * GAP : 0;
    // the picker and the button share the last row, each as wide as one cover button: the picker
    // costs the cover no row of its own, and the two plates read as a pair
    const toggleLang = () => this.lang.toggle();
    const row: RowItem[] = [];
    if (this.onLang) row.push(langItem(bw, bh, toggleLang));
    if (put) row.push({ w: bw, h: bh, text: t('overlay.putIn'), price: pearls, pearl: true, color: P.secondary, onPress: () => this.act?.putIn() });
    const rowH = row.length ? bh : 0;
    const total = togglesH + (rowH ? (rows ? GAP : 0) + rowH : 0);
    let y = slot.y - total / 2;
    if (s && rows) {
      const w = Math.min(slot.w, BTN_W * k * COLS + GAP);
      this.addChild(drawToggles(s, this.ids, { x: slot.x - w / 2, y, w, h: togglesH }, k, COLS, this.onToggle));
      y += togglesH + GAP;
    }
    if (!rowH) return;
    const size = rowSize(row, TYPE.lead * k);
    let x = slot.x - (row.length * bw + (row.length - 1) * GAP) / 2;
    let list: Container | null = null;
    if (this.onLang) {
      const p = langPlate(bw, bh, size, this.lang.open, toggleLang);
      p.position.set(x, y);
      this.addChild(p);
      if (this.lang.open) {
        const { fit } = this.fr;
        list = drawLangList({ x, y, w: bw, h: bh }, { x: 0, y: 0, w: fit.w, h: fit.h }, k, this.lang);
      }
      x += bw + GAP;
    }
    if (put) {
      const b = new Button({ ...row[row.length - 1], size });
      b.position.set(x, y);
      this.addChild(b);
    }
    // over the two plates: the list drops from the picker and hangs past the card
    if (list) this.addChild(list);
  }
}
