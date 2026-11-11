import { describe, expect, it } from 'vitest';
import { B } from './balance';
import { nextWave, startGame, step } from './step';
import { level } from './tide';
import { spawnGap, startWave, waveMix } from './waves';
import type { World } from './world';

/** Clears the wave at once: the lane empty, the queue gone, the clear delay run out. */
function clearWave(w: World): void {
  w.queue = [];
  w.mons = [];
  for (let i = 0; i <= B.waves.clearDelay + 1 && w.phase === 'wave'; i++) step(w);
}

describe("the sea climbs slower at the start of a player's game", () => {
  it('a bare game reads the wave as it is, up to the surge', () => {
    const w = startGame(1);
    for (const wave of [1, 2, 7, 30]) expect(level(w, wave)).toBe(wave * 1000);
  });

  it('climbs faster once the surge wave is past', () => {
    const { pace, surge, surgeFrom, waves } = B.tide;
    const w = startGame(1, waves);
    const slow = 1000 + waves * pace;
    const mid = (surgeFrom - 1 - waves) * 1000;
    expect(level(w, waves + 1)).toBe(slow);
    expect(level(w, surgeFrom)).toBe(slow + mid);
    expect(level(w, surgeFrom + 3)).toBe(slow + mid + 3 * surge);
  });

  it('says so one wave before the surge bites, and only then', () => {
    const w = startGame(1, B.tide.waves);
    w.wave = B.tide.surgeFrom - 1;
    startWave(w);
    expect(w.wave).toBe(B.tide.surgeFrom);
    expect(w.events.some((e) => e.e === 'tide')).toBe(true);
    const warned = level(w, w.wave);
    w.events = [];
    startWave(w);
    expect(w.events.some((e) => e.e === 'tide')).toBe(false);
    expect(level(w, w.wave) - warned).toBe(B.tide.surge);
  });

  it('the surge reaches a bare game too, just as late', () => {
    const w = startGame(1);
    const { surge, surgeFrom } = B.tide;
    expect(level(w, surgeFrom)).toBe(surgeFrom * 1000);
    expect(level(w, surgeFrom + 2)).toBe(surgeFrom * 1000 + 2 * surge);
  });

  it('an eased game climbs at the pace, then one a wave', () => {
    const w = startGame(1, 10);
    const pace = B.tide.pace;
    expect(level(w, 1)).toBe(1000);
    expect(level(w, 5)).toBe(1000 + 4 * pace);
    expect(level(w, 11)).toBe(1000 + 10 * pace);
    expect(level(w, 13)).toBe(1000 + 10 * pace + 2000);
  });

  it('mixes and gaps are the old per-wave ones on whole waves', () => {
    expect(waveMix(1000)).toEqual({ grunt: 4, darter: 0, brute: 0, glutton: 0, hermit: 0, ray: 0, puffer: 0, moray: 0 });
    expect(waveMix(3500)).toEqual(waveMix(3000));
    expect(spawnGap(2000)).toBeLessThan(spawnGap(1500));
  });

  it('wave 1 is the same with or without the ease (the first seed was picked on it)', () => {
    const a = startGame(9);
    const b = startGame(9, 30);
    for (let i = 0; i < 300; i++) {
      step(a);
      step(b);
    }
    expect(b.mons.map((m) => [m.kind, m.d, m.w, m.hp, m.speed])).toEqual(a.mons.map((m) => [m.kind, m.d, m.w, m.hp, m.speed]));
  });

  it('patches the dock by the harbour menders after each wave, never above full', () => {
    const w = startGame(1, 0, { mend: 2 });
    expect(w.mend).toBe(2);
    w.hp = w.maxHp - 5;
    clearWave(w);
    expect(w.phase).toBe('shop');
    expect(w.hp).toBe(w.maxHp - 3);
    expect(w.events.some((e) => e.e === 'mend')).toBe(true);
    expect(w.mended).toBe(2);
    w.hp = w.maxHp - 1;
    nextWave(w);
    clearWave(w);
    expect(w.hp).toBe(w.maxHp);
    expect(w.mended).toBe(1);
    const bare = startGame(1);
    bare.hp = bare.maxHp - 5;
    clearWave(bare);
    expect(bare.hp).toBe(bare.maxHp - 5);
    expect(bare.mended).toBe(0);
  });
});
