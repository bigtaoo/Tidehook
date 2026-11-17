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
  /** The best day and wave this sitting has put on the board, so the same run is not sent twice
   *  and a run that was never sent is. */
  private sentDay = '';
  private sentWave = 0;
  private wasLobby = false;
  private asked = 0;
  /** The day the rows on screen were read for, so the harbour notices midnight passing. */
  private readDay = '';
  /** The day `rows` were actually read for: a read that never answered leaves the rows it did not
   *  replace on screen, and once midnight has passed those are yesterday's ranks under today's
   *  heading. Better the waiting word than another day's board read as this one's. */
  private rowsDay = '';

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
    // the day it was sailed, not the day it ended: a voyage begun at 23:55 UTC and lost at 00:05
    // is yesterday's seed and yesterday's best, and scoring it as today's would plant a wave from
    // the wrong game at the head of today's board
    if (s.mode === 'over' && !s.pending && last.daily && last.record) this.post(s.daily ?? this.today(), last.wave);
    const lobby = s.mode === 'lobby';
    // a player who sits in the harbour across midnight would otherwise keep yesterday's rows under
    // today's heading until they sail again
    if (lobby) {
      const day = this.today();
      // The day's best as the harbour has it, which is the one place it survives the sitting it
      // was sailed in. The send above rides on the frame loop, and some runs end with no frame
      // left to carry it: the page goes while the game-over card is still up (game/lastCall.ts
      // counts that run), or the submit itself failed on a player who was offline just then. Both
      // left a record run banked at home and missing from the day's board for good, with nothing
      // said anywhere. This is the repair, and it costs one send a sitting at most, for a player
      // who has sailed today's voyage and whose best is not already up.
      if (!this.wasLobby || day !== this.readDay) {
        this.post(day, s.harbour?.dailyBest(day) ?? 0);
        void this.read();
      }
      if (this.rows && this.rowsDay !== day) {
        this.rows = null;
        this.version++;
      }
    }
    this.wasLobby = lobby;
  }

  /** Puts `wave` on `day`'s board, unless this sitting has already put that or better there. A
   *  submit that fails gives the mark back, so the next way into the harbour tries again. */
  private post(day: string, wave: number): void {
    if (!this.board || wave <= 0 || (day === this.sentDay && wave <= this.sentWave)) return;
    const wasDay = this.sentDay;
    const wasWave = this.sentWave;
    this.sentDay = day;
    this.sentWave = wave;
    // a submit that fails (an offline player, a host that refuses) must not land as an unhandled
    // rejection either
    void this.board
      .submit(boardScore(day, wave))
      .then(() => this.read())
      .catch(() => {
        this.sentDay = wasDay;
        this.sentWave = wasWave;
      });
  }

  /** Reads today's rows; a slower answer than a later ask is dropped. */
  async read(): Promise<void> {
    if (!this.board) return;
    const ask = ++this.asked;
    const day = this.today();
    this.readDay = day;
    let top;
    try {
      top = await this.board.top();
    } catch {
      // an offline player, a host that said no. Nothing read is not the same as nobody there:
      // leave the rows as they are - what was last read, or the waiting word if this was the first
      // ask - rather than telling the player today's board is empty. The harbour asks again on the
      // next way in.
      return;
    }
    const got = top
      .map((e) => ({ rank: e.rank, name: e.name, wave: boardWave(day, e.score) }))
      .filter((r): r is DailyRow => r.wave !== null && r.wave > 0)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, BOARD_ROWS);
    if (ask !== this.asked) return;
    this.rowsDay = day;
    this.rows = got;
    this.version++;
  }
}
