/** How often the size the renderer measures itself from is looked at. */
export const WATCH_MS = 500;

type Timers = Pick<typeof globalThis, 'setInterval' | 'clearInterval'>;
type Box = { readonly w: number; readonly h: number };

/** Keeps the renderer's size true where no resize event ever says it changed.
 *
 *  Pixi measures its `resizeTo` only when the window fires `resize`, and such an event is not
 *  promised for every way a portal's iframe comes to have a size - which is why boot waits on a
 *  clock as well and gives up after a while (view/waitForSize.ts). A game that booted on nothing
 *  would then hold a canvas of nothing for the rest of the session: a black page with the sound
 *  playing, no error anywhere and not one frame the player can see. So the size is watched here
 *  too and the renderer told whenever it moved, which covers the host that lays its frame out
 *  without a word as well. Returns the way to stop watching.
 */
export function watchSize(box: () => Box, resize: () => void, timers: Timers = globalThis): () => void {
  let last = box();
  const tick = timers.setInterval(() => {
    const now = box();
    if (now.w === last.w && now.h === last.h) return;
    last = now;
    resize();
  }, WATCH_MS);
  return () => timers.clearInterval(tick);
}
