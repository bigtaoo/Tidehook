import { describe, expect, it } from 'vitest';
import { onDesk } from './pointer';

const media = (fine: boolean) => () => ({ matches: fine });

describe('onDesk', () => {
  it("takes the host's word first", () => {
    expect(onDesk({ device: () => 'desktop' }, media(false))).toBe(true);
    expect(onDesk({ device: () => 'mobile' }, media(true))).toBe(false);
    expect(onDesk({ device: () => 'tablet' }, media(true))).toBe(false);
  });

  it('asks the browser without a word from the host', () => {
    expect(onDesk({}, media(true))).toBe(true);
    expect(onDesk({ device: () => null }, media(false))).toBe(false);
    expect(onDesk({ device: () => 'unknown' }, media(true))).toBe(true);
  });

  it('says touch when the browser cannot tell', () => {
    expect(onDesk({})).toBe(false);
    expect(onDesk({}, () => { throw new Error('no'); })).toBe(false);
  });
});
