// The harbour's codex tab (docs/04-content.md section 3.10): every monster of the sea, each drawn
// with how many the captain has sunk over all their games, and the gold fish landed. One not met
// yet is a dark shape with no name, something to sail out for, with the pearls the first one sunk brings
// (game/meta/harbour.ts logGame).

import { Container } from 'pixi.js';
import type { Harbour } from '../../game/meta/harbour';
import { t, type TextKey } from '../../i18n';
import type { MonsterKind } from '../../sim/balance';
import { BF } from '../../sim/balanceFun';
import { sunkKey } from '../../sim/goals';
import { artSprite } from '../art';
import { P } from '../kit/palette';
import { tile } from '../kit/panel';
import { MIN_SIZE, fitIn, fitWrap, label } from '../kit/text';
import { SPACE, TYPE } from '../kit/tokens';
import { monsterArt } from '../scene/look';
import type { Rect } from './frame';

const GAP = 14;
const HEAD = 54;
/** The order the sea brings them in, the bosses last. */
const KINDS: readonly MonsterKind[] = ['grunt', 'darter', 'brute', 'glutton', 'hermit', 'ray', 'puffer', 'moray', 'boss', 'kraken'];
/** A kind not met yet: its sprite drawn as a shadow. */
const SHADOW = 0x1c2238;

/** The codex in `r`: a count of kinds met, then a tile per kind and one for the gold fish. */
export function drawCodex(h: Harbour, r: Rect, k: number, wide: boolean): Container {
  const box = new Container();
  const sunk = (kind: MonsterKind) => h.totals[sunkKey(kind)] ?? 0;
  const met = KINDS.filter((kind) => sunk(kind) > 0).length;
  const head = label(t('codex.head', { n: met, max: KINDS.length }), TYPE.lead * k, { fill: P.brassLight, weight: '700' });
  fitIn(head, r.w, HEAD);
  head.anchor.set(0.5);
  head.position.set(r.x + r.w / 2, r.y + HEAD / 2);
  box.addChild(head);
  const tiles = KINDS.length + 1;
  const cols = wide ? Math.ceil(tiles / 2) : 4;
  const rows = Math.ceil(tiles / cols);
  const top = r.y + HEAD + GAP;
  const tw = (r.w - GAP * (cols - 1)) / cols;
  const th = (r.h - HEAD - GAP - GAP * (rows - 1)) / rows;
  const at = (i: number) => ({ x: r.x + (i % cols) * (tw + GAP), y: top + Math.floor(i / cols) * (th + GAP) });
  KINDS.forEach((kind, i) => {
    const n = sunk(kind);
    const { art, tint } = monsterArt(kind, false);
    const p = at(i);
    box.addChild(kindTile(p.x, p.y, tw, th, k, art, n > 0 ? tint : SHADOW, n > 0 ? t(`monsters.${kind}.name` as TextKey) : t('codex.unseen'), n > 0 ? t('codex.sunk', { n }) : t('codex.reward', { n: BF.codex.pearls })));
  });
  const golds = h.totals.golds ?? 0;
  const p = at(KINDS.length);
  box.addChild(kindTile(p.x, p.y, tw, th, k, 'fish_gold', golds > 0 ? 0xffffff : SHADOW, t('codex.golds', { n: golds }), ''));
  return box;
}

/** One tile: the sprite, its name and the count under it. The words took the room the picture
 *  left over and were shrunk away to nothing on a phone - "sunk 12" came out four pixels tall.
 *  The two lines keep their own band of the tile now, and the count stops at the smallest a phone
 *  can read (kit/text.ts MIN_SIZE): where it no longer fits, the layout sweep says so. */
function kindTile(x: number, y: number, w: number, h: number, k: number, art: Parameters<typeof artSprite>[0], tint: number, name: string, count: string): Container {
  const box = new Container();
  box.addChild(tile({ x, y, w, h }, P.paper));
  const pad = SPACE.tight - 4;
  const textH = h * 0.4;
  const pic = artSprite(art, Math.min(h - textH - pad * 2, w - pad * 2) * 0.9, 0.5, 0.5);
  if (pic) {
    pic.tint = tint;
    pic.position.set(x + w / 2, y + pad + (h - textH - pad) / 2);
    box.addChild(pic);
  }
  const room = w - pad * 2;
  const said = label(name, TYPE.small * k, { fill: P.ink, stroke: false, weight: '700', wrap: room });
  fitWrap(said, room, count ? textH * 0.5 : textH * 0.9);
  said.anchor.set(0.5);
  said.position.set(x + w / 2, y + h - textH + (count ? textH * 0.26 : textH * 0.45));
  box.addChild(said);
  if (count) {
    const c = label(count, TYPE.meta * k, { fill: P.brassDark, stroke: false, weight: '700' });
    fitIn(c, room, textH * 0.42, MIN_SIZE * k);
    c.anchor.set(0.5);
    c.position.set(x + w / 2, y + h - textH * 0.24);
    box.addChild(c);
  }
  return box;
}
