// The harbour's cabin tab: the player's settings (settingsPanel.ts) on top, the language picker
// among them (langPick.ts) - a player who never pauses a game would otherwise never meet one -
// then the paint for the
// rope and the hook (game/meta/paint.ts), a pearl sink with no say in how the hook fishes. Each paint
// is a tile with its colour, its name and a button: its price while not owned, Wear once it is, and
// Worn on the one in use. Portrait gives each kind two rows of three, landscape a row of six.

import { Container, Graphics } from 'pixi.js';
import type { Harbour } from '../../game/meta/harbour';
import { PAINTS, type PaintKind, type PaintSpec } from '../../game/meta/paint';
import type { SettingId, Settings } from '../../game/settings';
import { t, type Locale, type TextKey } from '../../i18n';
import { artSprite, aspect } from '../art';
import { Button } from '../kit/button';
import { P, SEA } from '../kit/palette';
import { plate, tile as tilePlate } from '../kit/panel';
import { rowSize, type RowItem } from '../kit/row';
import { fitIn, label } from '../kit/text';
import { RADIUS, STROKE, TYPE } from '../kit/tokens';
import type { Rect } from './frame';
import { drawLangList, langItem, langPlate, type LangSlot } from './langPick';
import { drawToggles } from './settingsPanel';

export interface CabinActions {
  /** Buys paint `id` when it is not owned, wears it when it is. */
  paint(id: string): void;
  toggle(id: SettingId): void;
  /** Picks a language, absent where there is nothing to pick with (a test). */
  lang?(l: Locale): void;
  denied?(): void;
}

/** The settings the cabin shows, null without (a test). */
export interface CabinSettings {
  s: Settings;
  ids: readonly SettingId[];
}

const GAP = 16;
const TOGGLE_H = 84;
const HEAD = 50;
const KIND_H = 44;
/** A tile's own padding, design units. */
const PAD = 10;

/** The button's height on a tile `ht` tall; the row and the tile both need it. */
function btnHeight(ht: number): number {
  return Math.min(72, ht * 0.3);
}

/** `lang`: the picker's state and the layer its open list goes on, null in a test. */
export function drawCabin(h: Harbour, set: CabinSettings | null, r: Rect, k: number, wide: boolean, act: CabinActions, lang: LangSlot | null = null): Container {
  const box = new Container();
  let y = r.y;
  const setCols = wide ? (set?.ids.length ?? 4) : 2;
  if (set && set.ids.length) {
    const rows = Math.ceil(set.ids.length / setCols);
    const th = TOGGLE_H * rows + GAP * (rows - 1);
    box.addChild(drawToggles(set.s, set.ids, { x: r.x, y, w: r.w, h: th }, k, setCols, act.toggle));
    y += th + GAP;
  }
  // the picker wears a toggle's plate and a toggle's share of the row: one more setting, rather
  // than a bar across the cabin
  if (act.lang && lang) {
    const pick = lang.pick;
    const w = (r.w - GAP * (setCols - 1)) / setCols;
    const press = () => pick.toggle();
    const p = langPlate(w, TOGGLE_H, rowSize([langItem(w, TOGGLE_H, press)], TYPE.lead * k), pick.open, press);
    p.position.set(r.x, y);
    box.addChild(p);
    if (pick.open) lang.top.addChild(drawLangList({ x: r.x, y, w, h: TOGGLE_H }, r, k, pick));
    y += TOGGLE_H + GAP;
  }
  const head = label(t('paint.head'), TYPE.lead * k, { fill: P.brassLight, weight: '700' });
  fitIn(head, r.w, HEAD);
  head.anchor.set(0.5);
  head.position.set(r.x + r.w / 2, y + HEAD / 2);
  box.addChild(head);
  y += HEAD;
  const cols = wide ? 6 : 3;
  const kinds: PaintKind[] = ['rope', 'hook'];
  const rowsPer = Math.ceil(PAINTS.filter((p) => p.kind === 'rope').length / cols);
  const tileH = (r.y + r.h - y - kinds.length * KIND_H - GAP * (kinds.length * rowsPer - 1)) / (kinds.length * rowsPer);
  const tileW = (r.w - GAP * (cols - 1)) / cols;
  for (const kind of kinds) {
    const name = label(t(`paint.${kind}`), TYPE.body * k, { fill: P.cream, weight: '700' });
    fitIn(name, r.w, KIND_H * 0.9);
    name.anchor.set(0, 0.5);
    name.position.set(r.x, y + KIND_H / 2);
    box.addChild(name);
    y += KIND_H;
    // the row decides one size for all its buttons, so Worn, Wear and a price do not come out at
    // three sizes side by side (kit/row.ts)
    const paints = PAINTS.filter((p) => p.kind === kind);
    const btnH = btnHeight(tileH);
    const opts = paints.map((p) => paintButton(h, p, tileW - PAD * 2, btnH, act));
    const size = rowSize(opts, TYPE.body * k);
    paints.forEach((p, i) => {
      const tile = drawTile(h, p, tileW, tileH, k, new Button({ ...opts[i], size }));
      tile.position.set(r.x + (i % cols) * (tileW + GAP), y + Math.floor(i / cols) * (tileH + GAP));
      box.addChild(tile);
    });
    y += rowsPer * (tileH + GAP);
  }
  return box;
}

