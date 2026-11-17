// The remove-ads purchase (docs/01-tech-plan.md section 9): one permanent product, bought once,
// that turns the interstitials off for good. Rewarded ads stay, because the player asks for those
// and they pay out. It is offered only where the host takes payments and its catalog prices the
// product (described in the developer console under the same id); ownership is read from the host
// on every launch, never kept in the save, so it follows the player's account, not the device. A
// read that never answers leaves what the player owns unknown rather than settled, and the game
// asks again on the next way into the harbour: the one failure that costs a paying player
// something is the one where the game decides, quietly, that they own nothing.

import type { Payments } from '../platform/types';
import type { Mode } from './session';

/** The product's id, in the Bridge config (vite.playgama.config.js) and the developer console. */
export const NO_ADS = 'remove_ads';

/** none: not for sale here; offer: on sale at `price`; owned: bought. */
export type NoAdsState = 'none' | 'offer' | 'owned';

/** How many times a session asks the host again after a read that never answered. */
const TRIES = 3;

export class NoAds {
  state: NoAdsState = 'none';
  /** The price as the host words it, in the player's currency. */
  price = '';
  /** A purchase is on its way. */
  busy = false;
  /** The host never answered what the player owns, so 'none' is a guess, not a fact. */
  private unknown = false;
  private asking = false;
  private tries = 0;
  private wasLobby = false;

  constructor(private readonly pay: Payments | null) {}

  /** Reads what the player owns and the price. Never rejects. */
  async load(): Promise<void> {
    if (!this.pay || this.asking) return;
    this.asking = true;
    this.tries++;
    try {
      const [owned, price] = await Promise.all([this.pay.owned(), this.pay.price(NO_ADS)]);
      this.price = price;
      this.state = owned.includes(NO_ADS) ? 'owned' : price ? 'offer' : 'none';
      this.unknown = false;
    } catch {
      this.state = 'none';
      this.unknown = true;
    } finally {
      this.asking = false;
    }
  }

  /** Once a frame: asks again on the way into the harbour where the boot read never answered (a
   *  player who opened the game with no line to the host). Until it answers, someone who has paid
   *  to be rid of the interstitials is shown them, and the card they bought is not even on the
   *  shelf. A few asks a session, each on a fresh walk into the harbour, not a drumbeat. */
  frame(mode: Mode): void {
    const lobby = mode === 'lobby';
    if (lobby && !this.wasLobby && this.unknown && this.tries < TRIES) void this.load();
    this.wasLobby = lobby;
  }

  get owned(): boolean {
    return this.state === 'owned';
  }

  /** Buys it, from the player's press on the harbour's card; true once bought.
   *
   *  A buy that does not come back as bought is not word that nothing was bought. The host answers
   *  the same way for a player who backed out and for a payment whose answer was lost on the way
   *  home - the popup closed on itself, the call timed out, the frame was reloaded - and in the
   *  second case the money is gone. So the host is asked what the player owns before the game
   *  settles on nothing: a cancel costs one quick read, and a lost answer would otherwise leave a
   *  paying player with the interstitials still running and the card still on the shelf, priced,
   *  for them to buy a second time. */
  async buy(): Promise<boolean> {
    if (this.state !== 'offer' || this.busy || !this.pay) return false;
    this.busy = true;
    try {
      let bought = false;
      try {
        bought = await this.pay.buy(NO_ADS);
      } catch {
        /* lost, which is not the same as refused: the read below decides */
      }
      if (!bought) bought = await this.owns(this.pay);
      if (bought) this.state = 'owned';
      return bought;
    } finally {
      this.busy = false;
    }
  }

  /** Whether the host says the player owns it; false when it will not say. */
  private async owns(pay: Payments): Promise<boolean> {
    try {
      return (await pay.owned()).includes(NO_ADS);
    } catch {
      return false;
    }
  }
}
