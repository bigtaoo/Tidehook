// The language picker: the language in use on one plate, and all eight on a list that drops from
// it. Laid out in the open the eight took a row of their own on every screen that holds them and
// read as a wall of words; a list is only as wide as the moment it is wanted in, so the picker
// now costs one plate and sits in a row beside its neighbours.
//
// The plate is a kit Button (kit/button.ts) with a drawn caret - not a glyph: layout/glyphs.json
// is pinned to the characters the locale tables use, and a picker must not be the one thing that
// adds to it. A row sizes the plate with its neighbours (kit/row.ts), so `langItem` hands the row
// a plate narrowed by the caret's room and `langPlate` builds the full one at the size the row
// settled on. The list is a sheet the caller hangs over everything else it has drawn, on a scrim
// that swallows the tap that closes it: on the pause cover that tap would otherwise reach the
// stage and resume the game (app.ts), in the harbour it would hit the card underneath.

import { Container, Graphics, type FederatedPointerEvent } from 'pixi.js';
import { getLocale, LOCALE_NAMES, LOCALES, type Locale } from '../../i18n';
import { Button } from '../kit/button';
import { P } from '../kit/palette';
import { panel } from '../kit/panel';
import { buttonRow, type RowItem } from '../kit/row';
import { STROKE, TYPE } from '../kit/tokens';
import type { Rect } from './frame';

/** A picker's state, held by the panel that draws it: the panel decides when to build again, so
 *  it is the one that can remember whether the list is down. */
export interface LangPick {
  /** The list is down. */
  open: boolean;
  /** The plate was pressed: the list drops, or goes back up. */
  toggle(): void;
  /** A language was picked; the list goes up with it. */
  pick(l: Locale): void;
}

/** A picker inside a panel that draws more after it (hud/lobby.ts adds the harbour's cards and
 *  Set sail after the cabin): `top` is the layer the open list goes on, added last of all. */
export interface LangSlot {
  pick: LangPick;
  top: Container;
}

/** A row of the open list, the gap between rows, and the sheet's own padding. */
const ROW_H = 84;
const GAP = 12;
const PAD = 16;
/** A column of the list at its narrowest: under this the longest name is shrunk out of reading. */
const MIN_W = 300;

/** The room kept at the plate's right for the caret, on a plate `h` tall. */
function caretRoom(h: number): number {
  return h * 0.45;
}

/** What a row measures the plate as: the plate less the caret's room, so the one size the row
 *  settles on never leaves the words running under the caret. */
export function langItem(w: number, h: number, onPress: () => void): RowItem {
  return { w: w - caretRoom(h), h, text: LOCALE_NAMES[getLocale()], color: P.off, onPress };
}

/** The plate itself, `w` wide, built at the size its row settled on. */
export function langPlate(w: number, h: number, size: number, open: boolean, onPress: () => void): Container {
  const b = new Button({ ...langItem(w, h, onPress), w, size });
  const c = h * 0.16;
  const x = w - h * 0.28;
  const y = h / 2;
  const dy = open ? -c * 0.62 : c * 0.62;
  b.addChild(
    new Graphics()
      .poly([x - c, y - dy, x + c, y - dy, x, y + dy])
      .fill(P.cream)
      .stroke({ color: P.line, width: STROKE.glyph, join: 'round' }),
  );
  return b;
}

/** The open list: a sheet of the eight dropped from `from` (the plate) and kept inside `within`,
 *  over a scrim that catches every tap outside it. One column where the height allows, two where
 *  it does not (a phone held sideways). */
export function drawLangList(from: Rect, within: Rect, k: number, pick: LangPick): Container {
  const box = new Container();
  const h = ROW_H * k;
  const tall = (n: number): number => n * h + (n - 1) * GAP + PAD * 2;
  const cols = tall(LOCALES.length) <= within.h ? 1 : 2;
  const rows = Math.ceil(LOCALES.length / cols);
  const most = (within.w - GAP * (cols - 1) - PAD * 2) / cols;
  const colW = Math.min(most, Math.max(MIN_W * k, from.w));
  const w = colW * cols + GAP * (cols - 1) + PAD * 2;
  const ht = tall(rows);
  // the list drops from the plate, and goes up from it where there is no room below (the pause
  // cover's picker sits at the foot of the card)
  const under = from.y + from.h + GAP;
  const y = clamp(under + ht <= within.y + within.h ? under : from.y - GAP - ht, within.y, within.y + within.h - ht);
  const x = clamp(from.x + from.w / 2 - w / 2, within.x, within.x + within.w - w);

  const scrim = new Graphics().rect(-1e4, -1e4, 3e4, 3e4).fill({ color: P.line, alpha: 0.45 });
  scrim.eventMode = 'static';
  scrim.on('pointerdown', (e: FederatedPointerEvent) => {
    e.stopPropagation();
    pick.toggle();
  });
  box.addChild(scrim, panel({ x, y, w, h: ht }));

  const now = getLocale();
  const items: RowItem[] = LOCALES.map((l) => ({
    w: colW,
    h,
    text: LOCALE_NAMES[l],
    color: l === now ? P.brass : P.off,
    onPress: () => pick.pick(l),
  }));
  buttonRow(items, TYPE.lead * k).forEach((b, i) => {
    b.position.set(x + PAD + (i % cols) * (colW + GAP), y + PAD + Math.floor(i / cols) * (h + GAP));
    box.addChild(b);
  });
  return box;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), Math.max(lo, hi));
}
