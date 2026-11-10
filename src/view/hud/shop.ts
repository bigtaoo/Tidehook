// The shop between waves: three upgrade cards, then repair, mine and new cards, then the next
// wave, in the panel frame.ts places. Rebuilt whenever something it shows changes (a purchase).

import { Container, Graphics } from 'pixi.js';
import { t, type TextKey } from '../../i18n';
import { B } from '../../sim/balance';
import { artSprite, aspect } from '../art';
import { level, mineCost, price, repairCost, rerollCost, upgrade } from '../../sim/shop';
import type { World } from '../../sim/world';
import type { ShopPick } from '../../game/guide/shopPick';
import { Button } from '../kit/button';
import { P } from '../kit/palette';
import { fitIn, label } from '../kit/text';
import type { Frame, Rect } from './frame';

export interface ShopActions {
  buy(i: number): void;
  repair(): void;
  mine(): void;
  reroll(): void;
  next(): void;
  /** A press on something the player cannot buy. */
  denied?(): void;
}

const PAD = 28;
const GAP = 20;
const HEAD = 90;
const ROW = 140;
/** The captain's bust at the head of the panel; it peeks over the panel's top edge. */
const CAPTAIN_H = 150;

export class ShopPanel extends Container {
  private last = '';
  /** Where each button the tutorial may point at sits, design units: card i's buy button as
   *  `card0`..`card2`, then `repair` and `next`. */
  private readonly spots = new Map<string, Rect>();
  private readonly deny = () => this.act.denied?.();

  constructor(
    private readonly fr: Frame,
    private readonly act: ShopActions,
  ) {
    super();
    this.visible = false;
  }

  /** Shows the shop while the world is in it; `mine` is whether the player may buy (not the bot);
   *  `tag` is the card to mark as the Top pick, or null. */
  update(w: World, show: boolean, mine: boolean, tag: number | null = null): void {
    this.visible = show;
    if (!show) {
      this.last = '';
      return;
    }
    const key = [w.wave, w.coins, w.hp, w.maxHp, w.mines, w.rerolls, mine, tag, ...w.cards.map((c) => `${c.id}${c.bought}`)].join('|');
    if (key === this.last) return;
    this.last = key;
    for (const c of this.removeChildren()) c.destroy({ children: true });
    this.build(w, mine, tag);
  }

  /** The button for a shop pick, design units; null while the shop is shut. */
  spot(p: ShopPick): Rect | null {
    if (!this.visible) return null;
    return this.spots.get(p.t === 'card' ? `card${p.i}` : p.t) ?? null;
  }

  private build(w: World, mine: boolean, tag: number | null): void {
    this.spots.clear();
    const r = this.fr.shop;
    const k = this.fr.boost;
    const bg = new Graphics();
    bg.roundRect(r.x, r.y, r.w, r.h, 32).fill(P.woodDark).stroke({ color: P.line, width: 6 });
    this.addChild(bg);

    const inner = r.w - PAD * 2;
    const capW = CAPTAIN_H * aspect('captain') + 12;
    const captain = artSprite('captain', CAPTAIN_H, 0, 1);
    if (captain) {
      captain.position.set(r.x + PAD, r.y + PAD + HEAD + 8);
      this.addChild(captain);
    }
    // a new player's dock was patched for free after the wave (sim/tide.ts)
    const done = w.mended ? t('shop.titleMend', { n: w.wave, hp: w.mended }) : t('shop.title', { n: w.wave });
    const title = label(mine ? done : t('shop.bot'), 52 * k);
    fitIn(title, inner * 0.62 - capW, HEAD);
    title.anchor.set(0, 0.5);
    title.position.set(r.x + PAD + capW, r.y + PAD + HEAD / 2);
    const coins = label(t('hud.coins', { n: w.coins }), 52 * k, { fill: P.brassLight });
    fitIn(coins, inner * 0.3, HEAD);
    coins.anchor.set(1, 0.5);
    coins.position.set(r.x + r.w - PAD, r.y + PAD + HEAD / 2);
    this.addChild(title, coins);
    const coin = new Graphics();
    const cr = 18 * k;
    coin.circle(coins.x - coins.width - cr * 1.6, coins.y, cr).fill(P.brassLight).stroke({ color: P.line, width: 4 });
    this.addChild(coin);

    const cardsY = r.y + PAD + HEAD + 16;
    const cardH = r.h - PAD * 2 - HEAD - 16 - ROW * 2 - GAP * 2;
    const n = Math.max(3, w.cards.length);
    const cardW = (inner - GAP * (n - 1)) / n;
    w.cards.forEach((_, i) => {
      const card = this.card(w, i, cardW, cardH, mine);
      const x = r.x + PAD + i * (cardW + GAP);
      card.position.set(x, cardsY);
      this.addChild(card);
      const btnH = Math.min(110, cardH * 0.22);
      this.spots.set(`card${i}`, { x: x + 16, y: cardsY + cardH - btnH - 16, w: cardW - 32, h: btnH });
      if (i === tag) this.addChild(this.tag(x + cardW / 2, cardsY, cardW));
    });

    const rowY = cardsY + cardH + GAP;
    const cost = { repair: repairCost(w), mine: mineCost(w), reroll: rerollCost(w) };
    const small = [
      { text: t('shop.repair', { n: B.shop.repairHp }), price: cost.repair, ok: w.hp < w.maxHp && w.coins >= cost.repair, onPress: () => this.act.repair() },
      { text: t('shop.mine', { n: w.mines, max: B.mine.max }), price: cost.mine, ok: w.mines < B.mine.max && w.coins >= cost.mine, onPress: () => this.act.mine() },
      { text: t('shop.reroll'), price: cost.reroll, ok: w.coins >= cost.reroll, onPress: () => this.act.reroll() },
    ];
    small.forEach((s, i) => {
      const b = new Button({ w: cardW, h: ROW, text: s.text, size: 40 * k, price: s.price, enabled: mine && s.ok, onPress: s.onPress, onDenied: this.deny });
      b.position.set(r.x + PAD + i * (cardW + GAP), rowY);
      this.addChild(b);
      if (i === 0) this.spots.set('repair', { x: b.x, y: rowY, w: cardW, h: ROW });
    });
    const next = new Button({ w: inner, h: ROW, text: t('shop.next'), size: 60 * k, color: P.go, enabled: mine, onPress: () => this.act.next() });
    next.position.set(r.x + PAD, rowY + ROW + GAP);
    this.addChild(next);
    this.spots.set('next', { x: next.x, y: next.y, w: inner, h: ROW });
  }

