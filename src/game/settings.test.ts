import { describe, expect, it } from 'vitest';
import { StubPlatform } from '../platform/stub';
import { Settings, SETTINGS_KEY, wantsCalm } from './settings';

describe('the settings', () => {
  it('start with everything on but calm motion, and remember a change', () => {
    const p = new StubPlatform();
    const s = new Settings(p.storage);
    expect(s.key).toBe('1110');
    const seen: string[] = [];
    s.onChange = (id) => seen.push(id);
    expect(s.toggle('music')).toBe(false);
    expect(s.toggle('calm')).toBe(true);
    expect(seen).toEqual(['music', 'calm']);
    expect(new Settings(p.storage).key).toBe('0111');
  });

  it('read bad data as the defaults', () => {
    const p = new StubPlatform();
    p.storage.setItem(SETTINGS_KEY, '{"music":"no","sfx":false');
    expect(new Settings(p.storage).key).toBe('1110');
    p.storage.setItem(SETTINGS_KEY, '{"music":"no","sfx":false}');
    expect(new Settings(p.storage).key).toBe('1010');
  });

  it('start calm where the system asks for less motion', () => {
    const p = new StubPlatform();
    expect(new Settings(p.storage, true).key).toBe('1111');
    expect(new Settings(null, true).get('calm')).toBe(true);
  });

  it("let the player's own choice outlive the system's", () => {
    const p = new StubPlatform();
    expect(new Settings(p.storage, true).toggle('calm')).toBe(false);
    expect(new Settings(p.storage, true).get('calm')).toBe(false);
    expect(new Settings(p.storage, false).get('calm')).toBe(false);
  });
});

describe('wantsCalm', () => {
  const win = (matches: boolean) => ({ matchMedia: (q: string) => ({ matches: matches && q.includes('reduce') }) }) as unknown as Window;

  it('reads the system preference', () => {
    expect(wantsCalm(win(true))).toBe(true);
    expect(wantsCalm(win(false))).toBe(false);
  });

  it('settles for the motion where nothing can answer', () => {
    expect(wantsCalm(undefined)).toBe(false);
    expect(wantsCalm({})).toBe(false);
    expect(
      wantsCalm({
        matchMedia: () => {
          throw new Error('blocked');
        },
      } as unknown as Window),
    ).toBe(false);
  });
});
