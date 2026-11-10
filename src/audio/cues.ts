// Which sound each simulation event makes. The sounds themselves are built by
// tools/build_audio.py into public/audio/<cue>_<n>.mp3; cues.json says how many variants each has.

import type { SimEvent } from '../sim/events';
import counts from './cues.json';

export type Cue = keyof typeof counts;

/** How many variants of each cue there are. */
export const VARIANTS: Readonly<Record<Cue, number>> = counts;

export const CUES = Object.keys(counts) as Cue[];

/** The file of variant `i` of `cue`, relative to the page. */
export function cueFile(cue: Cue, i: number): string {
  return `audio/${cue}_${i}.mp3`;
}

export const MUSIC_FILE = 'audio/music.mp3';

/** The fewest ms between two starts of one cue: a burst of kills in one tick is one thud, not ten. */
export const MIN_GAP_MS: Partial<Record<Cue, number>> = {
  coins: 70,
  hit: 50,
  bounce: 60,
  kill: 60,
  leak: 90,
  grabFish: 60,
  eat: 400,
  spat: 120,
};
export const DEFAULT_GAP_MS = 35;

/** Each cue's loudness on top of its build level, 0-1: the rare and big ones get the room. */
export const VOLUME: Partial<Record<Cue, number>> = {
  coins: 0.7,
  reel: 0.6,
  bounce: 0.8,
};

/** The cue for an event, or null for one that makes no sound (the view shows it). */
export function cueFor(ev: SimEvent): Cue | null {
  switch (ev.e) {
    case 'cast':
      return 'cast';
    case 'throw':
      return 'throw';
    case 'grab':
      return ev.what === 'fish' ? 'grabFish' : ev.what === 'junk' ? 'grabJunk' : 'grabMonster';
    case 'magnet':
      return 'grabFish';
    case 'hit':
      return 'hit';
    case 'bounce':
    case 'shell':
      return 'bounce';
    case 'summon':
      return 'eat';
    case 'kill':
      return 'kill';
    case 'blast':
      return 'blast';
    case 'mine':
      return 'mine';
    case 'coins':
      return ev.spat ? 'spat' : 'coins';
    case 'eatStart':
      return 'eat';
    case 'eaten':
      return 'eaten';
    case 'leak':
      return 'leak';
    case 'waveStart':
      return 'waveStart';
    case 'waveClear':
      return 'waveClear';
    case 'over':
      return 'over';
    // 'debut' shows a banner and 'spawn' is every few seconds; 'drop' and 'held' follow a grab
    // that already made a sound; 'mend' comes on the wave clear's tick
    default:
      return null;
  }
}
