// Whether the player sits at a mouse and keyboard, for the prompts' wording (docs/02-onboarding.md
// section 1): a desktop player told to "tap" takes the game for a phone port and does not know
// that Space casts. The host's word wins, as Playgama asks (pick the scheme by device, not by the
// screen's size); without one, the browser's pointer decides.

import type { Platform } from '../platform/types';

type MatchMedia = (query: string) => { matches: boolean };

export function onDesk(platform: Pick<Platform, 'device'>, matchMedia?: MatchMedia): boolean {
  const word = platform.device?.() ?? null;
  if (word === 'desktop') return true;
  if (word === 'mobile' || word === 'tablet' || word === 'tv') return false;
  try {
    return matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false;
  } catch {
    return false;
  }
}
