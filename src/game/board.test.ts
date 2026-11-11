import { describe, expect, it, vi } from 'vitest';
import { BOARD_ROWS, boardScore, boardWave, DAY_SCALE, DailyBoard } from './board';
import { dayIndex } from './meta/daily';
import type { Board, BoardEntry } from '../platform/types';
import type { Session } from './session';

const DAY = '2026-11-11';

/** Only the fields DailyBoard.frame reads; `day` is the day the voyage was sailed. */
function over(wave: number, games = 1, day: string | null = DAY): Session {
  return { mode: 'over', pending: false, games, daily: day, last: { wave, daily: day !== null, record: true } } as unknown as Session;
}

function lobby(): Session {
  return { mode: 'lobby', pending: false, games: 1, last: { wave: 0, daily: false, record: false } } as unknown as Session;
}

function rows(n: number): BoardEntry[] {
  return Array.from({ length: n }, (_, i) => ({ name: `p${i}`, score: boardScore(DAY, 20 - i), rank: i + 1 }));
}

describe('the score a board row carries', () => {
  it('puts a later day above every earlier one, and clamps a silly wave', () => {
    expect(boardScore(DAY, 12)).toBe(dayIndex(DAY) * DAY_SCALE + 12);
    expect(boardScore(DAY, 12)).toBeLessThan(boardScore('2026-11-12', 0));
    expect(boardScore(DAY, -5) % DAY_SCALE).toBe(0);
    expect(boardScore(DAY, 9999) % DAY_SCALE).toBe(DAY_SCALE - 1);
  });

  it('reads back only as a wave set today', () => {
    expect(boardWave(DAY, boardScore(DAY, 12))).toBe(12);
    expect(boardWave(DAY, boardScore('2026-11-10', 12))).toBeNull();
  });
});

describe('the daily board', () => {
  it('is off where the host has none, and never calls out', () => {
    const b = new DailyBoard(null, () => DAY);
    b.frame(over(12));
    expect(b.on).toBe(false);
    expect(b.rows).toBeNull();
  });

  it("sends a daily record once, then reads today's rows", async () => {
    const submit = vi.fn(async () => {});
    const b = new DailyBoard({ submit, top: async () => rows(12) }, () => DAY);
    b.frame(over(12));
    b.frame(over(12));
    await vi.waitFor(() => expect(b.rows).not.toBeNull());
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(boardScore(DAY, 12));
    expect(b.rows).toHaveLength(BOARD_ROWS);
    expect(b.rows?.[0]).toEqual({ rank: 1, name: 'p0', wave: 20 });
  });

  it('shrugs off a host that refuses the score, instead of leaving a rejection loose', async () => {
    const trouble: Board = { submit: () => Promise.reject(new Error('offline')), top: async () => rows(3) };
    const b = new DailyBoard(trouble, () => DAY);
    expect(() => b.frame(over(12))).not.toThrow();
    // the harbour's own read still fills the rows in, so nothing is lost but the one send
    b.frame(lobby());
    await vi.waitFor(() => expect(b.rows).toHaveLength(3));
  });

  it('shows no rows at all where the board cannot be read', async () => {
    const b = new DailyBoard({ submit: async () => {}, top: () => Promise.reject(new Error('offline')) }, () => DAY);
    b.frame(lobby());
    await vi.waitFor(() => expect(b.rows).toEqual([]));
    expect(b.version).toBe(1);
  });

  it('scores a voyage under the day it was sailed, not the day it ended', async () => {
    const submit = vi.fn(async () => {});
    // the player cast off at 23:55 and lost the dock ten minutes later, on the far side of midnight
    const b = new DailyBoard({ submit, top: async () => [] }, () => '2026-11-12');
    b.frame(over(12, 1, '2026-11-11'));
    expect(submit).toHaveBeenCalledWith(boardScore('2026-11-11', 12));
    await vi.waitFor(() => expect(b.rows).not.toBeNull());
  });

  it('reads the board again when midnight passes under a player sitting in the harbour', async () => {
    const top = vi.fn(async () => rows(2));
    let day = DAY;
    const b = new DailyBoard({ submit: async () => {}, top }, () => day);
    b.frame(lobby());
    await vi.waitFor(() => expect(top).toHaveBeenCalledTimes(1));
    b.frame(lobby());
    expect(top).toHaveBeenCalledTimes(1);
    day = '2026-11-12';
    b.frame(lobby());
    await vi.waitFor(() => expect(top).toHaveBeenCalledTimes(2));
    // the rows it was showing were yesterday's, so the new day starts empty
    expect(b.rows).toEqual([]);
  });

  it('drops rows from another day and keeps the best first', async () => {
    const mixed: BoardEntry[] = [
      { name: 'old', score: boardScore('2026-11-01', 40), rank: 1 },
      { name: 'now', score: boardScore(DAY, 7), rank: 3 },
      { name: 'zero', score: boardScore(DAY, 0), rank: 2 },
    ];
    const b = new DailyBoard({ submit: async () => {}, top: async () => mixed }, () => DAY);
    await b.read();
    expect(b.rows).toEqual([{ rank: 3, name: 'now', wave: 7 }]);
  });
});
