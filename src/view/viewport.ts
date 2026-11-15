// The design is 1080x1920 in portrait and 1920x1080 in landscape (docs/01-tech-plan.md section
// 4), fitted whole inside the screen. A screen of another shape grows the design along the side
// it has to spare instead of being letterboxed: one stubbier than 9:16 (a square embed, a
// tablet) widens it across the lane, up to PORTRAIT_MAX_W, so the bars and panels use the room
// the lane cannot, and one longer than 9:16 (every phone made this decade) lengthens it along
// the lane, up to DESIGN_MAX_ALONG, which the lane itself takes. After Potion Siege's viewport.

export const DESIGN_SHORT = 1080;
export const DESIGN_LONG = 1920;
/** The widest design across the lane: 3:4 in portrait. Past this the bars are all the screen is,
 *  so the rest of a very stubby screen is left as sea. */
export const PORTRAIT_MAX_W = 1440;
/** The longest design along the lane: 21:9, as long as a phone is made. */
export const DESIGN_MAX_ALONG = 2520;

export interface Fit {
  /** Landscape: the dock on the left and the sidebar on the right. */
  wide: boolean;
  /** The design's size in design units. */
  w: number;
  h: number;
  /** Screen pixels per design unit. */
  scale: number;
  /** Screen position of the design's top-left corner. */
  x: number;
  y: number;
}

/** Landscape once the screen is clearly wider than tall; a square-ish screen stays portrait. */
export function isWide(screenW: number, screenH: number): boolean {
  return screenW >= screenH * 1.1;
}

export function fitDesign(screenW: number, screenH: number): Fit {
  // a page with no size yet (a portal's iframe at boot) gets the design at scale 1, never NaN
  if (!(screenW > 0 && screenH > 0)) return { wide: false, w: DESIGN_SHORT, h: DESIGN_LONG, scale: 1, x: 0, y: 0 };
  const wide = isWide(screenW, screenH);
  const along = wide ? screenW : screenH;
  const across = wide ? screenH : screenW;
  // the screen is either longer than 9:16 or stubbier, so only one of these two leaves its floor
  const lenAlong = Math.min(DESIGN_MAX_ALONG, Math.max(DESIGN_LONG, Math.round((DESIGN_SHORT * along) / across)));
  const lenAcross = Math.min(PORTRAIT_MAX_W, Math.max(DESIGN_SHORT, Math.round((DESIGN_LONG * across) / along)));
  const w = wide ? lenAlong : lenAcross;
  const h = wide ? lenAcross : lenAlong;
  const scale = Math.min(screenW / w, screenH / h);
  return { wide, w, h, scale, x: (screenW - w * scale) / 2, y: (screenH - h * scale) / 2 };
}

/** Whether two fits put the design in the same place at the same size. Pixi fires a resize event
 *  for every one the window reports, changed or not, so the scene asks this before rebuilding. */
export function sameFit(a: Fit | null, b: Fit): boolean {
  return a !== null && a.wide === b.wide && a.w === b.w && a.h === b.h && a.scale === b.scale && a.x === b.x && a.y === b.y;
}

/** How much small words grow in a small embed: at 800x450 the design is at 0.42 of its size and
 *  48-unit words come out 20 pixels tall. 1 from 1280x720 up. In portrait only as far as the
 *  design widened (a phone's narrow bars have no room to grow into): a 600x600 square, 1.33. */
export function textBoost(fit: Pick<Fit, 'wide' | 'scale' | 'w'>): number {
  if (fit.wide) return Math.min(1.5, Math.max(1, 0.6 / fit.scale));
  return Math.min(fit.w / DESIGN_SHORT, Math.max(1, 0.45 / fit.scale));
}