/** What a paint's button does: its price while not owned, Wear once it is, and Worn, in brass and
 *  unpressable, on the one in use - the same brass as the tile's edge, so the pair say "this one"
 *  together (kit/button.ts keeps a colour a caller gives a disabled plate). */
function paintButton(h: Harbour, p: PaintSpec, w: number, ht: number, act: CabinActions): RowItem {
  const worn = h.wear[p.kind] === p.id;
  const owned = h.hasPaint(p.id);
  const price = h.paintPrice;
  if (worn) return { w, h: ht, text: t('paint.worn'), color: P.brass, enabled: false, onPress: () => {} };
  if (owned) return { w, h: ht, text: t('paint.wear'), color: P.secondary, onPress: () => act.paint(p.id) };
  return { w, h: ht, text: '', price, pearl: true, enabled: h.pearls >= price, onPress: () => act.paint(p.id), onDenied: () => act.denied?.() };
}

/** One paint: its colour (a length of rope, or the hook sprite tinted), its name and its button. */
function drawTile(h: Harbour, p: PaintSpec, w: number, ht: number, k: number, b: Button): Container {
  const box = new Container();
  const worn = h.wear[p.kind] === p.id;
  box.addChild(tilePlate({ x: 0, y: 0, w, h: ht }, worn ? P.paper : P.paperDark, worn));
  const pad = PAD;
  const btnH = btnHeight(ht);
  const nameH = ht * 0.2;
  const picH = ht - btnH - nameH - pad * 3;
  const cx = w / 2;
  const picY = pad + picH / 2;
  // a patch of the sea the paint is seen on in the game: a white hook on cream paper did not show
  box.addChild(plate({ x: pad, y: pad, w: w - pad * 2, h: picH }, { fill: SEA.mid, radius: RADIUS.pane, width: STROKE.glyph }));
  // the hook lies on its side: it is tall and thin, and the patch of water is wide and low
  const hook = p.kind === 'hook' ? artSprite('hook', Math.min(w - pad * 4, (picH * 0.85) / aspect('hook')), 0.5, 0.5) : null;
  if (hook) {
    hook.rotation = -Math.PI / 2;
    hook.tint = p.color;
    hook.position.set(cx, picY);
    box.addChild(hook);
  } else {
    // a sagging length of rope, outlined so the tarred one shows on the water
    const len = Math.min(w - pad * 4, picH * 2.2);
    const thick = Math.max(8, picH * 0.16);
    // two paths: pixi draws a second stroke on one path as nothing
    const g = new Graphics();
    for (const [color, width] of [[P.cream, thick + 5], [p.color, thick]] as const) {
      g.moveTo(cx - len / 2, picY - picH * 0.1)
        .quadraticCurveTo(cx, picY + picH * 0.4, cx + len / 2, picY - picH * 0.1)
        .stroke({ color, width, cap: 'round' });
    }
    box.addChild(g);
  }
  const name = label(t(`paint.names.${p.id}` as TextKey), TYPE.small * k, { fill: P.ink, stroke: false, weight: '700' });
  fitIn(name, w - pad * 2, nameH);
  name.anchor.set(0.5);
  name.position.set(cx, pad + picH + pad / 2 + nameH / 2);
  box.addChild(name);
  b.position.set(pad, ht - btnH - pad);
  box.addChild(b);
  return box;
}
