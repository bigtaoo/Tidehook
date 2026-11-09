// Waves: which monsters come and when, and the hand-over to the shop once the lane is clear
// (prototype waveComp, startWave, endWave and the spawn part of update).

import { B, MONSTER_KINDS, type MonsterKind } from './balance';
import { emit } from './events';
import { restockAfterWave } from './items';
import { TICK_RATE, times } from './math/fixed';
import { spawn } from './monsters';
import { rollShop } from './shop';
import type { World } from './world';

const V = B.waves;

/** How many of each monster wave `wave` brings. */
export function waveMix(wave: number): Record<MonsterKind, number> {
  const out = {} as Record<MonsterKind, number>;
  for (const k of MONSTER_KINDS) {
    const m = V.mix[k];
    out[k] = wave >= m.from ? m.base + Math.floor((wave - m.offset) / m.per) : 0;
  }
  return out;
}

/** Ticks between spawns at wave `wave`, before the jitter. */
export function spawnGap(wave: number): number {
  return Math.max(V.gapMin, V.gapStart - times(V.gapPerWave * wave, TICK_RATE));
}

export function startWave(w: World): void {
  w.wave++;
  w.phase = 'wave';
  w.clearT = 0;
  const rng = w.rng.spawn;
  const mix = waveMix(w.wave);
  const list: MonsterKind[] = [];
  for (const k of MONSTER_KINDS) for (let i = 0; i < mix[k]; i++) list.push(k);
  for (let i = list.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  // a new kind comes early and on its own, so the player meets it before the crowd
  for (const k of MONSTER_KINDS) {
    if (!mix[k] || w.seen.includes(k)) continue;
    w.seen.push(k);
    emit(w, { e: 'debut', kind: k });
    list.splice(list.indexOf(k), 1);
    list.splice(Math.min(V.debutSlot, list.length), 0, k);
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
      w.spawnT = times(spawnGap(w.wave), jitter);
    }
  } else if (!w.mons.length && w.hook.st === 'swing' && !w.shots.length) {
    if (++w.clearT > V.clearDelay) endWave(w);
  }
}

function endWave(w: World): void {
  restockAfterWave(w);
  w.phase = 'shop';
  w.rerolls = 0;
  emit(w, { e: 'waveClear', wave: w.wave });
  rollShop(w);
}
