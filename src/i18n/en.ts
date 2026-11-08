// The source string table. Every other locale is typed as Table, so a missing or extra key is a
// compile error. Leave room: German and Russian run about 30% longer (docs/00-art-direction.md).
export const en = {
  title: 'Tidehook',
  lang: { name: 'English' },
  boot: {
    tapToStart: 'Tap to cast',
    failed: 'Could not start: {error}',
  },
  hud: {
    wave: 'Wave {n}',
    coins: '{n}',
    dock: 'Dock {hp}/{max}',
    mines: 'Mines {n}',
    held: 'Junk in hand',
    pause: 'Pause',
  },
  shop: {
    title: 'Wave {n} cleared',
    level: 'Lv {n}/{max}',
    sold: 'Bought',
    repair: 'Repair +{n}',
    mine: 'Mine {n}/{max}',
    reroll: 'New cards',
    next: 'Next wave',
    bot: 'The bot is shopping',
  },
  cards: {
    grip: { name: 'Grip +1', desc: 'The hook lifts heavier monsters.' },
    heft: { name: 'Heavy junk +2', desc: 'Thrown junk hits 2 harder.' },
    winch: { name: 'Winch +25%', desc: 'Reels in faster, most of all with a heavy catch.' },
    cast: { name: 'Fast cast +25%', desc: 'The hook flies out faster.' },
    barb: { name: 'Barb +1', desc: 'Monsters too heavy to lift lose 1 more HP when hooked.' },
    pierce: { name: 'Piercing junk', desc: 'A throw flies on through 1 more monster.' },
    blast: { name: 'Bursting junk', desc: 'A throw also hurts monsters around it (half damage).' },
    bait: { name: 'Sweet bait', desc: 'Fish draw monsters from further, and they eat longer.' },
    swing: { name: 'Wide swing', desc: 'The hook swings 10° further each way.' },
    planks: { name: 'Planks +3', desc: 'The dock takes 3 more hits, and mends 3 now.' },
    multi: { name: 'Gang hook', desc: 'After a catch the hook flies on and takes 1 more.' },
    magnet: { name: 'Magnet hook', desc: 'Reeling in pulls nearby fish onto the hook.' },
    grounds: { name: 'Rich grounds', desc: 'Fish are worth 30% more, and 2 more come each wave.' },
  },
  monsters: {
    grunt: { name: 'Crab', tip: 'Light: hook it and crush it on the dock.' },
    darter: { name: 'Eel', tip: 'Fast, swims in from the sides and ignores fish.' },
    brute: { name: 'Turtle', tip: 'Too heavy to lift: throw junk at it, or buy Grip.' },
    glutton: { name: 'Shark', tip: 'Eats fish and grows; crush it to get the coins back.' },
  },
  hints: {
    debut: 'New: {name}. {tip}',
    held: 'Junk in hand! Tap again to throw it along the aim.',
    eat: 'Monsters stop to eat fish: hook them while they chew!',
  },
  fx: { coins: '+{n}' },
  overlay: {
    paused: 'Paused',
    resume: 'Tap to resume',
    over: 'The dock is lost',
    reached: 'You held out to wave {n}',
    again: 'Tap to play again',
  },
};

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Table = Widen<typeof en>;
