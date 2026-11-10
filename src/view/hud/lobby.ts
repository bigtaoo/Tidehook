// The harbour between games (game/meta/harbour.ts, docs/02-onboarding.md section 7): the pearls the
// player has, the last voyage, and two tabs of cards bought with pearls that last from game to
// game: the harbour's upgrades, and blueprints that let the shop offer locked cards
// (docs/04-content.md); the seas (lobbySeas.ts), the daily voyage (lobbyDaily.ts), the captain's
// log (lobbyLog.ts), the codex of monsters met (lobbyCodex.ts) and the cabin's settings and paint (lobbyCabin.ts); where the host sells it, the remove-ads card after the upgrades
// (lobbyNoAds.ts). Then Set sail. It covers the lane like the shop, over a dim; rebuilt when
// something it shows changes.

import { Container, Graphics, Sprite } from 'pixi.js';
import type { Harbour } from '../../game/meta/harbour';
import { t, type TextKey } from '../../i18n';
import { B, type UpgradeSpec } from '../../sim/balance';
import { artSprite, aspect, harbourTex } from '../art';
import { drawCabin, type CabinActions, type CabinSettings } from './lobbyCabin';
import { drawCodex } from './lobbyCodex';
import { drawDaily, type DailyActions, type DailyView } from './lobbyDaily';
import { drawLog } from './lobbyLog';
import { drawNoAds, NO_SALE, type NoAdsView } from './lobbyNoAds';
import { drawSeas, seaName, type SeaActions } from './lobbySeas';
import { harbourTip } from '../../game/meta/tip';
import { Button, drawPearl } from '../kit/button';
import { P } from '../kit/palette';
import { fitIn, fitWrap, label } from '../kit/text';
import type { Frame, Rect } from './frame';

export interface LobbyActions extends SeaActions, DailyActions, CabinActions {
  buy(id: string): void;
  sail(): void;
  /** A press on something the player cannot buy. */
  denied?(): void;
  /** A press on the remove-ads card's price (lobbyNoAds.ts). */
  noAds?(): void;
}

/** The voyage just ended; wave 0: none yet this sitting. */
export interface Voyage {
  wave: number;
  pearls: number;
}

const PAD = 28;
const GAP = 20;
const HEAD = 90;
const LINE = 56;
const ROW = 140;
const ROW_WIDE = 112;
const COLS = 3;
/** A portrait design this wide (viewport.ts fitDesign) has room for a fourth column. */
const WIDE_PORTRAIT = 1300;
const CAPTAIN_H = 150;
const TAB_H = 84;
const RADIUS = 32;
/** How much of the panel's walnut lies over the harbour picture, so the cards and words read. */
const SHADE = 0.64;

export type LobbyTab = 'gear' | 'plans' | 'seas' | 'daily' | 'log' | 'codex' | 'cabin';
export const LOBBY_TABS: readonly LobbyTab[] = ['gear', 'plans', 'seas', 'daily', 'log', 'codex', 'cabin'];

/** The upgrade cards on a tab, in order (none on the seas, the daily voyage, the log, the codex
 *  and the cabin, which draw their own). */
export function tabCards(tab: LobbyTab): UpgradeSpec[] {
  if (tab !== 'gear' && tab !== 'plans') return [];
  return B.meta.upgrades.filter((u) => (tab === 'plans') === !!u.unlock);
}

export class LobbyPanel extends Container {
  private last = '';
  /** The tab on show. */
  tab: LobbyTab = 'gear';
  private readonly deny = () => this.act.denied?.();

  constructor(
    private readonly fr: Frame,
    private readonly act: LobbyActions,
    private readonly settings: CabinSettings | null = null,
  ) {
    super();
    this.visible = false;
  }

