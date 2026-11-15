// The language picker: the eight languages (i18n/index.ts), each named in itself, the one in use
// in brass. It is a row of plates where one is the chosen one, which the harbour's tabs already
// are, so it is drawn by the same hand (hud/lobbyTabs.ts): the names share the row out by how
// long they are, and every plate is built at the one size they can all take. Shown in the pause
// cover (hud/pausePanel.ts) and in the harbour's cabin (hud/lobbyCabin.ts), the two places the
// player's settings live - the cabin because a player between games never sees a pause cover.

import type { Container } from 'pixi.js';
import { getLocale, LOCALE_NAMES, LOCALES, type Locale } from '../../i18n';
import { P } from '../kit/palette';
import { drawTabs, tabsH } from './lobbyTabs';

/** A plate's height, design units, before the small-embed boost. */
const LANG_H = 84;
/** The least a plate may be given and still read: under this the eight go over two rows. */
const MIN_W = 150;

/** The rows the eight plates take in `w`: one where each can still be read, two below that. */
export function langRows(w: number): number {
  return w >= LOCALES.length * MIN_W ? 1 : 2;
}

/** How tall the picker is over `rows` rows. */
export function langsH(rows: number, k: number): number {
  return tabsH(rows, LANG_H * k);
}

/** The picker, filling `w` from (`x`, `y`) over `rows` rows. */
export function drawLangs(x: number, y: number, w: number, k: number, rows: number, onPick: (l: Locale) => void): Container {
  const now = getLocale();
  const items = LOCALES.map((l) => ({ text: LOCALE_NAMES[l], on: l === now, onPress: () => onPick(l) }));
  return drawTabs(items, x, y, w, k, rows, { h: LANG_H * k, off: P.off });
}
