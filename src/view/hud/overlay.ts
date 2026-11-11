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
import { fitIn, fitWrap, label } from '../kit/text';
import { toDesign } from '../orient';
import type { Frame } from './frame';
import type { Slot } from './overAds';

/** How long a hint stays up, ms. */
const BANNER_MS = 4000;
/** The captain on the game over card: above the words in portrait, beside them in landscape. */
const CAPTAIN_H = 340;
/** The gap the game over card leaves for the ad buttons (hud/overAds.ts), design units; a row of
 *  the pause cover's settings takes as much. */
const SLOT_H = 150;
/** The rows of settings buttons on the pause cover (hud/settingsPanel.ts). */
const PAUSE_ROWS = 2;
/** Card lines this size and up (the headline) shrink to one line; smaller ones wrap onto two. */
const WRAP_BELOW = 90;
/** Stands in the queue for the one-time sea event hint, whose words are looked up as it shows. */
const EVENT_HINT = '\u0000event';

type Cover = 'title' | 'paused' | 'over' | 'voyage' | null;
/** How a game reached its end: at the voyage's end, choosing (`voyage`), or home from it (`home`). */
export type VoyageEnd = 'voyage' | 'home' | null;
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
  private end: VoyageEnd = null;
  /** Where the card left room for the ad buttons, or null. */
  slot: Slot | null = null;
  private readonly banner = new Container();
  private readonly queue: string[] = [];
  private bannerMs = 0;
  private seen = new Set<string>();
  /** What sea events are, once a save (game/guide/guide.ts): queued while not seen, spent on show. */
  eventHint: { seen(): boolean; spend(): void } | null = null;
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
   *  `offer`: the ad buttons the card makes room for (game/ads.ts). `end`: the voyage's end
   *  (game/session.ts), whose card leaves room for its own buttons (hud/voyageEnd.ts). The harbour
   *  draws itself. */
  update(mode: Mode, paused: boolean, shop: boolean, wave: number, events: readonly SimEvent[], frameMs: number, quiet = false, lesson: string | null = null, pearls: number | null = null, notes: readonly string[] = [], offer: Offer = null, end: VoyageEnd = null): void {
    const cover: Cover = mode === 'title' ? 'title' : mode === 'over' ? 'over' : mode === 'play' && paused ? 'paused' : end === 'voyage' && mode === 'play' ? 'voyage' : null;
    if (cover !== this.cover || (cover === 'over' && (wave !== this.wave || lesson !== this.lesson || pearls !== this.pearls || offer !== this.offer || end !== this.end || notes.join('|') !== this.notes.join('|')))) {
      this.cover = cover;
      this.end = end;
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
      // not a hint: the tide turns in every long game, so it is said every time (sim/tide.ts)
      else if (ev.e === 'tide') this.queue.unshift(t('hints.tide'));
      // every sea event says what it is, ahead of any lesson waiting (sim/seaEvents.ts)
      // and the first on this save is followed by what sea events are
      else if (ev.e === 'seaEvent') {
        this.queue.unshift(t(`events.${ev.id}` as TextKey));
        if (this.eventHint && !this.eventHint.seen() && !this.queue.includes(EVENT_HINT)) this.queue.splice(1, 0, EVENT_HINT);
      }
    }
    // nor over a cover: the game over card's lines can climb up to the top
    this.banner.visible = !shop && !quiet && !this.cover;
    if (mode !== 'play' || shop || quiet) return;
    if (!paused) this.bannerMs -= frameMs;
    if (this.bannerMs <= 0) {
      const next = this.queue.shift();
      // the one-time hint is spent when it shows, not when queued: a reset may drop it first
      if (next === EVENT_HINT) this.eventHint?.spend();
      this.showBanner(next === EVENT_HINT ? t('hints.event') : (next ?? null));
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
          ? [[t('overlay.paused'), 100, P.brassLight], [t('overlay.resume'), 56, P.cream], ['', PAUSE_ROWS, 0]]
          : this.cover === 'voyage'
            ? [[t('voyage.title'), 96, P.brassLight], [t('voyage.body', { n: this.wave }), 52, P.cream], ['', 0, 0]]
            : this.overLines();
    const cx = fit.wide ? f.x + f.w / 2 : fit.w / 2;
    // a widened portrait (a square embed) lets the words run past the lane, over the dim
    let maxW = (fit.wide ? Math.min(f.w, fit.w) : Math.max(f.w, fit.w - 192)) - 80;
    const over = this.cover === 'over' || this.cover === 'voyage';
    const tall = over && !fit.wide;
    if (over && fit.wide) maxW -= CAPTAIN_H * aspect('captain') * 2 + 40;
    // each line's words, null for the ad buttons' row, then the block laid out by their real heights
    const items = lines.map(([text, size, fill]) => (text ? words(text, size * k, fill, maxW, size < WRAP_BELOW) : null));
    const gap = (i: number) => 20 + lines[i][1] * k * 0.05;
    // a slot's line says how many rows of buttons it holds (0 for one)
    const slotH = (i: number) => SLOT_H * k * Math.max(1, lines[i][1]);
    const fixed = items.reduce((n, tx, i) => n + (tx ? gap(i) : slotH(i)), 0);
    const textH = () => items.reduce((n, tx) => n + (tx?.height ?? 0), 0);
    // inside the field, and below the captain in portrait; a card too tall for it shrinks its words
    const lo = Math.max(0, f.y) + 20 + (tall ? CAPTAIN_H + 10 : 0);
    const hi = Math.min(fit.h, f.y + f.h) - 20;
    const squeeze = Math.min(1, (hi - lo - fixed) / Math.max(1, textH()));
    if (squeeze < 1) for (const tx of items) tx?.scale.set(tx.scale.x * squeeze);
    const total = fixed + textH();
    const want = mid.y - (lines.length - 1) * 70 - lines[0][1] * k * 0.6 + (tall ? CAPTAIN_H / 2 : 0);
    let y = Math.max(lo, Math.min(want, hi - total));
    if (over) {
      // the words stay centred; in landscape the captain stands beside them
      const capW = CAPTAIN_H * aspect('captain');
      const captain = artSprite('captain', CAPTAIN_H, 0.5, fit.wide ? 0.5 : 1);
      captain?.position.set(fit.wide ? cx - maxW / 2 - capW / 2 - 20 : cx, fit.wide ? mid.y : y - 10);
      if (captain) this.coverBox.addChild(captain);
    }
    items.forEach((tx, i) => {
      if (!tx) {
        const h = slotH(i);
        this.slot = { x: cx, y: y + h / 2 - 10 * k, w: fit.wide ? maxW : fit.w - 64, h: h - 20 * k };
        y += h;
        return;
      }
      tx.anchor.set(0.5);
      tx.position.set(cx, y + tx.height / 2);
      this.coverBox.addChild(tx);
      y += tx.height + gap(i);
    });
  }

  /** The game over card's lines; an empty line is the ad buttons' slot. While the revive is on
   *  offer the game is not counted yet, so no pearls and no way on but the buttons. */
  private overLines(): Line[] {
    const head: Line[] = this.end === 'home'
      ? [[t('voyage.home'), 96, P.brassLight], [t('overlay.reached', { n: this.wave }), 60, P.cream]]
      : [[t('overlay.over'), 96, P.red], [t('overlay.reached', { n: this.wave }), 60, P.cream]];
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

/** A card line: one line shrunk to `maxW`, or, when `wrap` and too long, two lines rather than
 *  smaller words (the revive note was 9 pixels tall on a phone). */
function words(text: string, size: number, fill: number, maxW: number, wrap: boolean): Text {
  const tx = label(text, size, { fill });
  if (tx.width <= maxW || !wrap) return fitIn(tx, maxW);
  tx.destroy();
  return fitWrap(label(text, size, { fill, wrap: maxW }), maxW, size * 1.2 * 2);
}
