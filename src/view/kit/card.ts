// The paper card the captain buys from: a shop upgrade (hud/shop.ts), a harbour upgrade or
// blueprint (hud/lobby.ts), the remove-ads card (hud/lobbyNoAds.ts) and a sea's chart
// (hud/lobbySeas.ts). All four are the same card - paper, a name, a small line under it, what it
// does, and one button along the bottom - and each used to lay itself out, so they came out with
// four sets of heights and five different edges. They share this one now; a caller says only what
// its card is made of and what its button does.

import { Container } from 'pixi.js';
import { artSprite, aspect, type ArtName } from '../art';
import { Button, type ButtonOpts } from './button';
import { P } from './palette';
import { plate } from './panel';
import { fitIn, fitWrap, label, MIN_SIZE } from './text';
import { TYPE } from './tokens';

/** The room a card this big gives each of its parts, design units. */
export interface CardBox {
  pad: number;
  /** The width inside the padding: the name, the words and the button all take it. */
  inner: number;
  nameH: number;
  subH: number;
  /** The middle of the small line under the name. */
  subY: number;
  descTop: number;
  descH: number;
  /** The bottom of the note above the button, when the card has one. */
  noteY: number;
  btnH: number;
  btnY: number;
}

const PAD = 16;
/** A note above the button (a sea's condition) takes this share of the card from the words. */
const NOTE = 0.15;

/** Where a card `w` by `h` puts its parts. `wide` is a landscape panel, whose cards are short: the
 *  button gives back some of its height so the words still have room. Exported because the shop's
 *  tutorial pointer has to know where a buy button landed. */
export function cardBox(w: number, h: number, wide: boolean, note = false): CardBox {
  const btnH = Math.min(100, h * (wide ? 0.18 : 0.22));
  const nameH = h * (wide ? 0.23 : 0.2);
  const subH = h * 0.12;
  const descTop = PAD + nameH + subH + h * 0.03;
  const noteY = h - btnH - PAD * 1.5;
  return {
    pad: PAD,
    inner: w - PAD * 2,
    nameH,
    subH,
    subY: PAD + nameH + subH / 2,
    descTop,
    descH: h - descTop - btnH - PAD * 1.5 - (note ? h * NOTE : 0),
    noteY,
    btnH,
    btnY: h - btnH - PAD,
  };
}

export interface CardOpts {
  w: number;
  h: number;
  /** A landscape panel (or a wide portrait one): shorter cards. */
  wide: boolean;
  /** text boost (view/frame.ts). */
  k: number;
  /** The paper: dark once it is spent or owned, gold for a rare card. */
  fill: number;
  /** The edge; brass marks the card the captain is at (the sea sailed). */
  line?: number;
  width?: number;
  name: string;
  /** The small line under the name: a level, a record, the card it pairs with. */
  sub?: string;
  /** The small line says something good (it pairs with a card already owned): chart teal, heavy. */
  subMark?: boolean;
  desc: string;
  /** A picture of what the card does, above its words: players watched on 2026-11-21 read the
   *  name and the price and little else, so the picture has to carry the idea. */
  icon?: ArtName;
  /** A line above the button, in red: what the captain must do first. */
  note?: string;
  /** The button along the bottom. It takes the card's width and the card's size: words at one
   *  size, a bare price at another, so the four kinds of card no longer read at eight. */
  action: Omit<ButtonOpts, 'w' | 'h' | 'size'>;
}

export function card(o: CardOpts): Container {
  const b = cardBox(o.w, o.h, o.wide, o.note !== undefined);
  const box = new Container();
  box.addChild(plate({ x: 0, y: 0, w: o.w, h: o.h }, { fill: o.fill, line: o.line, width: o.width }));
  const name = label(o.name, TYPE.head * o.k, { fill: P.ink, stroke: false, wrap: b.inner });
  fitWrap(name, b.inner, b.nameH);
  name.anchor.set(0.5);
  name.position.set(o.w / 2, b.pad + b.nameH / 2);
  box.addChild(name);
  if (o.sub !== undefined) {
    const sub = label(o.sub, TYPE.small * o.k, { fill: o.subMark ? P.go : P.brassDark, stroke: false, weight: o.subMark ? '800' : undefined });
    // short words in a short box: they keep the smallest readable size rather than shrink away
    fitIn(sub, b.inner, b.subH, MIN_SIZE * o.k);
    sub.anchor.set(0.5);
    sub.position.set(o.w / 2, b.subY);
    box.addChild(sub);
  }
  let descTop = b.descTop;
  let descH = b.descH;
  if (o.icon) {
    // the picture takes the top of the words' room, no wider than the card and never more than
    // half the room, so a short landscape card still has its words
    const h = Math.min(descH * 0.5, b.inner * 0.6 / aspect(o.icon));
    const pic = artSprite(o.icon, h, 0.5, 0);
    if (pic) {
      pic.position.set(o.w / 2, descTop);
      box.addChild(pic);
      descTop += h + 6;
      descH -= h + 6;
    }
  }
  const desc = label(o.desc, TYPE.small * o.k, { fill: P.ink, stroke: false, weight: '600', wrap: b.inner });
  fitWrap(desc, b.inner, descH);
  desc.anchor.set(0.5, 0);
  desc.position.set(o.w / 2, descTop);
  box.addChild(desc);
  if (o.note !== undefined) {
    const note = label(o.note, TYPE.meta * o.k, { fill: P.red, stroke: false, wrap: b.inner });
    fitWrap(note, b.inner, o.h * NOTE);
    note.anchor.set(0.5, 1);
    note.position.set(o.w / 2, b.noteY);
    box.addChild(note);
  }
  const btn = new Button({ ...o.action, w: b.inner, h: b.btnH, size: (o.action.text ? TYPE.lead : TYPE.head) * o.k });
  btn.position.set(b.pad, b.btnY);
  box.addChild(btn);
  return box;
}
