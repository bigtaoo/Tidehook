// The keyboard (docs/01-tech-plan.md section 5): Space casts, 1-3 buy a card, 4 repairs, 5 buys a
// mine, R rerolls, Enter starts (the next wave, or a game), P pauses, M turns the sound off or on
// (through `extra`, as the sound is not the Session's). No Esc: portals take it, so
// the pause button is on screen from the first frame. Taps on the lane come from the view.

import type { Session } from './session';

export function bindKeys(
  target: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  s: Session,
  extra: (key: string) => boolean = () => false,
): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (handleKey(s, e.key) || extra(e.key.toLowerCase())) e.preventDefault();
  };
  target.addEventListener('keydown', onKey);
  return () => target.removeEventListener('keydown', onKey);
}

/** Runs the key's command; false for a key the game does not use. */
export function handleKey(s: Session, key: string): boolean {
  switch (key.toLowerCase()) {
    case ' ':
      s.tap();
      return true;
    case 'enter':
      if (!s.nextWave()) s.tap();
      return true;
    case '1':
    case '2':
    case '3':
      s.buy(Number(key) - 1);
      return true;
    case '4':
      s.repair();
      return true;
    case '5':
      s.mine();
      return true;
    case 'r':
      s.reroll();
      return true;
    case 'p':
      s.togglePause();
      return true;
    default:
      return false;
  }
}
