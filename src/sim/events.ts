// What the simulation tells the view and the audio: the only way out of the sim. The view reads
// the state to draw it and these to animate what changed; it never writes either. Positions are
// lane points in FP.

import type { MonsterKind } from './balance';
import type { World } from './world';

export type SimEvent =
  | { e: 'waveStart'; wave: number }
  | { e: 'debut'; kind: MonsterKind }
  | { e: 'spawn'; id: number; kind: MonsterKind }
  | { e: 'cast' }
  | { e: 'throw' }
  | { e: 'grab'; what: 'fish' | 'junk' | 'monster'; d: number; w: number }
  | { e: 'magnet'; d: number; w: number }
  | { e: 'bounce'; id: number; d: number; w: number }
  | { e: 'hit'; id: number; dmg: number; d: number; w: number }
  | { e: 'blast'; d: number; w: number; r: number }
  | { e: 'mine'; d: number; w: number; r: number }
  | { e: 'kill'; id: number; kind: MonsterKind; crushed: boolean; d: number; w: number }
  | { e: 'coins'; amount: number; spat: boolean }
  | { e: 'drop'; val: number; d: number; w: number }
  | { e: 'held' }
  | { e: 'eatStart'; id: number }
  | { e: 'eaten'; id: number; val: number; grew: boolean }
  | { e: 'leak'; kind: MonsterKind; dmg: number }
  | { e: 'waveClear'; wave: number }
  | { e: 'over'; wave: number };

export function emit(w: World, ev: SimEvent): void {
  w.events.push(ev);
}
