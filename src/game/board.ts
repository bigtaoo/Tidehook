// The daily voyage's leaderboard (meta/daily.ts), where the host has one the game can draw
// (Platform.board: on Playgama a Bridge SaaS leaderboard). A host keeps one score per player, the
// best, and boards do not reset by the day, so the score is day * DAY_SCALE + wave: a later day
// always beats an earlier one, the day's waves rank among themselves, and today's players come
// first. The harbour shows only today's rows. Sent when a daily voyage beats the day's best.

import type { Board } from '../platform/types';
import { dayIndex } from './meta/daily';
import type { Session } from './session';

export const DAY_SCALE = 1000;
/** How many of today's rows the harbour shows. */
export const BOARD_ROWS = 10;

export interface DailyRow {
  rank: number;
  name: string;
  wave: number;
}

export function boardScore(day: string, wave: number): number {
  return dayIndex(day) * DAY_SCALE + Math.min(Math.max(0, wave), DAY_SCALE - 1);
}

/** The wave a score holds if it was set on `day`, else null. */
export function boardWave(day: string, score: number): number | null {
  return Math.floor(score / DAY_SCALE) === dayIndex(day) ? score % DAY_SCALE : null;
}

export class DailyBoard {
  /** Today's rows as last read, best first; null until read. */
  rows: DailyRow[] | null = null;
  /** Bumps whenever `rows` change, for the harbour to redraw. */
  version = 0;
  private sent = -1;
  private wasLobby = false;
  private asked = 0;
  /** The day the rows on screen were read for, so the harbour notices midnight passing. */
  private readDay = '';

  constructor(
    private readonly board: Board | null,
    private readonly today: () => string,
  ) {}

  get on(): boolean {
    return this.board !== null;
  }

  /** Once a frame: sends a daily voyage's new best, and reads the board on the way into the harbour. */
  frame(s: Session): void {
    if (!this.board) return;
    const { last } = s;
    if (s.mode === 'over' && !s.pending && last.daily && last.record && this.sent !== s.games) {
      this.sent = s.games;
      // the day it was sailed, not the day it ended: a voyage begun at 23:55 UTC and lost at 00:05
      // is yesterday's seed and yesterday's best, and scoring it as today's would plant a wave from
      // the wrong game at the head of today's board
      const day = s.daily ?? this.today();
      // a submit that fails (an offline player, a host that refuses) must not land as an unhandled
      // rejection; there is nothing to retry, since the harbour reads the board again on the way in
      void this.board
        .submit(boardScore(day, last.wave))
        .then(() => this.read())
        .catch(() => {});
    }
    const lobby = s.mode === 'lobby';
    // a player who sits in the harbour across midnight would otherwise keep yesterday's rows under
    // today's heading until they sail again
    if (lobby && (!this.wasLobby || this.today() !== this.readDay)) void this.read();
    this.wasLobby = lobby;
  }

  /** Reads today's rows; a slower answer than a later ask is dropped. */
  async read(): Promise<void> {
    if (!this.board) return;
    const ask = ++this.asked;
    const day = this.today();
    this.readDay = day;
    let got: DailyRow[] = [];
    try {
      const top = await this.board.top();
      got = top
        .map((e) => ({ rank: e.rank, name: e.name, wave: boardWave(day, e.score) }))
        .filter((r): r is DailyRow => r.wave !== null && r.wave > 0)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, BOARD_ROWS);
    } catch {
      got = [];
    }
    if (ask !== this.asked) return;
    this.rows = got;
    this.version++;
  }
}
