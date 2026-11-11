// The player looking away. A hidden tab stops the ticker by itself, so the game there freezes
// whether anyone asks it to or not; a window that merely lost focus does not. On a desktop that is
// the common case — the player alt-tabs to answer a message with a wave still coming in, the tide
// keeps rising behind the other window, and they come back to a dock already broken by monsters
// they never saw. So a blur pauses the voyage, the same pause the player's own button gives: it
// waits for a tap, and never resumes on its own into a wave nobody is ready for.

/** The slice of `window` this needs, so a test can hand over a fake. */
export type AwayWindow = Pick<Window, 'addEventListener' | 'removeEventListener'>;

/** The events that mean the window is no longer the one being used. */
const AWAY_EVENTS = ['blur'] as const;

/** Calls `away` whenever the window loses focus; returns the undo.
 *
 *  Listens for the event only, never for the focus state at boot: a portal's iframe is often not
 *  focused until the player clicks into it, and reading that at startup would open the game on a
 *  pause cover nobody asked for. */
export function watchAway(win: AwayWindow, away: () => void): () => void {
  const go = (): void => away();
  for (const e of AWAY_EVENTS) win.addEventListener(e, go);
  return () => {
    for (const e of AWAY_EVENTS) win.removeEventListener(e, go);
  };
}
