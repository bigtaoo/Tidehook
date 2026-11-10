import { describe, expect, it } from 'vitest';
import { SafeStore, type Board, type BoardEntry } from '../platform/types';
import { B } from '../sim/balance';
import { gameOver } from '../sim/monsters';
import { boardScore, boardWave, DailyBoard, DAY_SCALE } from './board';
import { dailySea, dayIndex, dayKey, daySeed } from './meta/daily';
import { Harbour } from './meta/harbour';
import { OVER_LOCK_MS, Session } from './session';

const DAY = '2026-11-10';
const FRAME = 1000 / 60;
const tick = () => new Promise((r) => setTimeout(r, 0));

function run(s: Session, ms: number): void {
  for (let t = 0; t < ms; t += FRAME) s.update(FRAME);
}

describe('daily voyage days', () => {
  it('keys the UTC date and seeds it the same every time', () => {
    expect(dayKey(Date.UTC(2026, 10, 10, 23, 59))).toBe(DAY);
    expect(dayKey(Date.UTC(2026, 10, 11, 0, 0))).toBe('2026-11-11');
    expect(daySeed(DAY)).toBe(daySeed(DAY));
    expect(daySeed(DAY)).not.toBe(daySeed('2026-11-11'));
    expect(daySeed(DAY)).toBeGreaterThan(0);
    expect(daySeed(DAY)).toBeLessThan(2 ** 31);
  });

  it('turns the seas day by day, every sea in turn', () => {
    const seas = Array.from({ length: B.seas.length }, (_, i) => dailySea(dayKey(Date.UTC(2026, 10, 10 + i))));
    expect(new Set(seas).size).toBe(B.seas.length);
    expect(dayIndex('not a day')).toBe(0);
  });
});

describe('daily board scores', () => {
  it('puts the day above the wave and reads it back only on its day', () => {
    expect(boardScore(DAY, 17)).toBe(dayIndex(DAY) * DAY_SCALE + 17);
    expect(boardScore('2026-11-11', 1)).toBeGreaterThan(boardScore(DAY, 999));
    expect(boardWave(DAY, boardScore(DAY, 17))).toBe(17);
    expect(boardWave('2026-11-11', boardScore(DAY, 17))).toBeNull();
    expect(boardScore(DAY, 5000) % DAY_SCALE).toBe(DAY_SCALE - 1);
  });
});

/** A board that keeps what it is sent and answers with `entries`. */
function stubBoard(entries: BoardEntry[]): Board & { sent: number[] } {
  const sent: number[] = [];
  return { sent, submit: async (s) => void sent.push(s), top: async () => entries };
}

function harbourSession(): { s: Session; h: Harbour } {
  const h = new Harbour(new SafeStore(null));
  h.pearls = 10_000;
  const s = new Session({ seed: 3, speed: 1, autoplay: null }, null, h);
  s.openLobby();
  expect(s.buyMeta('hull')).toBe(true);
  return { s, h };
}

describe('daily voyage in the session', () => {
  it("sails the day's seed and sea on its own tide, without the harbour's upgrades", () => {
    const { s } = harbourSession();
    expect(s.sailDaily(DAY)).toBe(true);
    expect(s.world.seed).toBe(daySeed(DAY));
    expect(s.world.sea).toBe(dailySea(DAY));
    expect(s.world.ease).toBe(B.daily.ease);
    expect(s.world.maxHp).toBe(B.dock.hp);
    expect(s.sailDaily(DAY)).toBe(false);
  });

  it("keeps the day's best, not the sea's, and a plain voyage after it is plain again", () => {
    const { s, h } = harbourSession();
    s.sailDaily(DAY);
    s.world.wave = 9;
    gameOver(s.world);
    run(s, 100);
    expect(s.last).toMatchObject({ wave: 9, daily: true, record: true });
    expect(h.dailyBest(DAY)).toBe(9);
    expect(h.best[B.seas[dailySea(DAY)].id] ?? 0).toBe(0);
    run(s, OVER_LOCK_MS + 50);
    s.tap();
    expect(s.mode).toBe('lobby');
    s.sailDaily(DAY);
    s.world.wave = 4;
    gameOver(s.world);
    run(s, 100);
    expect(s.last).toMatchObject({ daily: true, record: false });
    expect(h.dailyBest(DAY)).toBe(9);
    run(s, OVER_LOCK_MS + 50);
    s.tap();
    s.sail();
    expect(s.world.ease).not.toBe(B.daily.ease);
    expect(s.world.maxHp).toBe(B.dock.hp + 2);
  });

  it("sends a day's best once and shows only today's rows, best first", async () => {
    const { s } = harbourSession();
    const old = boardScore('2026-11-09', 80);
    const stub = stubBoard([
      { name: 'B', score: boardScore(DAY, 12), rank: 2 },
      { name: 'Old', score: old, rank: 3 },
      { name: 'A', score: boardScore(DAY, 20), rank: 1 },
    ]);
    const board = new DailyBoard(stub, () => DAY);
    board.frame(s);
    await tick();
    expect(board.rows?.map((r) => r.name)).toEqual(['A', 'B']);
    s.sailDaily(DAY);
    s.world.wave = 9;
    gameOver(s.world);
    run(s, 100);
    board.frame(s);
    board.frame(s);
    await tick();
    expect(stub.sent).toEqual([boardScore(DAY, 9)]);
    expect(board.rows?.[0]).toEqual({ rank: 1, name: 'A', wave: 20 });
  });

  it('sends nothing for a plain voyage and draws no board without a host one', () => {
    const { s } = harbourSession();
    const stub = stubBoard([]);
    const board = new DailyBoard(stub, () => DAY);
    s.sail();
    s.world.wave = 9;
    gameOver(s.world);
    run(s, 100);
    board.frame(s);
    expect(stub.sent).toEqual([]);
    expect(new DailyBoard(null, () => DAY).on).toBe(false);
  });
});
