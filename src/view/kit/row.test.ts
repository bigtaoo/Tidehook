// One size for a row (row.ts). The thing worth pinning is not the number it picks but that no
// button shrinks its own words below it: a plate that still has to shrink is a size the row
// should not have chosen, and that is how the harbour's tabs came out at five sizes at once.
import '../layout/measure';
import { Text } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import type { RowItem } from './row';
import { buttonRow, rowSize, shareWidths } from './row';
import { TYPE } from './tokens';

const press = () => {};

/** Every size a button actually renders its lines at: the style's size after fitIn's shrink. */
function sizes(b: { children: readonly unknown[] }): number[] {
  return b.children.filter((c): c is Text => c instanceof Text).map((t) => Number(t.style.fontSize) * t.scale.y);
}

describe('rowSize', () => {
  it('is the smallest size the row can agree on, and every plate keeps it', () => {
    const items: RowItem[] = [
      { w: 170, h: 84, text: 'Log', onPress: press },
      { w: 170, h: 84, text: 'Blueprints', onPress: press },
      { w: 170, h: 84, text: 'Seas', onPress: press },
    ];
    const size = rowSize(items, TYPE.lead);
    expect(size).toBeLessThan(TYPE.lead);
    // the longest word is the one that set it
    expect(size).toBeCloseTo(Math.min(...items.map((o) => rowSize([o], TYPE.lead))), 6);
    for (const b of buttonRow(items, TYPE.lead)) for (const s of sizes(b)) expect(s).toBeCloseTo(size, 1);
  });

  it('leaves a row that already fits at the size it asked for', () => {
    const items: RowItem[] = [{ w: 400, h: 120, text: 'Go', onPress: press }, { w: 400, h: 120, text: 'No', onPress: press }];
    expect(rowSize(items, TYPE.body)).toBe(TYPE.body);
  });

  it('counts a price line too, which is drawn smaller than the words above it', () => {
    const words: RowItem = { w: 170, h: 140, text: 'Winch', onPress: press };
    const priced: RowItem = { ...words, price: 999_999 };
    expect(rowSize([priced], TYPE.head)).toBeLessThan(rowSize([words], TYPE.head));
    const [b] = buttonRow([priced], TYPE.head);
    // the words and the price render at the one size the row chose, each on its own line
    expect(sizes(b)).toHaveLength(2);
  });
});

describe('shareWidths', () => {
  const total = 900;

  it('gives the long word the wider plate and still spends the whole row', () => {
    const w = shareWidths(['Log', 'Blueprints', 'Seas'], total, TYPE.lead);
    expect(w[1]).toBeGreaterThan(w[0]);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(total, 6);
  });

  it('keeps a short word above the floor of an even share, so it stays worth tapping', () => {
    const texts = ['I', 'I', 'Extraordinarily Long Tab Name'];
    const w = shareWidths(texts, total, TYPE.lead);
    const floor = (total / texts.length) * 0.62;
    for (const x of w) expect(x).toBeGreaterThanOrEqual(floor - 1e-6);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(total, 6);
  });

  it('shares evenly when there is nothing to measure', () => {
    for (const x of shareWidths(['', ''], total, TYPE.lead)) expect(x).toBeCloseTo(total / 2, 6);
  });
});
