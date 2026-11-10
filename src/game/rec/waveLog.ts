// The recorder's wave by wave log (rec/wire.ts): at the end of each wave, one record of how it went
// (time, the dock's hit points, what leaked, coins caught, eaten, spilled and caught again, kills,
// what was bought before it). scripts/rec/waves.mjs prints them as a table, so a played game shows
// where it turned. It reads the world and its events; nothing here touches the sim.

import type { SimEvent } from '../../sim/events';
import { TICK_RATE } from '../../sim/math/fixed';
import type { Tally, World } from '../../sim/world';

export interface WaveRecord {
  k: 'wave';
  wave: number;
  /** How the wave ended: cleared, or the dock fell. */
  end: 'clear' | 'over';
  /** Game seconds the wave took. */
  secs: number;
  /** The dock's hit points when the wave started and when it ended, and its most. */
  hp0: number;
  hp: number;
  maxHp: number;
  /** Coins in hand when it started and when it ended. */
  coins0: number;
  coins: number;
  /** Monsters that came, and that reached the dock, by kind; the hit points they took. */
  came: Record<string, number>;
  leaks: Record<string, number>;
  leakDmg: number;
  /** The Tally's growth over the wave. */
  st: Tally;
  /** Shop upgrades bought before this wave, by id (a level each). */
  bought: string[];
  mines: number;
}

type Open = Omit<WaveRecord, 'k' | 'end' | 'secs' | 'hp' | 'coins' | 'maxHp' | 'st'> & { tick: number; st: Tally };

export class WaveLog {
  private open: Open | null = null;
  private lv: Record<string, number> = {};
  /** The game being logged: a new one drops a wave left open (a game quit midway). */
  private world: World | null = null;

  constructor(private readonly send: (rec: WaveRecord) => void) {}

  /** Once a frame, after the ticks, with the frame's events. */
  frame(w: World, events: readonly SimEvent[]): void {
    // a wave started outside a step (a new game, the shop's sail button) may have had its
    // waveStart cleared by the next step before anyone saw it
    if (w !== this.world) {
      this.world = w;
      this.open = null;
      this.lv = {};
    }
    if (!this.open && w.phase === 'wave') this.begin(w, w.wave);
    for (const ev of events) {
      if (ev.e === 'waveStart') this.begin(w, ev.wave);
      const o = this.open;
      if (!o) continue;
      if (ev.e === 'spawn') o.came[ev.kind] = (o.came[ev.kind] ?? 0) + 1;
      else if (ev.e === 'leak') {
        o.leaks[ev.kind] = (o.leaks[ev.kind] ?? 0) + 1;
        o.leakDmg += ev.dmg;
      } else if (ev.e === 'waveClear') this.end(w, 'clear');
      else if (ev.e === 'over') this.end(w, 'over');
    }
  }

  private begin(w: World, wave: number): void {
    if (this.open?.wave === wave) return;
    const bought: string[] = [];
    for (const [id, n] of Object.entries(w.lv)) for (let i = this.lv[id] ?? 0; i < n; i++) bought.push(id);
    this.lv = { ...w.lv };
    this.open = { wave, tick: w.tick, hp0: w.hp, coins0: w.coins, came: {}, leaks: {}, leakDmg: 0, st: { ...w.st }, bought, mines: w.mines };
  }

  private end(w: World, end: 'clear' | 'over'): void {
    const o = this.open!;
    this.open = null;
    const st = { ...w.st };
    for (const key of Object.keys(st) as (keyof Tally)[]) st[key] -= o.st[key];
    const { tick, ...rest } = o;
    this.send({ k: 'wave', ...rest, end, secs: Math.round((w.tick - tick) / TICK_RATE), hp: Math.max(0, w.hp), maxHp: w.maxHp, coins: w.coins, st });
  }
}
