import { describe, expect, it } from 'vitest';
import { LANE_LEN, LANE_WIDTH } from '../sim/lane';
import { fieldFor, LANDSCAPE_SIDE, PORTRAIT_BOTTOM, PORTRAIT_HINT, PORTRAIT_TOP, toDesign, toLane } from './orient';
import { DESIGN_LONG, DESIGN_MAX_ALONG, DESIGN_SHORT, fitDesign, isWide, PORTRAIT_MAX_W, textBoost } from './viewport';

describe('fitDesign', () => {
  it('picks the orientation from the screen and fits the design whole', () => {
    for (const [sw, sh, wide] of [[390, 844, false], [844, 390, true], [768, 1024, false], [1280, 720, true], [800, 450, true]] as const) {
      const f = fitDesign(sw, sh);
      expect(f.wide).toBe(wide);
      expect(f.w * f.scale).toBeLessThanOrEqual(sw + 1e-6);
      expect(f.h * f.scale).toBeLessThanOrEqual(sh + 1e-6);
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps a square-ish screen in portrait and survives a zero-size iframe', () => {
    expect(isWide(1000, 1000)).toBe(false);
    expect(isWide(1100, 1000)).toBe(true);
    expect(fitDesign(0, 0)).toMatchObject({ scale: 1, wide: false });
    expect(Number.isFinite(fitDesign(NaN, 300).scale)).toBe(true);
  });

  it('boosts words only in small embeds, in portrait as far as the design widened', () => {
    expect(textBoost(fitDesign(1280, 720))).toBe(1);
    expect(textBoost(fitDesign(800, 450))).toBeGreaterThan(1);
    expect(textBoost(fitDesign(390, 844))).toBe(1);
    expect(textBoost(fitDesign(768, 1024))).toBe(1);
    expect(textBoost(fitDesign(600, 600))).toBeCloseTo(PORTRAIT_MAX_W / DESIGN_SHORT);
  });

  it('widens the portrait design for a square-ish screen, never past 3:4', () => {
    expect(fitDesign(390, 844).w).toBe(DESIGN_SHORT);
    expect(fitDesign(600, 600).w).toBe(PORTRAIT_MAX_W);
    const f = fitDesign(700, 1000);
    expect(f.w).toBe(1344);
    expect(f.h).toBe(DESIGN_LONG);
    const field = fieldFor(false, f.w, f.h);
    expect(field.x + field.w / 2).toBeCloseTo(f.w / 2);
  });

  it('lengthens the design for a screen longer than 9:16 rather than letterboxing it', () => {
    for (const [sw, sh] of [[375, 812], [390, 844], [412, 915], [812, 375]] as const) {
      const f = fitDesign(sw, sh);
      // all but a pixel of the screen is design: a phone is left no black band either way
      expect(Math.min(sw - f.w * f.scale, sh - f.h * f.scale)).toBeLessThan(1);
      expect(Math.min(f.w, f.h)).toBe(DESIGN_SHORT);
      expect(Math.max(f.w, f.h)).toBeLessThanOrEqual(DESIGN_MAX_ALONG);
    }
  });

  it('stops lengthening past 21:9, so a freak screen keeps sea at its ends', () => {
    expect(fitDesign(400, 1600).h).toBe(DESIGN_MAX_ALONG);
  });

  it('spends the length a tall phone adds on the lane', () => {
    const f = fitDesign(390, 844);
    const lane = fieldFor(false, f.w, f.h);
    expect((lane.w * f.scale) / 390).toBeGreaterThan(0.9);
    expect((lane.h * f.scale) / 844).toBeGreaterThan(0.7);
  });
});

describe('orient', () => {
  it('puts the dock at the bottom in portrait and on the left in landscape', () => {
    const p = fieldFor(false);
    const dockP = toDesign(p, 0, LANE_WIDTH / 2);
    const farP = toDesign(p, LANE_LEN, LANE_WIDTH / 2);
    expect(dockP.y).toBeGreaterThan(farP.y);
    expect(dockP.x).toBeCloseTo(DESIGN_SHORT / 2);

    const l = fieldFor(true);
    const dockL = toDesign(l, 0, LANE_WIDTH / 2);
    const farL = toDesign(l, LANE_LEN, LANE_WIDTH / 2);
    expect(dockL.x).toBeLessThan(farL.x);
    expect(dockL.y).toBeCloseTo(DESIGN_SHORT / 2);
  });

  it('keeps the lane clear of the bars and of the hint band', () => {
    const p = fieldFor(false);
    expect(p.y).toBeGreaterThanOrEqual(PORTRAIT_TOP + PORTRAIT_HINT);
    expect(p.y + p.h).toBeLessThanOrEqual(DESIGN_LONG - PORTRAIT_BOTTOM + 1e-6);
    expect(p.x).toBeGreaterThanOrEqual(0);
    const l = fieldFor(true);
    expect(l.x + l.w).toBeLessThanOrEqual(DESIGN_LONG - LANDSCAPE_SIDE + 1e-6);
    expect(l.y).toBeGreaterThanOrEqual(0);
    expect(l.y + l.h).toBeLessThanOrEqual(DESIGN_SHORT + 1e-6);
  });

  it('turns a tap back into the lane point it shows', () => {
    for (const wide of [false, true]) {
      const f = fieldFor(wide);
      for (const [d, w] of [[0, 0], [123.5, 77], [LANE_LEN, LANE_WIDTH]]) {
        const s = toDesign(f, d, w);
        const back = toLane(f, s.x, s.y);
        expect(back.d).toBeCloseTo(d);
        expect(back.w).toBeCloseTo(w);
      }
    }
  });
});
