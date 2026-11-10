// The harbour's cabin tab: the player's settings (settingsPanel.ts) on top, then the paint for the
// rope and the hook (game/meta/paint.ts), a pearl sink with no say in how the hook fishes. Each paint
// is a tile with its colour, its name and a button: its price while not owned, Wear once it is, and
// Worn on the one in use. Portrait gives each kind two rows of three, landscape a row of six.

import { Container, Graphics } from 'pixi.js';
import type { Harbour } from '../../game/meta/harbour';
import { PAINTS, type PaintKind, type PaintSpec } from '../../game/meta/paint';
import type { SettingId, Settings } from '../../game/settings';
import { t, type TextKey } from '../../i18n';
import { artSprite, aspect } from '../art';
import { Button } from '../kit/button';
import { P, SEA } from '../kit/palette';
import { fitIn, label } from '../kit/text';
import type { Rect } from './frame';
import { drawToggles } from './settingsPanel';

export interface CabinActions {
  /** Buys paint `id` when it is not owned, wears it when it is. */
  paint(id: string): void;
  toggle(id: SettingId): void;
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

export function drawCabin(h: Harbour, set: CabinSettings | null, r: Rect, k: number, wide: boolean, act: CabinActions): Container {
  const box = new Container();
  let y = r.y;
  if (set && set.ids.length) {
    const cols = wide ? set.ids.length : 2;
    const rows = Math.ceil(set.ids.length / cols);
    const th = TOGGLE_H * rows + GAP * (rows - 1);
    box.addChild(drawToggles(set.s, set.ids, { x: r.x, y, w: r.w, h: th }, k, cols, act.toggle));
    y += th + GAP;
  }
  const head = label(t('paint.head'), 32 * k, { fill: P.brassLight, weight: '700' });
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
    const name = label(t(`paint.${kind}`), 30 * k, { fill: P.cream, weight: '700' });
    fitIn(name, r.w, KIND_H * 0.9);
    name.anchor.set(0, 0.5);
    name.position.set(r.x, y + KIND_H / 2);
    box.addChild(name);
    y += KIND_H;
    PAINTS.filter((p) => p.kind === kind).forEach((p, i) => {
      const tile = drawTile(h, p, tileW, tileH, k, act);
      tile.position.set(r.x + (i % cols) * (tileW + GAP), y + Math.floor(i / cols) * (tileH + GAP));
      box.addChild(tile);
    });
    y += rowsPer * (tileH + GAP);
  }
  return box;
}

/** One paint: its colour (a length of rope, or the hook sprite tinted), its name and its button. */
function drawTile(h: Harbour, p: PaintSpec, w: number, ht: number, k: number, act: CabinActions): Container {
  const box = new Container();
  const worn = h.wear[p.kind] === p.id;
  const paper = new Graphics();
  paper.roundRect(0, 0, w, ht, 18).fill(worn ? P.paper : P.paperDark).stroke({ color: worn ? P.brass : P.line, width: worn ? 6 : 4 });
  box.addChild(paper);
  const pad = 10;
  const btnH = Math.min(72, ht * 0.3);
  const nameH = ht * 0.2;
  const picH = ht - btnH - nameH - pad * 3;
  const cx = w / 2;
  const picY = pad + picH / 2;
  // a patch of the sea the paint is seen on in the game: a white hook on cream paper did not show
  const water = new Graphics();
  water.roundRect(pad, pad, w - pad * 2, picH, 12).fill(SEA.mid).stroke({ color: P.line, width: 3 });
  box.addChild(water);
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
  const name = label(t(`paint.names.${p.id}` as TextKey), 26 * k, { fill: P.ink, stroke: false, weight: '700' });
  fitIn(name, w - pad * 2, nameH);
  name.anchor.set(0.5);
  name.position.set(cx, pad + picH + pad / 2 + nameH / 2);
  box.addChild(name);
  const bw = w - pad * 2;
  const owned = h.hasPaint(p.id);
  const price = h.paintPrice;
  const b = worn
    ? new Button({ w: bw, h: btnH, text: t('paint.worn'), size: 28 * k, enabled: false, onPress: () => {} })
    : owned
      ? new Button({ w: bw, h: btnH, text: t('paint.wear'), size: 28 * k, color: P.wood, onPress: () => act.paint(p.id) })
      : new Button({ w: bw, h: btnH, text: '', size: 32 * k, price, pearl: true, enabled: h.pearls >= price, onPress: () => act.paint(p.id), onDenied: () => act.denied?.() });
  b.position.set(pad, ht - btnH - pad);
  box.addChild(b);
  return box;
}
