// Clearing a Graphics re-tessellates it, even when it had nothing on it and draws nothing after
// (measured: about 0.05 ms a frame per layer, and the game has three that stand empty for whole
// seas — the bay has no weather, a full dock no alarm, a quiet lane no rings). This tracks whether
// a layer has anything to show, so one that is empty frame after frame is left alone.

export class Redraw {
  private busy = false;

  /** True when the layer must be cleared and drawn now: because it has something to show, or
   *  because it had something last frame and must be wiped. */
  needed(busy: boolean): boolean {
    const now = busy || this.busy;
    this.busy = busy;
    return now;
  }
}
