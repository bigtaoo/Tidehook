import { describe, expect, it } from 'vitest';
import { Graphics } from 'pixi.js';
import { HEAVY, P } from '../kit/palette';
import { drawBar, PipRow } from './pips';

const shown = (r: PipRow) => (r.children as Graphics[]).filter((g) => g.visible);

describe('PipRow', () => {
  it('reuses its graphics instead of making one a frame', () => {
    const row = new PipRow();
    for (let frame = 0; frame < 5; frame++) {
      row.begin();
      for (let i = 0; i < 12; i++) row.put(i * 10, 0, 3, i > 8);
      row.end();
    }
    expect(row.children).toHaveLength(12);
    expect(shown(row)).toHaveLength(12);
  });

  it('hides the pips a shorter row leaves over', () => {
    const row = new PipRow();
    row.begin();
    for (let i = 0; i < 12; i++) row.put(i * 10, 0, 3, false);
    row.end();
    row.begin();
    row.put(0, 0, 3, false);
    row.end();
    expect(row.children).toHaveLength(12);
    expect(shown(row)).toHaveLength(1);
  });

  it('places and sizes a pip, and gives the heavy ones the other shape', () => {
    const row = new PipRow();
    row.begin();
    row.put(20, 40, 2.5, false);
    row.put(30, 40, 2.5, true);
    row.end();
    const [a, b] = row.children as Graphics[];
    expect([a.x, a.y, a.scale.x]).toEqual([20, 40, 2.5]);
    expect(b.x).toBe(30);
    expect(a.context).not.toBe(b.context);
  });

  it('shares one context per shape across every pip of that shape', () => {
    const row = new PipRow();
    row.begin();
    for (let i = 0; i < 6; i++) row.put(i * 10, 0, 3, i % 2 === 0);
    row.end();
    const ctx = (row.children as Graphics[]).map((g) => g.context);
    expect(new Set(ctx).size).toBe(2);
  });
});

/** The round rectangles a drawBar call left behind, in the order they were laid down, with the
 *  colour and alpha each was painted in. */
function shapes(g: Graphics): { x: number; y: number; w: number; color: number; alpha: number; action: string }[] {
  const ins = (g.context as unknown as { instructions: { action: string; data: Record<string, unknown> }[] }).instructions;
  return ins.map((i) => {
    const path = i.data.path as { instructions: { action: string; data: number[] }[] };
    const rect = path.instructions.find((p) => p.action === 'roundRect')!.data;
    const style = i.data.style as { color: number; alpha: number };
    return { x: rect[0], y: rect[1], w: rect[2], color: style.color, alpha: style.alpha, action: i.action };
  });
}

describe('the layered health bar', () => {
  it('fills the top sheet by the share that is left of the layer', () => {
    const g = new Graphics();
    drawBar(g, 100, 50, 60, 1, 1, 0.5, true);
    // the track, then half of it in steel, then the outline
    const s = shapes(g);
    expect(s.map((o) => [o.action, o.x, o.w])).toEqual([
      ['fill', 70, 60],
      ['fill', 70, 30],
      ['stroke', 70, 60],
    ]);
    expect(s[1].color).toBe(HEAVY);
  });

  it('paints a bar the hook could lift in cream, like a light pip', () => {
    const g = new Graphics();
    drawBar(g, 100, 50, 60, 1, 1, 1, false);
    expect(shapes(g)[1]).toMatchObject({ color: P.cream, w: 60 });
  });

  it('draws nothing but the empty track at no health', () => {
    const g = new Graphics();
    drawBar(g, 100, 50, 60, 1, 1, 0, true);
    expect(shapes(g).map((o) => o.action)).toEqual(['fill', 'stroke']);
  });

  it('stacks a sheet for each layer under the top one, offset so they are counted', () => {
    const g = new Graphics();
    drawBar(g, 100, 50, 60, 1, 3, 1, true);
    const s = shapes(g);
    // the two sheets first, the deepest furthest out, then the top sheet on them
    expect(s.map((o) => [o.action, o.x, o.y])).toEqual([
      ['fill', 75, 55],
      ['stroke', 75, 55],
      ['fill', 72.5, 52.5],
      ['stroke', 72.5, 52.5],
      ['fill', 70, 50],
      ['fill', 70, 50],
      ['stroke', 70, 50],
    ]);
  });

  it('stops stacking sheets however deep the monster, so the lane stays readable', () => {
    const deep = (left: number) => {
      const g = new Graphics();
      drawBar(g, 100, 50, 60, 1, left, 1, true);
      return shapes(g).length;
    };
    expect([deep(5), deep(6), deep(20)]).toEqual([11, 11, 11]);
  });
});
