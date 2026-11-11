// The tutorial's cue on screen (game/guide/guide.ts): a bouncing hand-arrow and a pulsing ring on
// what to tap (a fish, a monster, a shop button), and the step's line of words in the hint
// banner's place with a skip button. The hand never takes a tap; only the skip button does, and it
// stops the press there so it never casts. Nothing here changes the game but the skip.

import { Container, Graphics } from 'pixi.js';
import type { Cue } from '../../game/guide/guide';
import type { Session } from '../../game/session';
import { t } from '../../i18n';
import { FP } from '../../sim/math/fixed';
import { Button } from '../kit/button';
import { P } from '../kit/palette';
import { Redraw } from '../kit/redraw';
import { fitIn, label } from '../kit/text';
import { toDesign } from '../orient';
import type { Frame, Rect } from './frame';
import type { ShopPanel } from './shop';

/** The arrow's length and how far it bobs, design units; the bob's period, ms. */
const ARROW = 96;
const BOB = 22;
/** In the shop the arrow is this much shorter and bobs less, so it stays in the gap over a button
 *  instead of covering the card's words; the ring does the rest. */
const SHOP_SHRINK = 0.5;
const BOB_MS = 900;
/** The ring around a lane target never shrinks below this, design units. */
const RING_MIN = 46;
/** The skip button's share of the bubble's width. */
const SKIP_SHARE = 0.3;

export class Pointer extends Container {
  private readonly hand = new Graphics();
  private readonly redraw = new Redraw();
  private readonly bubble = new Container();
  private bubbleKey = '';
  private ms = 0;
  /** Where the arrow's tip and tail end were last drawn, design units (for the layout sweep);
   *  null: hidden. */
  tip: { x: number; y: number; tail: number } | null = null;

  constructor(
    private readonly fr: Frame,
    private readonly shop: ShopPanel,
    private readonly onSkip: () => void,
  ) {
    super();
    this.hand.eventMode = 'none';
    this.addChild(this.bubble, this.hand);
  }

  /** Whether the step's words are up (the hint banner waits behind them). */
  get talking(): boolean {
    return this.bubbleKey !== '';
  }

  update(s: Session, frameMs: number): void {
    const live = s.mode === 'play' && !s.paused && !s.hold;
    const cue = live ? (s.guide?.cue ?? null) : null;
    this.ms += frameMs;
    this.drawBubble(cue && cue.text && s.world.phase === 'wave' ? cue : null, s.guide?.skipArmed ?? false);
    // the hand is up only while the tutorial points at something, so in every game after the
    // first this layer stands empty, and clearing an empty one still costs (kit/redraw.ts)
    if (this.redraw.needed(!!(cue?.hand && cue.target))) this.hand.clear();
    this.tip = null;
    if (!cue?.hand || !cue.target) return;
    if (cue.target.t === 'shop') {
      const r = this.shop.spot(cue.target.pick);
      if (r) this.pointAtRect(r);
      return;
    }
    const spot = this.laneSpot(s, cue);
    if (spot) this.pointAt(spot.x, spot.y, spot.r);
  }

  /** The cue's lane target, drawn where the actors draw it (between last tick and now). */
  private laneSpot(s: Session, cue: Cue): { x: number; y: number; r: number } | null {
    const tg = cue.target;
    if (!tg || tg.t === 'shop') return null;
    const w = s.world;
    const o = tg.t === 'item' ? w.items.find((it) => it.id === tg.id) : w.mons.find((m) => m.id === tg.id);
    if (!o) return null;
    const was = s.prev.get(o.id);
    const a = s.alpha;
    const d = was ? was.d + (o.d - was.d) * a : o.d;
    const wv = was ? was.w + (o.w - was.w) * a : o.w;
    const p = toDesign(this.fr.field, d / FP, wv / FP);
    return { ...p, r: Math.max(RING_MIN, (o.r / FP) * this.fr.field.scale * 1.6) };
  }

  private pulse(): number {
    return (Math.sin((this.ms / BOB_MS) * Math.PI * 2) + 1) / 2;
  }

  private pointAt(x: number, y: number, r: number): void {
    const k = this.pulse();
    this.hand.circle(x, y, r * (1 + 0.15 * k)).stroke({ color: P.brassLight, width: 6, alpha: 0.95 });
    this.arrow(x, y - r * 1.05, y + r * 1.05);
  }

  private pointAtRect(r: Rect): void {
    const k = this.pulse();
    const g = 6 + 8 * k;
    this.hand.roundRect(r.x - g, r.y - g, r.w + g * 2, r.h + g * 2, 24).stroke({ color: P.brassLight, width: 7 });
    this.arrow(r.x + r.w / 2, r.y - g, r.y + r.h + g, SHOP_SHRINK);
  }

  /** The arrow over a target: above it pointing down, or below pointing up when the top is short
   *  of room; `above` and `below` are the target's edges. Kept on screen either way. */
  private arrow(x: number, above: number, below: number, size = 1): void {
    const { fit } = this.fr;
    const len = ARROW * size;
    const bob = BOB * size * this.pulse();
    const down = above - len - BOB - 8 >= 0 || below + len + BOB + 8 > fit.h;
    const sgn = down ? 1 : -1;
    const tipY = Math.min(fit.h - 4, Math.max(4, down ? above - 4 - bob : below + 4 + bob));
    const head = len * 0.5;
    const cx = Math.min(fit.w - head, Math.max(head, x));
    const stem = len * 0.22;
    const baseY = tipY - sgn * head;
    const endY = tipY - sgn * len;
    this.hand
      .poly([cx, tipY, cx - head * 0.8, baseY, cx - stem, baseY, cx - stem, endY, cx + stem, endY, cx + stem, baseY, cx + head * 0.8, baseY])
      .fill(P.brassLight)
      .stroke({ color: P.line, width: 6 * Math.max(size, 0.7) });
    this.tip = { x: cx, y: tipY, tail: endY };
  }

  private drawBubble(cue: Cue | null, armed: boolean): void {
    const key = cue?.text ? `${cue.text}|${armed}` : '';
    if (key === this.bubbleKey) return;
    this.bubbleKey = key;
    for (const c of this.bubble.removeChildren()) c.destroy({ children: true });
    if (!cue?.text) return;
    const r = this.fr.banner;
    const k = this.fr.boost;
    const g = new Graphics();
    g.roundRect(r.x, r.y, r.w, r.h, 20).fill({ color: P.line, alpha: 0.88 }).stroke({ color: P.brassLight, width: 4 });
    this.bubble.addChild(g);
    const skipW = r.w * SKIP_SHARE;
    const room = r.w - skipW - 60;
    const words = label(t(cue.text), 48 * k, { fill: P.brassLight, wrap: room, weight: '800' });
    fitIn(words, room, r.h - 30);
    words.anchor.set(0.5);
    words.position.set(r.x + 24 + room / 2, r.y + r.h / 2);
    const bh = Math.min(r.h - 36, 96);
    const skip = new Button({
      w: skipW,
      h: bh,
      text: t(armed ? 'guide.skipSure' : 'guide.skip'),
      size: 30 * k,
      color: armed ? P.red : P.woodLight,
      onPress: this.onSkip,
    });
    skip.position.set(r.x + r.w - skipW - 18, r.y + (r.h - bh) / 2);
    this.bubble.addChild(words, skip);
  }
}
