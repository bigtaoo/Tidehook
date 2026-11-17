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
// The host's view of the round goes the same way. game/playWindow.ts closes its window when the
// tab is hidden, because the ticker stops there and no frame is left to say the play is over; but
// a page can go away without ever being marked hidden - `pagehide` fires while the page is still
// visible, and iOS freezes pages with no visibilitychange at all - and then the window is never
// closed. The host is left believing the player is still in a round they walked out of a week
// ago: it holds its own things off the screen for them, and nothing anywhere says otherwise.
//
// Only on `pagehide`, never on a hidden tab: a player who switches away may well come back and
// still want that ad, and the game is still there waiting. A page that goes into the back/forward
// cache instead of away has its game counted a little early, which costs nothing - it comes back
// in the harbour with its pearls, rather than to an offer the host would no longer honour.

import type { Session } from './session';
import type { Resume } from './meta/resume';
import type { PlayWindow } from './playWindow';

/** The slice of `window` this listens on. */
export type LeaveWin = Pick<Window, 'addEventListener'>;

/** Hooks the page's last chance: the pending revive is turned down, the voyage is saved, and the
 *  host is told the round is over. Each is a no-op where there is nothing to do. */
export function lastCall(win: LeaveWin, session: Session, resume: Resume, play: Pick<PlayWindow, 'set'>): void {
  win.addEventListener('pagehide', () => {
    session.giveUp();
    resume.save(session);
    play.set(false);
  });
}
