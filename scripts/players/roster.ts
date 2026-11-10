// The player population (docs/04-content.md section 4): a spread of skill (how fast a player looks,
// how far off they aim, and whether they get better game by game) and of personality (how they
// shop, use junk, watch ads, spend pearls and pick seas). Each one plays whole careers in
// scripts/players/life.ts, so we can see where each kind of player gets stuck or bored.

import type { PersonaSpec } from '../../src/sim/bot/bot';

/** Reaction in seconds and aim error in radians. */
export interface Skill {
  react: number;
  err: number;
}

export const FUMBLER: Skill = { react: 0.8, err: 0.22 };
export const NOVICE: Skill = { react: 0.5, err: 0.14 };
export const CASUAL: Skill = { react: 0.3, err: 0.07 };
export const GOOD: Skill = { react: 0.1, err: 0.02 };

/** Games a learner takes to go from fumbler to casual. */
export const LEARN_GAMES = 10;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A fumbler who plays like a casual player after LEARN_GAMES games. */
export function learner(game: number): Skill {
  const t = Math.min(1, game / LEARN_GAMES);
  return { react: lerp(FUMBLER.react, CASUAL.react, t), err: lerp(FUMBLER.err, CASUAL.err, t) };
}

export interface Player {
  id: string;
  /** Who this stands for, in a few words. */
  note: string;
  /** The player's skill in game `n` (0 the first). */
  skill: (n: number) => Skill;
  /** How they play a wave and shop, apart from skill. */
  style: Omit<PersonaSpec, 'react' | 'err'>;
  /** Watches the revive ad whenever the dock falls (once a game). */
  revive: boolean;
  /** Watches the pearl-doubling ad after every game. */
  double: boolean;
  /** cheap: buys the cheapest thing it can, again and again; charts: saves for a sea chart as soon
   *  as one is on sale, and buys the rest cheapest first otherwise. */
  harbour: 'cheap' | 'charts';
  /** newest: always sails the hardest sea owned; bay: never leaves the home bay. */
  sea: 'newest' | 'bay';
}

const PLAIN = { junk: true, fish: true, reroll: false, mines: false, spam: false };
const fixed = (s: Skill) => () => s;

export const ROSTER: Player[] = [
  { id: 'fumbler', note: 'slow, aims wide, never uses junk', skill: fixed(FUMBLER), style: { ...PLAIN, junk: false }, revive: false, double: false, harbour: 'cheap', sea: 'newest' },
  { id: 'spammer', note: 'taps at random', skill: fixed({ react: 0.15, err: 0.1 }), style: { ...PLAIN, junk: false, spam: true }, revive: false, double: false, harbour: 'cheap', sea: 'newest' },
  { id: 'learner', note: 'starts as a fumbler, casual after 10 games; revives', skill: learner, style: PLAIN, revive: true, double: false, harbour: 'cheap', sea: 'newest' },
  { id: 'novice', note: 'the novice of the career sim', skill: fixed(NOVICE), style: PLAIN, revive: false, double: false, harbour: 'cheap', sea: 'newest' },
  { id: 'novice-nojunk', note: 'novice who never learns to throw junk', skill: fixed(NOVICE), style: { ...PLAIN, junk: false }, revive: false, double: false, harbour: 'cheap', sea: 'newest' },
  { id: 'novice-ads', note: 'novice who watches revive and x2 every game', skill: fixed(NOVICE), style: PLAIN, revive: true, double: true, harbour: 'cheap', sea: 'newest' },
  { id: 'novice-greedy', note: 'novice who fishes greedily and never repairs', skill: fixed(NOVICE), style: { ...PLAIN, repairAt: 7, fishNear: true }, revive: false, double: false, harbour: 'cheap', sea: 'newest' },
  { id: 'novice-random', note: 'novice, random cards, rerolls, saves for charts', skill: fixed(NOVICE), style: { ...PLAIN, randomCards: true, reroll: true }, revive: false, double: false, harbour: 'charts', sea: 'newest' },
  { id: 'novice-homebody', note: 'novice who never leaves the bay', skill: fixed(NOVICE), style: PLAIN, revive: false, double: false, harbour: 'cheap', sea: 'bay' },
  { id: 'casual-careful', note: 'casual, repairs every scratch, mines, revives', skill: fixed(CASUAL), style: { ...PLAIN, repairAt: 1, mines: true }, revive: true, double: false, harbour: 'cheap', sea: 'newest' },
  { id: 'casual-rusher', note: 'casual, saves for charts, hardest sea', skill: fixed(CASUAL), style: PLAIN, revive: false, double: false, harbour: 'charts', sea: 'newest' },
  { id: 'good-rusher', note: 'good, saves for charts, rerolls, mines', skill: fixed(GOOD), style: { ...PLAIN, reroll: true, mines: true }, revive: false, double: false, harbour: 'charts', sea: 'newest' },
  { id: 'good-ads', note: 'good, watches every ad', skill: fixed(GOOD), style: { ...PLAIN, reroll: true, mines: true }, revive: true, double: true, harbour: 'cheap', sea: 'newest' },
];
