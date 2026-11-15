// The harbour's tab row (hud/lobby.ts): seven tabs across the panel's head. Seven equal plates on
// a 375-wide phone leave each word about a fifth of the row, and a Button shrinks its own words
// alone (kit/button.ts), so the row came out at five sizes with the selected tab often the least
// readable of them. Here the plates share the row out by how long their words are (kit/row.ts
// shareWidths) and every tab is built at the one size they can all take; in portrait the seven go
// over two rows, which doubles what each word gets.

import { Container } from 'pixi.js';
import { P } from '../kit/palette';
import { buttonRow, shareWidths, type RowItem } from '../kit/row';
import { TYPE } from '../kit/tokens';

/** A tab's height, design units, and the gap between tabs. */
export const TAB_H = 84;
const GAP = 20;

/** What a row that is not the harbour's tabs may set: the language picker's plates are their own
 *  height and wear the settings' off colour, not the tabs' walnut (hud/langRow.ts). */
export interface TabStyle {
  h?: number;
  off?: number;
}

export interface TabItem {
  text: string;
  /** The tab shown now: brass, not walnut. */
  on: boolean;
  onPress: () => void;
}

/** How tall a row `rows` deep is, of plates `h` tall. */
export function tabsH(rows: number, h = TAB_H): number {
  return rows * h + (rows - 1) * GAP;
}

/** `n` tabs over `rows` rows, the fullest row first: 7 over 2 is 4 then 3. */
function split(n: number, rows: number): number[] {
  const out: number[] = [];
  let left = n;
  for (let r = rows; r > 0; r--) {
    const take = Math.ceil(left / r);
    out.push(take);
    left -= take;
  }
  return out;
}

/** The tabs, filling `w` from (`x`, `y`) over `rows` rows. */
export function drawTabs(items: readonly TabItem[], x: number, y: number, w: number, k: number, rows: number, o: TabStyle = {}): Container {
  const box = new Container();
  const h = o.h ?? TAB_H;
  const lines = split(items.length, rows);
  const max = TYPE.lead * k;
  const widths: number[] = [];
  let i = 0;
  for (const n of lines) {
    const texts = items.slice(i, i + n).map((it) => it.text);
    widths.push(...shareWidths(texts, w - GAP * (n - 1), max));
    i += n;
  }
  const row: RowItem[] = items.map((it, j) => ({ w: widths[j], h, text: it.text, color: it.on ? P.brass : (o.off ?? P.wood), onPress: it.onPress }));
  const built = buttonRow(row, max);
  i = 0;
  lines.forEach((n, line) => {
    let at = x;
    for (let j = i; j < i + n; j++) {
      built[j].position.set(at, y + line * (h + GAP));
      box.addChild(built[j]);
      at += widths[j] + GAP;
    }
    i += n;
  });
  return box;
}
