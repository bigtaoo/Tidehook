// Waves: which monsters come and when, and the hand-over to the shop once the lane is clear
// (prototype waveComp, startWave, endWave and the spawn part of update).

import { B, CREW_KINDS, type BossKind, type CrewKind, type MonsterKind } from './balance';
import { emit } from './events';
import { restockAfterWave } from './items';
import { muldiv, TICK_RATE, times } from './math/fixed';
import { spawn } from './monsters';
import { seaOf } from './seas';
import { rollShop } from './shop';
import { level, mendAfterWave } from './tide';
import type { World } from './world';

const V = B.waves;

/** How many of each monster a wave at difficulty `lv` (tide.ts level, permille) brings. */
export function waveMix(lv: number): Record<CrewKind, number> {
  const out = {} as Record<CrewKind, number>;
  for (const k of CREW_KINDS) {
    const m = V.mix[k];
    out[k] = lv >= m.from * 1000 ? m.base + Math.floor((lv - m.offset * 1000) / (m.per * 1000)) : 0;
  }
  return out;
}

/** Ticks between spawns at difficulty `lv` (permille), before the jitter. */
export function spawnGap(lv: number): number {
  return Math.max(V.gapMin, V.gapStart - muldiv(V.gapPerWave * lv, TICK_RATE, 1_000_000));
}

/** Whether wave `wave` brings a boss. */
export function isBossWave(wave: number): boolean {
  return wave % B.boss.every === 0;
}

/** The boss wave `wave` brings, or null: the kraken every B.kraken.every waves from wave
 *  B.kraken.from, else the turtle. */
export function bossOf(wave: number): BossKind | null {
  if (!isBossWave(wave)) return null;
  return wave >= B.kraken.from && wave % B.kraken.every === 0 ? 'kraken' : 'boss';
}

export function startWave(w: World): void {
  w.wave++;
  w.phase = 'wave';
  w.clearT = 0;
  const rng = w.rng.spawn;
  const mix = waveMix(level(w));
  const list: MonsterKind[] = [];
  for (const k of CREW_KINDS) for (let i = 0; i < mix[k]; i++) list.push(k);
  for (let i = list.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  // a new kind comes early and on its own, so the player meets it before the crowd
  for (const k of CREW_KINDS) {
    if (!mix[k] || w.seen.includes(k)) continue;
    w.seen.push(k);
    emit(w, { e: 'debut', kind: k });
    list.splice(list.indexOf(k), 1);
    list.splice(Math.min(V.debutSlot, list.length), 0, k);
  }
  // every few waves a boss comes, halfway through, so it walks in with the crowd rather than alone
  // at the end with the lane to itself
  const boss = bossOf(w.wave);
  if (boss) {
    list.splice(list.length >> 1, 0, boss);
    if (!w.seen.includes(boss)) {
      w.seen.push(boss);
      emit(w, { e: 'debut', kind: boss });
    }
  }
  w.queue = list;
  w.spawnT = V.firstDelay;
  emit(w, { e: 'waveStart', wave: w.wave });
}

/** Spawns the queue on its timer, and ends the wave once the lane has been clear a moment. */
export function updateWave(w: World): void {
  if (w.queue.length) {
    if (w.calm === 1 || (w.calm === 2 && w.mons.length)) return;
    if (--w.spawnT <= 0) {
      spawn(w, w.queue.shift() as MonsterKind);
      const jitter = V.jitterMin + w.rng.spawn.int(V.jitterMax - V.jitterMin);
      w.spawnT = Math.max(1, muldiv(times(spawnGap(level(w)), jitter), seaOf(w).gap, 1000));
    }
  } else if (!w.mons.length && w.hook.st === 'swing' && !w.shots.length) {
    if (++w.clearT > V.clearDelay) endWave(w);
  }
}

function endWave(w: World): void {
  restockAfterWave(w);
  mendAfterWave(w);
  w.phase = 'shop';
  w.rerolls = 0;
  emit(w, { e: 'waveClear', wave: w.wave });
  rollShop(w);
}
