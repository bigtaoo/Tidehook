import { describe, expect, it } from 'vitest';
import { B } from './balance';
import { counts } from './goals';
import { pearlsFor } from './meta';
import { chartOpen, seaIndex } from './seas';
import { startGame } from './step';
import { level } from './tide';
import { updateWave } from './waves';

describe('the seas', () => {
  const fog = seaIndex('fog');
  const storm = seaIndex('storm');

  it('starts the tide ahead and pays more pearls', () => {
    const bay = startGame(1, 0, {}, 0);
    const far = startGame(1, 0, {}, storm);
    expect(level(far) - level(bay)).toBe(B.seas[storm].lead * 1000);
    for (const w of [bay, far]) {
      w.wave = 10;
      w.phase = 'shop';
    }
    expect(pearlsFor(far)).toBe((pearlsFor(bay) * B.seas[storm].pearls) / 1000);
  });

  it('sends faster monsters in the storm and closer ones in the fog', () => {
    const run = (sea: number) => {
      const w = startGame(2, 0, {}, sea);
      for (let i = 0; i < 400 && !w.mons.length; i++) updateWave(w);
      return w;
    };
    const bay = run(0);
    const st = run(storm);
    expect(st.mons[0].speed).toBeGreaterThan(bay.mons[0].speed);
    expect(B.seas[fog].gap).toBeLessThan(1000);
  });

  it("counts a game's wave under its sea, for the record", () => {
    const w = startGame(3, 0, {}, fog);
    w.wave = 7;
    expect(counts(w)).toMatchObject({ fog: 7, wave: 7 });
  });

  it('puts a chart on sale once the sea before it is sailed far enough', () => {
    expect(chartOpen(0, {})).toBe(true);
    expect(chartOpen(fog, { bay: B.seas[fog].needs - 1 })).toBe(false);
    expect(chartOpen(fog, { bay: B.seas[fog].needs })).toBe(true);
    expect(chartOpen(storm, { bay: 99 })).toBe(false);
    expect(seaIndex('nowhere')).toBe(0);
  });
});

