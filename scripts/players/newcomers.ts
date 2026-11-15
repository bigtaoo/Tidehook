// Twenty newcomers (docs/04-content.md section 5): everyone here is somewhere between a fumbler
// and a casual player — nobody has played before, nobody is good yet. They differ in the habits a
// new player actually brings: how fast and how straight they aim, whether anyone ever showed them
// the junk, the shop or the harbour, how long they sit down for, whether they watch the ads, and
// where they sail. ROSTER (roster.ts) spans every skill level to guard the balance; this list
// stays at the shallow end to ask a different question — how long does the content hold a player
// who is still learning, and where does it let them go.
//
// Run: `GROUP=newcomers npm run sim:players` (add CAREERS=n, DETAIL=1).

import { CASUAL, FUMBLER, NOVICE, type Player, type Skill } from './roster';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A player who gets better over `games` games, from `a` to `b`. */
function climb(a: Skill, b: Skill, games: number): (n: number) => Skill {
  return (n: number) => {
    const t = Math.min(1, n / games);
    return { react: lerp(a.react, b.react, t), err: lerp(a.err, b.err, t) };
  };
}

/** Slow hands but a steady eye: looks late, aims true. */
const CAREFUL: Skill = { react: 0.75, err: 0.05 };
/** Quick hands, wild eye: taps the moment it sees something, rarely on the line. */
const TWITCHY: Skill = { react: 0.25, err: 0.24 };

const fixed = (s: Skill) => () => s;

/** The habits of someone who has played a wave or two: throws junk, fishes between monsters,
 *  no rerolls, no mines. */
const PLAIN = { junk: true, fish: true, reroll: false, mines: false, spam: false };

export const NEWCOMERS: Player[] = [
  // --- how they aim ---
  { id: 'first-timer', note: 'the plain newcomer, nothing special about them', skill: fixed(NOVICE), style: PLAIN, revive: false, double: false, harbour: 'cheap', sea: 'newest' },
  { id: 'fumbler', note: 'slow and wide, never throws junk', skill: fixed(FUMBLER), style: { ...PLAIN, junk: false }, revive: false, double: false, harbour: 'cheap', sea: 'newest' },
  { id: 'masher', note: 'taps at random, hopes for the best', skill: fixed({ react: 0.15, err: 0.1 }), style: { ...PLAIN, junk: false, spam: true }, revive: false, double: false, harbour: 'cheap', sea: 'newest' },
  { id: 'careful-aimer', note: 'looks late but aims true; patches every scratch', skill: fixed(CAREFUL), style: { ...PLAIN, repairAt: 1 }, revive: false, double: false, harbour: 'cheap', sea: 'newest' },
  { id: 'twitchy', note: 'fast hands, wild aim', skill: fixed(TWITCHY), style: PLAIN, revive: false, double: false, harbour: 'cheap', sea: 'newest' },
  { id: 'quick-learner', note: 'fumbler who plays like a casual after 10 games', skill: climb(FUMBLER, CASUAL, 10), style: PLAIN, revive: true, double: false, harbour: 'cheap', sea: 'newest' },
  { id: 'slow-learner', note: 'fumbler who only reaches novice, over 20 games', skill: climb(FUMBLER, NOVICE, 20), style: PLAIN, revive: false, double: false, harbour: 'cheap', sea: 'newest' },

  // --- what nobody taught them ---
  { id: 'junk-blind', note: 'never picks up the junk the tutorial showed', skill: fixed(NOVICE), style: { ...PLAIN, junk: false }, revive: false, double: false, harbour: 'cheap', sea: 'newest' },
  { id: 'fish-blind', note: 'hunts monsters only, never casts for a fish', skill: fixed(NOVICE), style: { ...PLAIN, fish: false }, revive: false, double: false, harbour: 'cheap', sea: 'newest' },
  { id: 'fish-greedy', note: 'chases every fish, lets the dock take the hits', skill: fixed(NOVICE), style: { ...PLAIN, repairAt: 7, fishNear: true }, revive: false, double: false, harbour: 'cheap', sea: 'newest' },
  { id: 'shop-skipper', note: 'hits next wave without buying a card', skill: fixed(NOVICE), style: { ...PLAIN, shopSkip: true }, revive: false, double: false, harbour: 'cheap', sea: 'newest' },
  { id: 'card-tourist', note: 'buys whatever card looks nice, rerolls for fun', skill: fixed(NOVICE), style: { ...PLAIN, randomCards: true, reroll: true }, revive: false, double: false, harbour: 'cheap', sea: 'newest' },
  { id: 'pearl-hoarder', note: 'brings pearls home and never spends one', skill: fixed(NOVICE), style: PLAIN, revive: false, double: false, harbour: 'none', sea: 'newest' },

  // --- where they sail ---
  { id: 'homebody', note: 'never leaves the home bay', skill: fixed(NOVICE), style: PLAIN, revive: false, double: false, harbour: 'cheap', sea: 'bay' },
  { id: 'chart-saver', note: 'saves every pearl for the next sea chart', skill: fixed(NOVICE), style: PLAIN, revive: false, double: false, harbour: 'charts', sea: 'newest' },
  { id: 'homecoming', note: 'takes the way home the moment the voyage ends', skill: fixed(CASUAL), style: PLAIN, revive: false, double: false, harbour: 'cheap', sea: 'newest', voyage: 'home' },

  // --- how long they sit down for ---
  { id: 'commuter', note: 'ten minutes at a time, then the tab closes', skill: fixed(NOVICE), style: PLAIN, revive: false, double: false, harbour: 'cheap', sea: 'newest', sitting: 10 },
  { id: 'lunch-break', note: 'twenty minutes at a time', skill: fixed(NOVICE), style: PLAIN, revive: false, double: false, harbour: 'cheap', sea: 'newest', sitting: 20 },

  // --- what they do with the ads ---
  { id: 'revive-taker', note: 'watches the revive ad every game, never the doubler', skill: fixed(NOVICE), style: PLAIN, revive: true, double: false, harbour: 'cheap', sea: 'newest' },
  { id: 'ad-watcher', note: 'watches every ad on offer', skill: fixed(NOVICE), style: PLAIN, revive: true, double: true, harbour: 'cheap', sea: 'newest' },
];
