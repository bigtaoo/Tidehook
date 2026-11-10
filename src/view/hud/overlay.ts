// What lies over the whole game: the title before the first cast, the pause cover and the game
// over card, plus the hint banner across the top of the lane (a new monster, the first junk in
// hand, the first monster eating).

import { Container, Graphics, Text } from 'pixi.js';
import { t, type TextKey } from '../../i18n';
import type { Offer } from '../../game/ads';
import type { Mode } from '../../game/session';
import type { SimEvent } from '../../sim/events';
import { artSprite, aspect } from '../art';
import { P } from '../kit/palette';
import { fitIn, label } from '../kit/text';
import { toDesign } from '../orient';
import type { Frame } from './frame';
import type { Slot } from './overAds';

/** How long a hint stays up, ms. */
const BANNER_MS = 4000;
/** The captain on the game over card: above the words in portrait, beside them in landscape. */
const CAPTAIN_H = 340;
/** The gap the game over card leaves for the ad buttons (hud/overAds.ts), design units. */
const SLOT_H = 150;

type Cover = 'title' | 'paused' | 'over' | null;
type Line = [string, number, number];

export class Overlay extends Container {
  private cover: Cover = null;
  private wave = 0;
  private lesson: string | null = null;
  /** Pearls the last game brought home, or null without a harbour (the bot, tests). */
  private pearls: number | null = null;
  /** The game over's extra lines (a new best, the captain's log), joined for the change check. */
  private notes: readonly string[] = [];
  private offer: Offer = null;
  /** Where the card left room for the ad buttons, or null. */
  slot: Slot | null = null;
  private readonly banner = new Container();
  private readonly queue: string[] = [];
  private bannerMs = 0;
  private seen = new Set<string>();
  private readonly coverBox = new Container();

  constructor(private readonly fr: Frame) {
    super();
    // never a hit target: a passive Graphics under the stage's static mode still takes the hit
    // test, so a cover would hide the HUD buttons from it; taps go to the stage instead
    this.eventMode = 'none';
    this.addChild(this.banner, this.coverBox);
  }

  /** A new game: hints show again. */
  reset(): void {
    this.seen.clear();
    this.queue.length = 0;
    this.bannerMs = 0;
    this.banner.removeChildren().forEach((c) => c.destroy());
  }

  /** `shop`: the shop is open; the banner waits behind it (in landscape they share the top), and
   *  behind the tutorial's words while `quiet`. `lesson`: a line for the game over card; `pearls`:
   *  what the game brought home to the harbour, null without one; `notes`: more lines for it.
   *  `offer`: the ad buttons the card makes room for (game/ads.ts). The harbour draws itself. */
  update(mode: Mode, paused: boolean, shop: boolean, wave: number, events: readonly SimEvent[], frameMs: number, quiet = false, lesson: string | null = null, pearls: number | null = null, notes: readonly string[] = [], offer: Offer = null): void {
    const cover: Cover = mode === 'title' ? 'title' : mode === 'over' ? 'over' : mode === 'play' && paused ? 'paused' : null;
    if (cover !== this.cover || (cover === 'over' && (wave !== this.wave || lesson !== this.lesson || pearls !== this.pearls || offer !== this.offer || notes.join('|') !== this.notes.join('|')))) {
      this.cover = cover;
      this.wave = wave;
      this.lesson = lesson;
      this.pearls = pearls;
      this.notes = notes;
      this.offer = offer;
      this.drawCover();
    }
    for (const ev of events) {
      if (ev.e === 'debut') this.hint(`debut.${ev.kind}`, t('hints.debut', { name: t(`monsters.${ev.kind}.name` as TextKey), tip: t(`monsters.${ev.kind}.tip` as TextKey) }));
      else if (ev.e === 'held') this.hint('held', t('hints.held'));
      else if (ev.e === 'eatStart') this.hint('eat', t('hints.eat'));
    }
    // nor over a cover: the game over card's lines can climb up to the top
    this.banner.visible = !shop && !quiet && !this.cover;
    if (mode !== 'play' || shop || quiet) return;
    if (!paused) this.bannerMs -= frameMs;
    if (this.bannerMs <= 0) {
      const next = this.queue.shift();
      this.showBanner(next ?? null);
    }
  }

