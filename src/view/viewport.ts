// The design is 1080x1920 in portrait and 1920x1080 in landscape (docs/01-tech-plan.md section
// 4), fitted whole inside the screen; the rest is filled with sea. After Potion Siege's viewport.

export const DESIGN_SHORT = 1080;
export const DESIGN_LONG = 1920;

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
  const w = wide ? DESIGN_LONG : DESIGN_SHORT;
  const h = wide ? DESIGN_SHORT : DESIGN_LONG;
  const scale = Math.min(screenW / w, screenH / h);
  return { wide, w, h, scale, x: (screenW - w * scale) / 2, y: (screenH - h * scale) / 2 };
}

/** How much small words grow in a small landscape embed: at 800x450 the design is at 0.42 of its
 *  size and 48-unit words come out 20 pixels tall. 1 from 1280x720 up, and always 1 in portrait,
 *  where a phone's narrow bars have no room to grow into. */
export function textBoost(fit: Pick<Fit, 'wide' | 'scale'>): number {
  return fit.wide ? Math.min(1.5, Math.max(1, 0.6 / fit.scale)) : 1;
}
