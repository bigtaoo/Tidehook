// Payments in memory for a dev build (?pay=fake): the remove-ads product on sale at a made-up
// price, bought after a short wait, so the harbour's card and the ad-free path can be seen and
// tested without a host that sells it. Nothing is kept: a reload offers it again.

import type { Payments } from './types';

export function fakePayments(price = '$1.99', waitMs = 600): Payments {
  const owned: string[] = [];
  return {
    owned: async () => [...owned],
    price: async () => price,
    buy: (id) =>
      new Promise((resolve) =>
        setTimeout(() => {
          owned.push(id);
          resolve(true);
        }, waitMs),
      ),
  };
}
