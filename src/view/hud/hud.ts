// The HUD: wave, coins, the dock's hit points, mines and the junk in hand, on the plates frame.ts
// lays out, plus the pause button. Words are rewritten only when a number changes.

import { Container, Graphics, Text } from 'pixi.js';
import { t } from '../../i18n';
import type { World } from '../../sim/world';
import { Button } from '../kit/button';
import { CATCH, P } from '../kit/palette';
import { fitIn, label } from '../kit/text';
import type { Frame, Rect } from './frame';

interface Slot {
  x: number;
  y: number;
  /** 0 left-aligned at x, 0.5 centred on it. */
  ax: number;
  maxW: number;
}

interface Slots {
  wave: Slot;
  coins: Slot;
  dock: Slot;
  bar: Rect;
  mines: Slot;
  held: Slot;
}

function slotsFor(fr: Frame): Slots {
  const [a, b] = fr.bars;
  if (fr.fit.wide) {
    const cx = a.x + a.w / 2;
    const maxW = a.w - 80;
    return {
      wave: { x: cx, y: 100, ax: 0.5, maxW },
      coins: { x: cx, y: 210, ax: 0.5, maxW: maxW - 60 },
      dock: { x: cx, y: 330, ax: 0.5, maxW },
      bar: { x: a.x + 40, y: 385, w: a.w - 80, h: 40 },
      mines: { x: cx, y: 500, ax: 0.5, maxW },
      held: { x: cx, y: 610, ax: 0.5, maxW: maxW - 60 },
    };
  }
  const half = b.w / 2;
  return {
    wave: { x: 48, y: a.h / 2, ax: 0, maxW: 400 },
    coins: { x: a.w / 2 + 40, y: a.h / 2, ax: 0.5, maxW: 300 },
    dock: { x: 60, y: b.y + 90, ax: 0, maxW: half - 100 },
    bar: { x: 60, y: b.y + 150, w: half - 100, h: 50 },
    mines: { x: half + 40, y: b.y + 90, ax: 0, maxW: half - 100 },
    held: { x: half + 110, y: b.y + 190, ax: 0, maxW: half - 170 },
  };
}

export class Hud extends Container {
  private readonly slots: Slots;
  private readonly size: number;
  private readonly wave: Text;
  private readonly coins: Text;
  private readonly dock: Text;
  private readonly mines: Text;
  private readonly held: Text;
  private readonly marks = new Graphics();
  private last = '';

  constructor(fr: Frame, onPause: () => void) {
    super();
    this.slots = slotsFor(fr);
    this.size = fr.fit.wide ? 48 * fr.boost : 56;
    const plates = new Graphics();
    for (const r of fr.bars) plates.roundRect(r.x + 12, r.y + 12, r.w - 24, r.h - 24, 28).fill(P.woodDark).stroke({ color: P.line, width: 6 });
    this.addChild(plates);
    this.wave = this.addChild(label('', this.size));
    this.coins = this.addChild(label('', this.size, { fill: P.brassLight }));
    this.dock = this.addChild(label('', this.size * 0.85));
    this.mines = this.addChild(label('', this.size * 0.85));
    this.held = this.addChild(label('', this.size * 0.75));
    // after the words: layout/check.ts takes an earlier Graphics as a word's box
    this.addChild(this.marks);
    const p = fr.pause;
    const pause = new Button({ w: p.w, h: p.h, text: '', size: 1, onPress: onPause });
    const bars = new Graphics();
    bars.rect(30, 26, 12, 44).fill(P.line);
    bars.rect(54, 26, 12, 44).fill(P.line);
    pause.addChild(bars);
    pause.position.set(p.x, p.y);
    pause.label = 'pause';
    this.addChild(pause);
  }

  update(w: World): void {
    const key = `${w.wave}|${w.coins}|${w.hp}|${w.maxHp}|${w.mines}|${w.held ? 1 : 0}`;
    if (key === this.last) return;
    this.last = key;
    const s = this.slots;
    this.put(this.wave, t('hud.wave', { n: Math.max(1, w.wave) }), s.wave);
    this.put(this.coins, t('hud.coins', { n: w.coins }), s.coins);
    this.put(this.dock, t('hud.dock', { hp: w.hp, max: w.maxHp }), s.dock);
    this.put(this.mines, t('hud.mines', { n: w.mines }), s.mines);
    this.put(this.held, w.held ? t('hud.held') : '', s.held);

    const g = this.marks.clear();
    // a coin before the count
    const cr = this.size * 0.36;
    const cx = this.coins.x - this.coins.width * this.coins.anchor.x - cr * 1.6;
    g.circle(cx, s.coins.y, cr).fill(P.brassLight).stroke({ color: P.line, width: 4 });
    // the dock's hit points
    const b = s.bar;
    g.roundRect(b.x, b.y, b.w, b.h, b.h / 2).fill(P.line);
    const part = w.maxHp > 0 ? Math.max(0, w.hp) / w.maxHp : 0;
    if (part > 0) g.roundRect(b.x + 4, b.y + 4, Math.max(b.h - 8, (b.w - 8) * part), b.h - 8, (b.h - 8) / 2).fill(part > 0.34 ? P.green : P.red);
    // the junk in hand
    if (w.held) {
      const hs = this.size * 0.5;
      const hx = s.held.ax === 0 ? s.held.x - hs * 1.4 : this.held.x - this.held.width / 2 - hs * 1.4;
      g.roundRect(hx - hs / 2, s.held.y - hs / 2, hs, hs, 6).fill(CATCH.junk).stroke({ color: P.line, width: 4 });
    }
  }

  private put(text: Text, value: string, s: Slot): void {
    text.text = value;
    fitIn(text, s.maxW);
    text.anchor.set(s.ax, 0.5);
    text.position.set(s.x, s.y);
  }
}
