/** How often the size is looked at anyway, and how long the game waits for one at all. */
export const SIZE_POLL_MS = 150;
export const SIZE_WAIT_MS = 8_000;

type Timers = Pick<typeof globalThis, 'setInterval' | 'clearInterval'>;
type SizeWindow = Pick<Window, 'innerWidth' | 'innerHeight' | 'addEventListener' | 'removeEventListener'>;

function sized(win: SizeWindow): boolean {
  return win.innerWidth > 0 && win.innerHeight > 0;
}

/** Resolves once the page has a size: a portal's iframe can start at 0x0 (Swarm Orbit's lesson).
 *
 *  A `resize` is not promised for every way an iframe comes to have a size - it may be laid out
 *  from `display: none`, or sized before its own window ever hears of it - and boot waits here
 *  with the loading bar part full and nothing wrong to report, which is the worst shape a failure
 *  can take. So the size is looked at on a clock as well, and after SIZE_WAIT_MS the game boots on
 *  whatever the page says: the renderer resizes itself later anyway (src/app.ts), and a game that
 *  draws small for a moment beats one that never draws at all. */
export function waitForSize(win: SizeWindow, timers: Timers = globalThis): Promise<void> {
  if (sized(win)) return Promise.resolve();
  return new Promise((resolve) => {
    let waited = 0;
    const stop = (): void => {
      win.removeEventListener('resize', check);
      timers.clearInterval(tick);
      resolve();
    };
    const check = (): void => {
      if (sized(win)) stop();
    };
    const tick = timers.setInterval(() => {
      waited += SIZE_POLL_MS;
      if (sized(win) || waited >= SIZE_WAIT_MS) stop();
    }, SIZE_POLL_MS);
    win.addEventListener('resize', check);
  });
}
