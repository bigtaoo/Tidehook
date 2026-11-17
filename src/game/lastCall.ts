// The last thing the page does on its way out. `pagehide` is the one event a page going for good
// is promised, and until now all it did was write the voyage down (game/meta/resume.ts).
//
// That left one way to lose a whole game in silence. When the dock falls and the host has a
// rewarded ad, the game does not end yet: it stops on `pending`, asking the captain whether to
// watch one and sail on, and nothing is counted until that question is answered - the run's
// pearls are not banked, and the save is not written either, because a voyage that is no longer
// `play` is not a voyage in progress. A player who taps "no thanks" keeps everything; a player
// who closes the tab on the same card loses everything, after an hour at sea. Nobody taps a
// question they are walking away from, so the page answers it for them: leaving is turning the
// revive down, which is what `giveUp` is, and the run is counted before the page is written.
//
// Only on `pagehide`, never on a hidden tab: a player who switches away may well come back and
// still want that ad, and the game is still there waiting. A page that goes into the back/forward
// cache instead of away has its game counted a little early, which costs nothing - it comes back
// in the harbour with its pearls, rather than to an offer the host would no longer honour.

import type { Session } from './session';
import type { Resume } from './meta/resume';

/** The slice of `window` this listens on. */
export type LeaveWin = Pick<Window, 'addEventListener'>;

/** Hooks the page's last chance to write: the pending revive is turned down, then the voyage is
 *  saved. Both are no-ops where there is nothing to settle or nothing afloat. */
export function lastCall(win: LeaveWin, session: Session, resume: Resume): void {
  win.addEventListener('pagehide', () => {
    session.giveUp();
    resume.save(session);
  });
}
