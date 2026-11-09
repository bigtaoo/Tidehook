// The winch's ratchet while the hook is reeled in: one click every CLICK_LEN of rope wound, so it
// follows the reel speed (winch upgrades, weight, game speed) by itself, and it drops in pitch as
// the load grows, after the sim's own drag (sim/hook.ts).

import { B } from '../sim/balance';
import { FP } from '../sim/math/fixed';
import { grabWeight } from '../sim/hook';
import type { World } from '../sim/world';

/** World units of rope per click. */
export const CLICK_LEN = 22;
/** The lowest playback rate, for the heaviest loads. */
const MIN_RATE = 0.62;

export class ReelClock {
  private last = -1;
  private wound = 0;

  /** Called once a frame. The playback rate of a click due now, or 0 for none. */
  update(w: World, running: boolean): number {
    const h = w.hook;
    if (!running || h.st !== 'back') {
      this.last = -1;
      this.wound = 0;
      return 0;
    }
    const len = h.len / FP;
    if (this.last >= 0) this.wound += Math.max(0, this.last - len);
    this.last = len;
    if (this.wound < CLICK_LEN) return 0;
    this.wound %= CLICK_LEN;
    return reelRate(w);
  }
}

/** The click's playback rate for what the hook carries: 1 when empty, lower as it gets heavier. */
export function reelRate(w: World): number {
  let wt = 0;
  for (const g of w.hook.grabs) wt += grabWeight(w, g);
  const drag = 1 + (B.hook.weightDrag * wt) / 1000;
  return Math.max(MIN_RATE, 1 / Math.sqrt(drag));
}
