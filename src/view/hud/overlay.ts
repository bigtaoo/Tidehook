// What lies over the whole game: the title before the first cast, the pause cover and the game
// over card, plus the hint banner across the top of the lane (a new monster, the first junk in
// hand, the first monster eating).

import { Container, Graphics, Text } from 'pixi.js';
import { t, type TextKey } from '../../i18n';
import type { Mode } from '../../game/session';
import type { SimEvent } from '../../sim/events';
import { artSprite, aspect } from '../art';
import { P } from '../kit/palette';
import { fitIn, label } from '../kit/text';
import { toDesign } from '../orient';
import type { Frame } from './frame';

/** How long a hint stays up, ms. */
const BANNER_MS = 5000;
/** The captain on the game over card: above the words in portrait, beside them in landscape. */
const CAPTAIN_H = 340;

type Cover = 'title' | 'paused' | 'over' | null;

export class Overlay extends Container {
  private cover: Cover = null;
  private wave = 0;
  private lesson: string | null = null;
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
   *  behind the tutorial's words while `quiet`. `lesson`: a line for the game over card. */
  update(mode: Mode, paused: boolean, shop: boolean, wave: number, events: readonly SimEvent[], frameMs: number, quiet = false, lesson: string | null = null): void {
    const cover: Cover = mode === 'title' ? 'title' : mode === 'over' ? 'over' : paused ? 'paused' : null;
    if (cover !== this.cover || (cover === 'over' && (wave !== this.wave || lesson !== this.lesson))) {
      this.cover = cover;
      this.wave = wave;
      this.lesson = lesson;
      this.drawCover();
    }
    for (const ev of events) {
      if (ev.e === 'debut') this.hint(`debut.${ev.kind}`, t('hints.debut', { name: t(`monsters.${ev.kind}.name` as TextKey), tip: t(`monsters.${ev.kind}.tip` as TextKey) }));
      else if (ev.e === 'held') this.hint('held', t('hints.held'));
      else if (ev.e === 'eatStart') this.hint('eat', t('hints.eat'));
    }
    this.banner.visible = !shop && !quiet;
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
    g.roundRect(r.x, r.y, r.w, r.h, 20).fill({ color: P.line, alpha: 0.85 }).stroke({ color: P.brassLight, width: 3 });
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
    const { fit, field: f } = this.fr;
    const k = this.fr.boost;
    if (!this.cover) return;
    const dim = new Graphics();
    dim.rect(0, 0, fit.w, fit.h).fill({ color: P.line, alpha: this.cover === 'title' ? 0.25 : 0.6 });
    this.coverBox.addChild(dim);
    const mid = toDesign(f, 300, 240);
    const lines: [string, number, number][] =
      this.cover === 'title'
        ? [[t('title'), 120, P.brassLight], [t('boot.tapToStart'), 60, P.cream]]
        : this.cover === 'paused'
          ? [[t('overlay.paused'), 100, P.brassLight], [t('overlay.resume'), 56, P.cream]]
          : [
              [t('overlay.over'), 96, P.red],
              [t('overlay.reached', { n: this.wave }), 60, P.cream],
              ...(this.lesson ? [[this.lesson, 52, P.brassLight] as [string, number, number]] : []),
              [t('overlay.again'), 56, P.cream],
            ];
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
      const tx: Text = fitIn(label(text, size * k, { fill }), maxW);
      tx.anchor.set(0.5);
      tx.position.set(cx, y);
      this.coverBox.addChild(tx);
      y += size * k * 1.3 + 20;
    }
  }
}
