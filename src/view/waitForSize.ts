/** Resolves once the page has a size: a portal's iframe can start at 0x0 (Swarm Orbit's lesson). */
export function waitForSize(win: Pick<Window, 'innerWidth' | 'innerHeight' | 'addEventListener' | 'removeEventListener'>): Promise<void> {
  if (win.innerWidth > 0 && win.innerHeight > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (win.innerWidth > 0 && win.innerHeight > 0) {
        win.removeEventListener('resize', check);
        resolve();
      }
    };
    win.addEventListener('resize', check);
  });
}
