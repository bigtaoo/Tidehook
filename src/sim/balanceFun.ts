// The fun layer's numbers (docs/04-content.md section 3.10), read from balance.json like the rest
// (balance.ts) and kept apart so that file stays readable: kill streaks, the perfect cast, rare
// cards, sea events, the voyage's end, gold fish, the pufferfish and the moray.

import json from './balance.json';
import { radToBrad } from './balance';
import { perTick, pm, ticks, toFp } from './math/fixed';

const j = json;

export const BF = {
  /** Kills within `span` ticks of each other make a streak; each kill past the first pays
   *  `coins` more (grown by wave like a catch), up to `cap` times that. */
  combo: { span: ticks(j.combo.span), coins: j.combo.coins, cap: j.combo.cap },
  /** A cast whose aim passes within `share` (permille) of its target's radius from the target's
   *  middle flies and reels `boost` (permille) as fast. */
  perfect: { share: pm(j.perfect.share), boost: pm(j.perfect.boost) },
  /** From wave `from`, a shop deals a rare card as an extra one with `chance` permille, until the
   *  captain owns `max` of them. */
  rare: { from: j.rare.from, chance: pm(j.rare.chance), max: j.rare.max },
  /** From wave `from`, a wave without a boss is a sea event with `chance` permille (seaEvents.ts). */
  events: {
    from: j.events.from,
    chance: pm(j.events.chance),
    frenzySpeed: pm(j.events.frenzySpeed),
    frenzyCoins: j.events.frenzyCoins,
    goldPay: pm(j.events.goldPay),
    bountyHp: pm(j.events.bountyHp),
    bountyCoins: j.events.bountyCoins,
    swarm: j.events.swarm,
    swarmPer: j.events.swarmPer,
    swarmCoins: j.events.swarmCoins,
  },
  /** Clearing wave `wave` ends the voyage: home brings `home` pearls more, or sail on. */
  voyage: { wave: j.voyage.wave, home: j.voyage.home },
  /** A fish is gold with `chance` permille and pays `mult` permille; the golden card's numbers. */
  gold: { chance: pm(j.gold.chance), mult: pm(j.gold.mult), goldenChance: pm(j.gold.goldenChance), goldenMult: pm(j.gold.goldenMult) },
  /** A pufferfish killed at sea bursts over `burst` FP for `burstDmg`; thrown as a bomb, `boom`
   *  FP for `boomDmg` (plus the heft). */
  puffer: { burst: toFp(j.puffer.burst), burstDmg: j.puffer.burstDmg, boom: toFp(j.puffer.boom), boomDmg: j.puffer.boomDmg },
  /** A moray carries `coins` (grown by wave); caught, it pulls the rope out at `tugSpeed` for
   *  `tug` ticks, and each tap takes `yank` ticks off that. */
  moray: { coins: j.moray.coins, tug: ticks(j.moray.tug), tugSpeed: perTick(j.moray.tugSpeed), yank: ticks(j.moray.yank) },
  /** The rare cards: the scattershot's side throws, `spread` brads off the aim; a free mine every
   *  `keg` kills; a hit point back every `barnacle` crushes; the shanty's streak span and pay. */
  scatter: { spread: radToBrad(j.scatter.spread) },
  keg: { every: j.keg.every },
  barnacle: { every: j.barnacle.every },
  shanty: { span: pm(j.shanty.span), coins: pm(j.shanty.coins) },
  /** The harbour's extras (game/meta): the `n`th paint bought costs `base + step * n` pearls; a
   *  monster's first sinking pays `codex` pearls; the daily voyage's `n`th day in a row pays
   *  `per * min(n, cap)` pearls more. */
  paint: { base: j.paint.base, step: j.paint.step },
  codex: { pearls: j.codex.pearls },
  streak: { per: j.streak.per, cap: j.streak.cap },
};
