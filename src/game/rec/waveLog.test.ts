import { describe, expect, it } from 'vitest';
import { playGame } from '../../sim/bot/bot';
import { Pilot } from '../../sim/bot/bot';
import { startGame, step } from '../../sim/step';
import { WaveLog, type WaveRecord } from './waveLog';

describe('the wave log', () => {
  it('sends one record per wave whose tallies add up to the game', () => {
    const w = startGame(5);
    const pilot = new Pilot(5, 'casual');
    const recs: WaveRecord[] = [];
    const log = new WaveLog((r) => recs.push(r));
    for (let t = 0; t < 30 * 60 * 6 && w.phase !== 'over' && w.wave <= 4; t++) {
      pilot.tick(w);
      if (w.phase === 'wave') step(w);
      log.frame(w, w.events.splice(0));
    }
    expect(recs.length).toBeGreaterThanOrEqual(3);
    expect(recs.map((r) => r.wave)).toEqual(recs.map((_, i) => i + 1));
    const sum = (f: (r: WaveRecord) => number) => recs.reduce((a, r) => a + f(r), 0);
    expect(sum((r) => r.st.kills)).toBe(w.st.kills);
    expect(sum((r) => r.st.mined)).toBe(w.st.mined);
    expect(sum((r) => Object.values(r.came).reduce((a, b) => a + b, 0))).toBeGreaterThan(0);
    for (const r of recs) {
      expect(r.end).toBe('clear');
      expect(r.secs).toBeGreaterThan(0);
      expect(r.hp0 - r.hp).toBeLessThanOrEqual(r.leakDmg);
    }
    // the bot shops between waves
    expect(recs.slice(1).some((r) => r.bought.length > 0)).toBe(true);
  });

  it('ends the last wave as over when the dock falls', () => {
    expect(playGame(1, 'spam', 30, 1200).over).toBe(true);
    const w = startGame(1);
    const pilot = new Pilot(1, 'spam');
    const recs: WaveRecord[] = [];
    const log = new WaveLog((r) => recs.push(r));
    for (let t = 0; t < 30 * 1200 && w.phase !== 'over'; t++) {
      pilot.tick(w);
      if (w.phase === 'wave') step(w);
      log.frame(w, w.events.splice(0));
    }
    expect(recs[recs.length - 1].end).toBe('over');
    expect(recs[recs.length - 1].hp).toBe(0);
  });
});
