// The grey-box scene: the lane's water bands, the dock and the crane as flat shapes, and the bars
// where the HUD and the shop will go. Drawn once per layout (a resize, a turn of the phone).

import { Container, Graphics, Text } from 'pixi.js';
import { t } from '../i18n';
import { LANE_LEN, LANE_WIDTH } from '../sim/lane';
import { P, SEA, TEXT_STROKE } from './kit/palette';
import { fieldFor, LANDSCAPE_SIDE, PORTRAIT_BOTTOM, PORTRAIT_TOP, toDesign, type Field } from './orient';
import type { Fit } from './viewport';

/** The bands by distance from the dock, in world units. The dock is the prototype's TOP strip;
 *  the water splits goldVal's distance range (prototype/v2.html) into thirds, so a band is a
 *  price step. M1 moves these into balance.json beside goldVal. */
export const BANDS: readonly { from: number; to: number; color: number }[] = [
  { from: 0, to: 112, color: P.wood },
  { from: 112, to: 371, color: SEA.shallow },
  { from: 371, to: 561, color: SEA.mid },
  { from: 561, to: LANE_LEN, color: SEA.far },
];
/** Where the crane stands, in world units (the prototype's OX, OY). */
export const CRANE = { d: 74, w: LANE_WIDTH / 2 };

const FONT = 'system-ui, "Microsoft YaHei", "PingFang SC", sans-serif';

/** A lane rectangle from distance d0 to d1, across the whole width, in design units. */
function bandRect(f: Field, d0: number, d1: number): { x: number; y: number; w: number; h: number } {
  const a = toDesign(f, d0, 0);
  const b = toDesign(f, d1, LANE_WIDTH);
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

function label(text: string, size: number): Text {
  return new Text({
    text,
    style: { fontFamily: FONT, fontWeight: '800', fontSize: size, fill: P.cream, stroke: { color: TEXT_STROKE, width: size / 6 } },
  });
}

/** The whole design for one layout, in design units; the caller places and scales it. */
export function drawGreybox(fit: Fit): Container {
  const root = new Container();
  const f = fieldFor(fit.wide);
  const g = new Graphics();
  root.addChild(g);

  for (const b of BANDS) {
    const r = bandRect(f, b.from, b.to);
    g.rect(r.x, r.y, r.w, r.h).fill(b.color);
  }
  for (const b of BANDS.slice(1)) {
    const r = bandRect(f, b.from, b.from);
    g.rect(r.x - 2, r.y - 2, Math.max(r.w, 4), Math.max(r.h, 4)).fill(SEA.seam);
  }
  const lane = bandRect(f, 0, LANE_LEN);
  g.rect(lane.x, lane.y, lane.w, lane.h).stroke({ color: P.line, width: 6 });

  // the crane: a brass hub and a rope hanging toward the sea
  const hub = toDesign(f, CRANE.d, CRANE.w);
  const tip = toDesign(f, CRANE.d + 160, CRANE.w);
  g.moveTo(hub.x, hub.y).lineTo(tip.x, tip.y).stroke({ color: P.rope, width: 8 });
  g.circle(tip.x, tip.y, 18).fill(P.brassDark).stroke({ color: P.line, width: 5 });
  g.circle(hub.x, hub.y, 46).fill(P.brass).stroke({ color: P.line, width: 7 });

  // the bars: HUD and shop (portrait: top and bottom; landscape: one sidebar on the right)
  const bars = fit.wide
    ? [{ x: fit.w - LANDSCAPE_SIDE, y: 0, w: LANDSCAPE_SIDE, h: fit.h }]
    : [
        { x: 0, y: 0, w: fit.w, h: PORTRAIT_TOP },
        { x: 0, y: fit.h - PORTRAIT_BOTTOM, w: fit.w, h: PORTRAIT_BOTTOM },
      ];
  for (const r of bars) g.roundRect(r.x + 12, r.y + 12, r.w - 24, r.h - 24, 28).fill(P.woodDark).stroke({ color: P.line, width: 6 });

  const title = label(t('title'), 64);
  title.anchor.set(0.5);
  title.position.set(bars[0].x + bars[0].w / 2, fit.wide ? 110 : PORTRAIT_TOP / 2);
  const hint = label(t('boot.tapToStart'), 52);
  hint.anchor.set(0.5);
  const mid = toDesign(f, (BANDS[1].from + BANDS[1].to) / 2, LANE_WIDTH / 2);
  hint.position.set(mid.x, mid.y);
  root.addChild(title, hint, pauseButton(fit));
  return root;
}

/** The pause button, on screen from the first frame: portals swallow Esc (docs/01 section 5). */
function pauseButton(fit: Fit): Graphics {
  const size = 96;
  const b = new Graphics();
  b.roundRect(0, 0, size, size, 24).fill(P.brass).stroke({ color: P.line, width: 6 });
  b.rect(30, 26, 12, 44).fill(P.line);
  b.rect(54, 26, 12, 44).fill(P.line);
  b.position.set(fit.w - size - (fit.wide ? 40 : 30), fit.wide ? fit.h - size - 40 : (PORTRAIT_TOP - size) / 2);
  b.eventMode = 'static';
  b.cursor = 'pointer';
  b.label = 'pause';
  return b;
}
