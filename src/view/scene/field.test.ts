// The sea beyond the lane (field.ts beyondBox): the world is a fixed 800x480, so most screens
// leave room the lane cannot take. Whatever is left over has to be water, never a bare band.
import { describe, expect, it } from 'vitest';
import { LANE_LEN } from '../../sim/lane';
import { fieldFor } from '../orient';
import { fitDesign } from '../viewport';
import { bandRect, beyondBox } from './field';

/** The lane's rectangle on a screen of this size, with the design it is laid out in. */
function laneOn(sw: number, sh: number) {
  const fit = fitDesign(sw, sh);
  return { fit, lane: bandRect(fieldFor(fit.wide, fit.w, fit.h), 0, LANE_LEN) };
}

const SIZES: [number, number][] = [
  [390, 844],
  [844, 390],
  [768, 1024],
  [1280, 720],
  [600, 600],
  [375, 812],
];

describe('the sea beyond the lane', () => {
  it('covers the whole design, on every screen the lane cannot fill', () => {
    for (const [sw, sh] of SIZES) {
      const { fit, lane } = laneOn(sw, sh);
      const b = beyondBox(lane, fit.w, fit.h);
      expect(b.x).toBeLessThanOrEqual(0);
      expect(b.y).toBeLessThanOrEqual(0);
      expect(b.x + b.w).toBeGreaterThanOrEqual(fit.w);
      expect(b.y + b.h).toBeGreaterThanOrEqual(fit.h);
    }
  });

  it('keeps the chart in shape, so the water around it is the same sea', () => {
    for (const [sw, sh] of SIZES) {
      const { fit, lane } = laneOn(sw, sh);
      const b = beyondBox(lane, fit.w, fit.h);
      expect(b.w / b.h).toBeCloseTo(lane.w / lane.h, 5);
    }
  });

  it('never shrinks under the lane, which is drawn over it', () => {
    const { fit, lane } = laneOn(390, 844);
    const b = beyondBox(lane, fit.w, fit.h);
    expect(b.w).toBeGreaterThanOrEqual(lane.w);
    expect(b.h).toBeGreaterThanOrEqual(lane.h);
  });

  it('blows the chart up most where the screen is the wrong shape for the lane', () => {
    const phone = laneOn(390, 844);
    const tablet = laneOn(768, 1024);
    const grow = (o: ReturnType<typeof laneOn>) => beyondBox(o.lane, o.fit.w, o.fit.h).w / o.lane.w;
    expect(grow(tablet)).toBeGreaterThan(grow(phone));
  });
});
