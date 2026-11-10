// The fun layer's rules on top of the core game (docs/04-content.md section 3.10): kill streaks
// that pay, the perfect cast, gold fish, and what the rare cards do on a kill. The pufferfish and
// the moray live with the other monsters (monsters.ts, hook.ts), the sea events in seaEvents.ts.

import { B } from './balance';
import { BF } from './balanceFun';
import type { Target } from './collide';
import { emit } from './events';
import { muldiv, roundDiv } from './math/fixed';
import { cosB, sinB } from './math/trig';
import { liftable } from './monsters';
import { seen } from './weather';
import type { Monster, World } from './world';

/** `base` coins grown by wave, like a catch's value. */
export function byWave(w: World, base: number): number {
  return roundDiv(base * (1000 + B.catch.valuePerWave * Math.max(0, w.wave - 1)), 1000);
}

/** Ticks a kill keeps the streak alive for: longer with the shanty. */
export function comboSpan(w: World): number {
  return w.up.shanty ? muldiv(BF.combo.span, BF.shanty.span, 1000) : BF.combo.span;
}

/** A kill: it carries the streak on (paying from the second kill), and feeds the rare cards and
 *  the sea event. Called by monsters.ts kill once `m` is gone. */
export function afterKill(w: World, m: Monster, crushed: boolean): void {
  w.combo = w.comboT > 0 ? w.combo + 1 : 1;
  w.comboT = comboSpan(w);
  if (w.combo > w.st.combo) w.st.combo = w.combo;
  if (w.combo >= 2) {
    let coins = byWave(w, BF.combo.coins * Math.min(w.combo - 1, BF.combo.cap));
    if (w.up.shanty) coins = muldiv(coins, BF.shanty.coins, 1000);
    w.coins += coins;
    emit(w, { e: 'combo', n: w.combo, coins, d: m.d, w: m.w });
  }
  if (w.up.keg && w.st.kills % BF.keg.every === 0 && w.mines < B.mine.max) {
    w.mines++;
    emit(w, { e: 'keg' });
  }
  if (crushed && w.up.barnacle && w.st.crush % BF.barnacle.every === 0 && w.hp < w.maxHp) {
    w.hp++;
    emit(w, { e: 'barnacle', hp: 1 });
  }
  if (m.bounty) {
    const coins = byWave(w, BF.events.bountyCoins);
    w.coins += coins;
    w.st.bounties++;
    emit(w, { e: 'bounty', coins, d: m.d, w: m.w });
  }
  const extra = w.event === 'frenzy' ? BF.events.frenzyCoins : w.event === 'swarm' ? BF.events.swarmCoins : 0;
  if (extra) {
    w.coins += extra;
    emit(w, { e: 'coins', amount: extra, spat: false });
  }
}

/** One tick of the streak's timer. */
export function tickStreak(w: World): void {
  if (w.comboT > 0 && --w.comboT === 0) w.combo = 0;
}

/** Whether a cast along `ang` that will meet `o` is aimed dead on it: the aim passes within a
 *  share of its radius from its middle. Only a catch the hook can take, in sight. */
export function perfectOn(w: World, ang: number, o: Target): boolean {
  const t = o.t === 'item' ? o.item : o.m;
  if (o.t === 'mon' && !liftable(w, o.m)) return false;
  if (!seen(w, t.d)) return false;
  const dd = t.d - B.crane.d;
  const dw = t.w - B.crane.w;
  const off = Math.abs(dd * sinB(ang) - dw * cosB(ang));
  return off <= BF.perfect.share * t.r;
}

/** The chance a new fish is gold, permille; the golden card raises it. */
export function goldChance(w: World): number {
  return w.up.golden ? BF.gold.goldenChance : BF.gold.chance;
}

/** What a gold fish pays, permille of a fish. */
export function goldMult(w: World): number {
  return w.up.golden ? BF.gold.goldenMult : BF.gold.mult;
}
