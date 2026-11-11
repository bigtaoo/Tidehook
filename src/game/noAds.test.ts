import { describe, expect, it } from 'vitest';
import { StubPlatform } from '../platform/stub';
import { SafeStore, type Payments } from '../platform/types';
import { Ads } from './ads';
import { Guide } from './guide/guide';
import { saveGuide } from './guide/store';
import { Harbour } from './meta/harbour';
import { NO_ADS, NoAds } from './noAds';
import { Session } from './session';

/** Payments that own `owned`, price the product at `price` and answer a purchase with `pays`. */
function pay(owned: string[] = [], price = '$1.99', pays = true): Payments & { bought: string[] } {
  const bought: string[] = [];
  return {
    bought,
    owned: async () => owned,
    price: async (id) => (id === NO_ADS ? price : ''),
    buy: async (id) => {
      if (pays) bought.push(id);
      return pays;
    },
  };
}

describe('NoAds', () => {
  it('is not for sale without payments or without a price in the catalog', async () => {
    const none = new NoAds(null);
    await none.load();
    expect([none.state, await none.buy()]).toEqual(['none', false]);
    const unpriced = new NoAds(pay([], ''));
    await unpriced.load();
    expect(unpriced.state).toBe('none');
  });

  it('offers it at the host price and owns it once bought, only once', async () => {
    const p = pay();
    const n = new NoAds(p);
    await n.load();
    expect([n.state, n.price, n.owned]).toEqual(['offer', '$1.99', false]);
    const first = n.buy();
    expect(n.busy).toBe(true);
    expect(await n.buy()).toBe(false);
    expect(await first).toBe(true);
    expect([n.state, n.busy, p.bought]).toEqual(['owned', false, [NO_ADS]]);
    expect(await n.buy()).toBe(false);
  });

  it('reads ownership from the host on launch, and stays on offer when the player backs out', async () => {
    const owned = new NoAds(pay([NO_ADS], ''));
    await owned.load();
    expect(owned.owned).toBe(true);
    const back = new NoAds(pay([], '$1.99', false));
    await back.load();
    expect([await back.buy(), back.state]).toEqual([false, 'offer']);
    const broken = new NoAds({ owned: () => Promise.reject(new Error('x')), price: async () => '$1', buy: async () => true });
    await broken.load();
    expect(broken.state).toBe('none');
  });

  it('turns the interstitials off once owned and leaves the rewarded ads', async () => {
    const store = new SafeStore(null);
    saveGuide(store, { done: [], games: 5, shops: 0 });
    const p = new StubPlatform();
    p.ads = 'reward';
    const s = new Session({ seed: 3, speed: 1, autoplay: null }, new Guide(store), new Harbour(store));
    const ads = new Ads(p, s);
    const n = new NoAds(pay([NO_ADS]));
    await n.load();
    ads.adFree = () => n.owned;
    s.start();
    s.world.phase = 'shop';
    ads.frame([{ e: 'waveClear', wave: 1 }]);
    await Promise.resolve();
    expect([s.hold, p.calls.includes('midgame'), ads.freeReroll()]).toEqual([false, false, true]);
    n.state = 'offer';
    ads.frame([{ e: 'waveClear', wave: 2 }]);
    expect(p.calls).toContain('midgame');
  });
});