  update(h: Harbour | null, show: boolean, voyage: Voyage, daily: DailyView = { day: '' }, noAds: NoAdsView = NO_SALE): void {
    this.visible = show && !!h;
    if (!this.visible || !h) {
      this.last = '';
      return;
    }
    const key = [this.tab, h.pearls, voyage.wave, voyage.pearls, h.done.length, h.sea, h.charts.length, h.flat, daily.day, h.dailyBest(daily.day), daily.rows === undefined ? '-' : (daily.rows?.length ?? 'x'), daily.rows?.map((r) => r.name + r.wave).join(), noAds.state, noAds.price, noAds.busy, h.totals.games, h.totals.golds, h.paints.length, h.wear.rope, h.wear.hook, h.streak.n, h.streak.day, this.settings?.s.key ?? '', ...B.meta.upgrades.map((u) => h.level(u.id))].join('|');
    if (key === this.last) return;
    this.last = key;
    for (const c of this.removeChildren()) c.destroy({ children: true });
    this.build(h, voyage, daily, noAds);
  }

  /** The panel: the whole lane between the bars. Between games the lane has nothing to show, and
   *  a phone's landscape needs the width: the shop's 1000 units left the cards' words 7 pixels tall. */
  private rect(): Rect {
    const { fit, shop, bars } = this.fr;
    if (fit.wide) return { x: shop.y, y: shop.y, w: shop.x + shop.w - shop.y, h: shop.h };
    const top = bars[0].y + bars[0].h + GAP;
    return { x: shop.x, y: top, w: shop.w, h: shop.y + shop.h - top };
  }