  /** The Top pick ribbon, centred on a card's top edge. */
  private tag(cx: number, top: number, cw: number): Container {
    const k = this.fr.boost;
    const box = new Container();
    const words = label(t('guide.topPick'), 30 * k, { fill: P.line, stroke: false, weight: '800' });
    fitIn(words, cw - 40, 44);
    const w = words.width + 36;
    const h = Math.max(44, words.height + 12);
    const g = new Graphics();
    g.roundRect(cx - w / 2, top - h / 2, w, h, h / 2).fill(P.brassLight).stroke({ color: P.line, width: 4 });
    words.anchor.set(0.5);
    words.position.set(cx, top);
    box.addChild(g, words);
    return box;
  }

  /** Card `i`: its name, level and what it does on paper, and its price on a button. */
  private card(w: World, i: number, cw: number, ch: number, mine: boolean): Container {
    const c = w.cards[i];
    const u = upgrade(c.id);
    const k = this.fr.boost;
    const box = new Container();
    const paper = new Graphics();
    paper.roundRect(0, 0, cw, ch, 24).fill(c.bought ? P.paperDark : P.paper).stroke({ color: P.line, width: 5 });
    box.addChild(paper);
    const text = 16;
    const nameH = ch * 0.2;
    const name = label(t(`cards.${c.id}.name` as TextKey), 42 * k, { fill: P.ink, stroke: false, wrap: cw - text * 2 });
    fitIn(name, cw - text * 2, nameH);
    name.anchor.set(0.5);
    name.position.set(cw / 2, text + nameH / 2);
    const lv = label(t('shop.level', { n: level(w, c.id), max: u.max }), 30 * k, { fill: P.brassDark, stroke: false });
    fitIn(lv, cw - text * 2, ch * 0.08);
    lv.anchor.set(0.5);
    lv.position.set(cw / 2, text + nameH + ch * 0.06);
    const btnH = Math.min(110, ch * 0.22);
    const descTop = text + nameH + ch * 0.12;
    const descH = ch - descTop - btnH - text * 2;
    const desc = label(t(`cards.${c.id}.desc` as TextKey), 30 * k, { fill: P.ink, stroke: false, weight: '600', wrap: cw - text * 2 });
    fitIn(desc, cw - text * 2, descH);
    desc.anchor.set(0.5, 0);
    desc.position.set(cw / 2, descTop);
    box.addChild(name, lv, desc);
    const cost = price(w, c.id);
    const b = c.bought
      ? new Button({ w: cw - text * 2, h: btnH, text: t('shop.sold'), size: 36 * k, enabled: false, onPress: () => {} })
      : new Button({ w: cw - text * 2, h: btnH, text: '', size: 44 * k, price: cost, enabled: mine && w.coins >= cost, onPress: () => this.act.buy(i), onDenied: this.deny });
    b.position.set(text, ch - btnH - text);
    box.addChild(b);
    return box;
  }
}
