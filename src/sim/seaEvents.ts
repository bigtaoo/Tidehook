// Sea events (docs/04-content.md section 3.10): now and then a wave without a boss is not an
// ordinary one. A feeding frenzy (faster monsters, coins for each kill), a gold tide (fish pay
// half again), a bounty (one marked monster, tougher, with a purse on it) or a swarm (more small fry,
// a coin each). Drawn from the luck stream, so the spawns and the catch do not shift.

import { BF } from './balanceFun';
import type { MonsterKind } from './balance';
import { emit } from './events';
import { muldiv } from './math/fixed';
import type { Monster, SeaEvent, World } from './world';

export const SEA_EVENTS: readonly Exclude<SeaEvent, ''>[] = ['frenzy', 'gold', 'bounty', 'swarm'];

const E = BF.events;

/** Picks the coming wave's event, if any, and adds a swarm's fry to its spawn `list`. `boss`: the
 *  wave brings a boss, which is event enough. */
export function rollEvent(w: World, list: MonsterKind[], boss: boolean): void {
  w.event = '';
  w.bounty = -1;
  if (w.wave < E.from || boss || w.calm) return;
  const rng = w.rng.luck;
  if (rng.int(1000) >= E.chance) return;
  const id = SEA_EVENTS[rng.int(SEA_EVENTS.length)];
  w.event = id;
  if (id === 'bounty') w.bounty = list.length >> 1;
  if (id === 'swarm') {
    const n = E.swarm + Math.floor(w.wave / E.swarmPer);
    for (let i = 0; i < n; i++) list.splice(rng.int(list.length + 1), 0, i % 2 ? 'darter' : 'grunt');
  }
  emit(w, { e: 'seaEvent', id });
}

/** A monster of the wave's queue comes on: a frenzy speeds it up, and the bounty's turn marks it. */
export function eventSpawn(w: World, m: Monster): void {
  if (w.event === 'frenzy') m.speed = muldiv(m.speed, E.frenzySpeed, 1000);
  if (w.event === 'bounty' && w.bounty >= 0 && w.bounty-- === 0) {
    m.bounty = true;
    m.hp = Math.max(m.hp + 1, muldiv(m.hp, E.bountyHp, 1000));
    emit(w, { e: 'marked', id: m.id });
  }
}

/** What a fish landed now pays: half again in a gold tide. */
export function eventPay(w: World, val: number): number {
  return w.event === 'gold' ? muldiv(val, E.goldPay, 1000) : val;
}