  private build(h: Harbour, voyage: Voyage, daily: DailyView, noAds: NoAdsView): void {
    const { fit } = this.fr;
    const k = this.fr.boost;
    const r = this.rect();
    // landscape is short: the tabs take the title's place (the first tab names the harbour), the
    // line shares a row with Set sail, so the cards get the height
    const wide = fit.wide;
    const rowH = wide ? ROW_WIDE : ROW;
    const dim = new Graphics();
    dim.rect(0, 0, fit.w, fit.h).fill({ color: P.line, alpha: 0.6 });
    const bg = new Graphics();
    bg.roundRect(r.x, r.y, r.w, r.h, RADIUS).fill(P.woodDark);
    this.addChild(dim, bg);
    const pic = backdrop(r);
    if (pic) this.addChild(pic);
    this.addChild(new Graphics().roundRect(r.x, r.y, r.w, r.h, RADIUS).stroke({ color: P.line, width: 6 }));

    const inner = r.w - PAD * 2;
    const capW = CAPTAIN_H * aspect('captain') + 12;
    const captain = artSprite('captain', CAPTAIN_H, 0, 1);
    if (captain) {
      captain.position.set(r.x + PAD, r.y + PAD + HEAD + 8);
      this.addChild(captain);
    }
    if (!wide) {
      const title = label(t('lobby.title'), 56 * k);
      fitIn(title, inner * 0.6 - capW, HEAD);
      title.anchor.set(0, 0.5);
      title.position.set(r.x + PAD + capW, r.y + PAD + HEAD / 2);
      this.addChild(title);
    }
    const pearls = label(String(h.pearls), 52 * k, { fill: P.cream });
    fitIn(pearls, inner * 0.3, HEAD);
    pearls.anchor.set(1, 0.5);
    pearls.position.set(r.x + r.w - PAD, r.y + PAD + HEAD / 2);
    const pearl = new Graphics();
    const pr = 18 * k;
    drawPearl(pearl, pearls.x - pearls.width - pr * 1.6, pearls.y, pr);
    this.addChild(pearls, pearl);

    const lineY = r.y + PAD + HEAD + 8;
    const said = tipLine(h) ?? (voyage.wave > 0 ? t('lobby.earned', { wave: voyage.wave, n: voyage.pearls }) : t('lobby.hint'));
    const sailW = wide ? inner / 2 : inner;
    const line = label(said, 36 * k, { fill: P.brassLight, weight: '700', wrap: wide ? sailW - GAP * 2 : undefined });
    line.anchor.set(0, 0.5);
    if (wide) {
      fitWrap(line, sailW - GAP * 2, rowH);
      line.position.set(r.x + PAD + GAP, r.y + r.h - PAD - rowH / 2);
    } else {
      fitIn(line, inner - capW, LINE);
      line.position.set(r.x + PAD + capW, lineY + LINE / 2);
    }
    this.addChild(line);

    // landscape: the tabs sit in the title row, between the captain and the pearls
    const tabX = wide ? r.x + PAD + capW : r.x + PAD;
    const tabsW = wide ? pearl.getLocalBounds().x - 40 - tabX : inner;
    const tabY = wide ? r.y + PAD + (HEAD - TAB_H) / 2 : lineY + LINE + 16;
    const tabW = (tabsW - GAP * (LOBBY_TABS.length - 1)) / LOBBY_TABS.length;
    LOBBY_TABS.forEach((tab, i) => {
      const on = tab === this.tab;
      const b = new Button({
        w: tabW,
        h: TAB_H,
        text: t(`lobby.tabs.${tab}` as TextKey),
        size: 38 * k,
        color: on ? P.brass : P.wood,
        onPress: () => this.show(tab),
      });
      b.position.set(tabX + i * (tabW + GAP), tabY);
      this.addChild(b);
    });

    const ups = tabCards(this.tab);
    const gridY = wide ? r.y + PAD + HEAD + GAP : tabY + TAB_H + 20;
    const area = { x: r.x + PAD, y: gridY, w: inner, h: r.y + r.h - PAD - rowH - GAP - gridY };
    if (this.tab === 'log') this.addChild(drawLog(h, area, k));
    if (this.tab === 'codex') this.addChild(drawCodex(h, area, k, wide));
    if (this.tab === 'cabin') this.addChild(drawCabin(h, this.settings, area, k, wide, this.act));
    if (this.tab === 'seas') this.addChild(drawSeas(h, area, k, this.act));
    if (this.tab === 'daily') this.addChild(drawDaily(h, daily, area, k, wide, this.act));
    // Landscape's panel is short: more columns keep the cards to two rows, tall enough to read; a
    // widened portrait (a square embed) takes a fourth column, so its cards grow taller too.
    // the remove-ads card takes the slot after the upgrades (there are 7: a free one in the last row)
    const sale = this.tab === 'gear' && noAds.state !== 'none';
    const slots = ups.length + (sale ? 1 : 0);
    const cols = fit.wide ? Math.max(COLS, Math.ceil(slots / 2)) : fit.w >= WIDE_PORTRAIT ? COLS + 1 : COLS;
    const cardW = (inner - GAP * (cols - 1)) / cols;
    const rows = Math.max(1, Math.ceil(slots / cols));
    const cardH = (area.h - GAP * (rows - 1)) / rows;
    const place = (card: Container, i: number) => {
      card.position.set(r.x + PAD + (i % cols) * (cardW + GAP), gridY + Math.floor(i / cols) * (cardH + GAP));
      this.addChild(card);
    };
    ups.forEach((u, i) => place(this.card(h, u, cardW, cardH), i));
    if (sale) place(drawNoAds(noAds, cardW, cardH, k, wide, () => this.act.noAds?.()), ups.length);
    const sail = new Button({ w: sailW, h: rowH, text: h.sea ? t('lobby.sailTo', { sea: seaName(h.sea) }) : t('lobby.sail'), size: 60 * k, color: P.go, onPress: () => this.act.sail() });
    sail.position.set(r.x + r.w - PAD - sailW, r.y + r.h - PAD - rowH);
    this.addChild(sail);
  }

  /** Turns to `tab`. */
  private show(tab: LobbyTab): void {
    if (tab === this.tab) return;
    this.tab = tab;
    this.last = '';
  }

