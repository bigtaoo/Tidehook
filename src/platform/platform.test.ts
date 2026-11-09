import { describe, expect, it } from 'vitest';
import { StubPlatform } from './stub';
import { SafeStore } from './types';

describe('SafeStore', () => {
  it('reads back what it wrote, from memory when the real store throws', () => {
    const broken = {
      getItem: (): string | null => {
        throw new Error('denied');
      },
      setItem: (): void => {
        throw new Error('denied');
      },
    };
    const s = new SafeStore(broken);
    expect(s.getItem('k')).toBeNull();
    s.setItem('k', 'v');
    expect(s.getItem('k')).toBe('v');
  });

  it('prefers the real store', () => {
    const real = new Map<string, string>([['k', 'disk']]);
    const s = new SafeStore({ getItem: (k) => real.get(k) ?? null, setItem: (k, v) => void real.set(k, v) });
    expect(s.getItem('k')).toBe('disk');
    s.setItem('k', 'new');
    expect(real.get('k')).toBe('new');
  });
});

describe('StubPlatform', () => {
  it('pays a rewarded ad only when told to', async () => {
    const p = new StubPlatform();
    expect(p.rewardedAvailable()).toBe(false);
    expect(await p.rewarded(() => {})).toBe(false);
    p.ads = 'reward';
    let started = false;
    expect(await p.rewarded(() => (started = true))).toBe(true);
    expect(started).toBe(true);
    p.ads = 'skip';
    expect(await p.rewarded(() => {})).toBe(false);
  });

  it('passes the host mute on to listeners', () => {
    const p = new StubPlatform();
    const seen: boolean[] = [];
    p.onHostMute((m) => seen.push(m));
    p.mute(true);
    expect(seen).toEqual([false, true]);
  });
});
