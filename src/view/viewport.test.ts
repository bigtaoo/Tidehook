import { describe, expect, it } from 'vitest';
import { fitDesign, sameFit } from './viewport';

describe('sameFit', () => {
  it('says yes to the same screen twice: Pixi reports a resize that resized nothing', () => {
    expect(sameFit(fitDesign(390, 844), fitDesign(390, 844))).toBe(true);
  });

  it('says no the first time, with no scene built yet', () => {
    expect(sameFit(null, fitDesign(390, 844))).toBe(false);
  });

  it('says no to a phone that turned, and to an address bar that slid away', () => {
    expect(sameFit(fitDesign(390, 844), fitDesign(844, 390))).toBe(false);
    expect(sameFit(fitDesign(390, 844), fitDesign(390, 900))).toBe(false);
    expect(sameFit(fitDesign(390, 844), fitDesign(391, 844))).toBe(false);
  });

  it('says no while the page still has no size', () => {
    // fitDesign hands back the design at scale 1 for a 0x0 iframe; the real size that follows is a
    // different fit, so the scene is built again rather than left at the guess
    expect(sameFit(fitDesign(0, 0), fitDesign(390, 844))).toBe(false);
    expect(sameFit(fitDesign(0, 0), fitDesign(0, 0))).toBe(true);
  });
});