  /** Upgrade `u`: its name, level and what it does on paper, and its pearl price on a button. A
   *  blueprint shows the shop card it unlocks. */
  private card(h: Harbour, u: UpgradeSpec, cw: number, ch: number): Container {
    const k = this.fr.boost;
    const id = u.id;
    const plan = u.unlock;
    const cost = h.price(id);
    const box = new Container();
    const paper = new Graphics();
    paper.roundRect(0, 0, cw, ch, 24).fill(cost === null ? P.paperDark : P.paper).stroke({ color: P.line, width: 5 });
    box.addChild(paper);
    const text = 16;
    const btnH = Math.min(100, ch * (this.fr.fit.wide ? 0.18 : 0.22));
    const nameH = ch * (this.fr.fit.wide ? 0.23 : 0.2);
    const said = plan
      ? { name: t(`cards.${plan}.name` as TextKey), lv: t('lobby.planNew'), desc: t(`cards.${plan}.desc` as TextKey) }
      : { name: t(`meta.${id}.name` as TextKey), lv: t('shop.level', { n: h.level(id), max: u.max }), desc: t(`meta.${id}.desc` as TextKey) };
    const name = label(said.name, 40 * k, { fill: P.ink, stroke: false, wrap: cw - text * 2 });
    fitWrap(name, cw - text * 2, nameH);
    name.anchor.set(0.5);
    name.position.set(cw / 2, text + nameH / 2);
    const lv = label(said.lv, 28 * k, { fill: P.brassDark, stroke: false });
    // the level line is short words: a bigger share keeps them readable (they were 9 pixels tall)
    const lvH = ch * 0.12;
    fitIn(lv, cw - text * 2, lvH);
    lv.anchor.set(0.5);
    lv.position.set(cw / 2, text + nameH + lvH * 0.6);
    const descTop = text + nameH + lvH + ch * 0.03;
    const desc = label(said.desc, 28 * k, { fill: P.ink, stroke: false, weight: '600', wrap: cw - text * 2 });
    fitWrap(desc, cw - text * 2, ch - descTop - btnH - text * 1.5);
    desc.anchor.set(0.5, 0);
    desc.position.set(cw / 2, descTop);
    box.addChild(name, lv, desc);
    const b =
      cost === null
        ? new Button({ w: cw - text * 2, h: btnH, text: t(plan ? 'lobby.owned' : 'lobby.max'), size: 34 * k, enabled: false, onPress: () => {} })
        : new Button({ w: cw - text * 2, h: btnH, text: '', size: 42 * k, price: cost, pearl: true, enabled: h.pearls >= cost, onPress: () => this.act.buy(id), onDenied: this.deny });
    b.position.set(text, ch - btnH - text);
    box.addChild(b);
    return box;
  }
}

/** The harbour picture (art.ts harbourTex) filling the panel from the bottom, under a walnut shade;
 *  null when it is not loaded, and the panel stays plain walnut. */
function backdrop(r: Rect): Container | null {
  const t = harbourTex();
  if (!t) return null;
  const box = new Container();
  const pic = new Sprite(t);
  const scale = Math.max(r.w / t.width, r.h / t.height);
  pic.scale.set(scale);
  pic.position.set(r.x + (r.w - t.width * scale) / 2, r.y + r.h - t.height * scale);
  const mask = new Graphics().roundRect(r.x, r.y, r.w, r.h, RADIUS).fill(0xffffff);
  pic.mask = mask;
  const shade = new Graphics().roundRect(r.x, r.y, r.w, r.h, RADIUS).fill({ color: P.woodDark, alpha: SHADE });
  box.addChild(pic, mask, shade);
  return box;
}

/** The harbour's tip for a stuck player (game/meta/tip.ts), or null. */
function tipLine(h: Harbour): string | null {
  const tip = harbourTip(h);
  if (!tip) return null;
  if (tip.kind === 'sea' || tip.kind === 'chart') return t(`lobby.tips.${tip.kind}`, { sea: seaName(tip.sea) });
  if (tip.kind === 'save') return t('lobby.tips.save', { sea: seaName(tip.sea), n: tip.n });
  return t(`lobby.tips.${tip.kind}`);
}