  private hint(id: string, text: string): void {
    if (this.seen.has(id)) return;
    this.seen.add(id);
    this.queue.push(text);
  }

  private showBanner(text: string | null): void {
    this.banner.removeChildren().forEach((c) => c.destroy());
    if (text === null) return;
    this.bannerMs = BANNER_MS;
    const r = this.fr.banner;
    const g = new Graphics();
    g.roundRect(r.x, r.y, r.w, r.h, 20).fill({ color: P.line, alpha: 0.7 }).stroke({ color: P.brassLight, width: 3 });
    const size = 40 * this.fr.boost;
    const words = label(text, size, { fill: P.cream, wrap: r.w - 60, weight: '700' });
    fitIn(words, r.w - 60, r.h - 30);
    words.anchor.set(0.5);
    words.position.set(r.x + r.w / 2, r.y + r.h / 2);
    this.banner.addChild(g, words);
  }

  /** Sample hint, for the layout check. */
  showForCheck(text: string): void {
    this.showBanner(text);
  }

  private drawCover(): void {
    this.coverBox.removeChildren().forEach((c) => c.destroy());
    this.slot = null;
    const { fit, field: f } = this.fr;
    const k = this.fr.boost;
    if (!this.cover) return;
    const dim = new Graphics();
    dim.rect(0, 0, fit.w, fit.h).fill({ color: P.line, alpha: this.cover === 'title' ? 0.25 : 0.6 });
    this.coverBox.addChild(dim);
    const mid = toDesign(f, 300, 240);
    const lines: Line[] =
      this.cover === 'title'
        ? [[t('title'), 120, P.brassLight], [t('boot.tapToStart'), 60, P.cream]]
        : this.cover === 'paused'
          ? [[t('overlay.paused'), 100, P.brassLight], [t('overlay.resume'), 56, P.cream]]
          : this.overLines();
    const cx = fit.wide ? f.x + f.w / 2 : fit.w / 2;
    let maxW = Math.min(f.w, fit.w) - 80;
    let y = mid.y - (lines.length - 1) * 70;
    if (this.cover === 'over') {
      // the words stay centred; in landscape they give up the captain's width on both sides
      const capW = CAPTAIN_H * aspect('captain');
      if (fit.wide) maxW -= capW * 2 + 40;
      else y += CAPTAIN_H / 2;
      const top = y - lines[0][1] * k * 0.6;
      const captain = artSprite('captain', CAPTAIN_H, 0.5, fit.wide ? 0.5 : 1);
      captain?.position.set(fit.wide ? cx - maxW / 2 - capW / 2 - 20 : cx, fit.wide ? mid.y : top - 10);
      if (captain) this.coverBox.addChild(captain);
    }
    for (const [text, size, fill] of lines) {
      if (!text) {
        // the ad buttons' row
        this.slot = { x: cx, y: y + (SLOT_H * k) / 2 - 30 * k };
        y += SLOT_H * k;
        continue;
      }
      const tx: Text = fitIn(label(text, size * k, { fill }), maxW);
      tx.anchor.set(0.5);
      tx.position.set(cx, y);
      this.coverBox.addChild(tx);
      y += size * k * 1.3 + 20;
    }
  }

  /** The game over card's lines; an empty line is the ad buttons' slot. While the revive is on
   *  offer the game is not counted yet, so no pearls and no way on but the buttons. */
  private overLines(): Line[] {
    const head: Line[] = [[t('overlay.over'), 96, P.red], [t('overlay.reached', { n: this.wave }), 60, P.cream]];
    if (this.offer === 'revive') return [...head, [t('ads.reviveNote'), 48, P.brassLight], ['', 0, 0]];
    return [
      ...head,
      ...(this.pearls ? [[t('overlay.pearls', { n: this.pearls }), 56, P.cream] as Line] : []),
      ...this.notes.map((n): Line => [n, 48, P.brassLight]),
      ...(this.lesson ? [[this.lesson, 52, P.brassLight] as Line] : []),
      ...(this.offer === 'double' ? [['', 0, 0] as Line] : []),
      [t(this.pearls === null ? 'overlay.again' : 'overlay.harbour'), 56, P.cream],
    ];
  }
}
