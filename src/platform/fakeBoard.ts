// A leaderboard in memory for a dev build (?board=fake): a few made-up captains on today's daily
// voyage, so the harbour's board can be seen and tested without a host that has one.

import { boardScore } from '../game/board';
import { today } from '../game/meta/daily';
import type { Board, BoardEntry } from './types';

const CAPTAINS: [string, number][] = [
  ['Marlinspike', 31],
  ['Ada Tern', 24],
  ['', 19],
  ['Old Barnacle Jim of the Northern Reaches', 12],
  ['Kip', 7],
];

export function fakeBoard(): Board {
  const scores = new Map<string, number>(CAPTAINS.map(([name, wave]) => [name, boardScore(today(), wave)]));
  return {
    submit: async (score) => {
      scores.set('You', Math.max(score, scores.get('You') ?? 0));
    },
    top: async (): Promise<BoardEntry[]> =>
      [...scores].sort((a, b) => b[1] - a[1]).map(([name, score], i) => ({ name, score, rank: i + 1 })),
  };
}
