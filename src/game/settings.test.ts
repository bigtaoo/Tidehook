import { describe, expect, it } from 'vitest';
import { StubPlatform } from '../platform/stub';
import type { SimEvent } from '../sim/events';
import { Haptics } from './haptics';
import { Settings, SETTINGS_KEY } from './settings';

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
});

describe('the buzz', () => {
  const kill = (kind: 'boss' | 'grunt'): SimEvent => ({ e: 'kill', id: 1, kind, crushed: false, d: 0, w: 0 });
  const coins: SimEvent = { e: 'coins', amount: 3, spat: false };

  it('buzzes big moments always and small ones not too often', () => {
    const got: (number | number[])[] = [];
    let on = true;
    const h = new Haptics((p) => got.push(p), () => on);
    expect(h.events([coins], 0)).toBe(12);
    expect(h.events([coins], 50)).toBeNull();
    expect(h.events([kill('boss')], 60)).toEqual([60, 40, 90]);
    expect(h.events([kill('grunt')], 500)).toBeNull();
    expect(h.events([{ e: 'coins', amount: 1, spat: true }], 900)).toBeNull();
    on = false;
    expect(h.events([{ e: 'leak', kind: 'grunt', dmg: 1 }], 2000)).toBeNull();
    expect(got.length).toBe(2);
  });

  it('does nothing on a device without it', () => {
    const h = new Haptics(null, () => true);
    expect(h.able).toBe(false);
    expect(h.events([kill('boss')], 0)).toBeNull();
  });
});
