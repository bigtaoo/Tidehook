// The remove-ads purchase (docs/01-tech-plan.md section 9): one permanent product, bought once,
// that turns the interstitials off for good. Rewarded ads stay, because the player asks for those
// and they pay out. It is offered only where the host takes payments and its catalog prices the
// product (described in the developer console under the same id); ownership is read from the host
// on every launch, never kept in the save, so it follows the player's account, not the device.

import type { Payments } from '../platform/types';

/** The product's id, in the Bridge config (vite.playgama.config.js) and the developer console. */
export const NO_ADS = 'remove_ads';

/** none: not for sale here; offer: on sale at `price`; owned: bought. */
export type NoAdsState = 'none' | 'offer' | 'owned';

export class NoAds {
  state: NoAdsState = 'none';
  /** The price as the host words it, in the player's currency. */
  price = '';
  /** A purchase is on its way. */
  busy = false;

  constructor(private readonly pay: Payments | null) {}

  /** Reads what the player owns and the price, once at boot. Never rejects. */
  async load(): Promise<void> {
    if (!this.pay) return;
    try {
      const [owned, price] = await Promise.all([this.pay.owned(), this.pay.price(NO_ADS)]);
      this.price = price;
      this.state = owned.includes(NO_ADS) ? 'owned' : price ? 'offer' : 'none';
    } catch {
      this.state = 'none';
    }
  }

  get owned(): boolean {
    return this.state === 'owned';
  }

  /** Buys it, from the player's press on the harbour's card; true once bought. */
  async buy(): Promise<boolean> {
    if (this.state !== 'offer' || this.busy || !this.pay) return false;
    this.busy = true;
    try {
      if (!(await this.pay.buy(NO_ADS))) return false;
      this.state = 'owned';
      return true;
    } catch {
      return false;
    } finally {
      this.busy = false;
    }
  }
}
