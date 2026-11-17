// The portal's gameplay window: gameplay_started and gameplay_stopped, which is how a host knows
// the player is in a round and when it may put its own things on the screen. The pair is driven
// from the frame loop, and that is exactly where it can go wrong: a hidden tab stops the ticker
// (game/away.ts), so a stop that waits for the next frame waits until the player comes back,
// which may be never. The host is told here and now instead.

import type { Platform } from '../platform/types';

/** The slice of `document` this needs, so a test can hand over a fake. */
export type PlayDoc = Pick<Document, 'addEventListener'> & { readonly hidden: boolean };

export class PlayWindow {
  private playing = false;

  /** Listens for the tab going away, so the window is closed before the ticker stops. */
  constructor(private readonly platform: Pick<Platform, 'gameplayStart' | 'gameplayStop'>, doc: PlayDoc) {
    doc.addEventListener('visibilitychange', () => doc.hidden && this.set(false));
  }

  /** Whether a round is being played right now; only the changes reach the host. */
  set(now: boolean): void {
    if (now === this.playing) return;
    this.playing = now;
    if (now) this.platform.gameplayStart();
    else this.platform.gameplayStop();
  }

  get open(): boolean {
    return this.playing;
  }
}
