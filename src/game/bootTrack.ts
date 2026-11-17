// Boot telemetry: what the load itself cost, and who left during it. Playgama's own numbers start
// at game_ready, so a player who gave up on the loading page is invisible there; these three
// events are the part before the game (Swarm Orbit's lesson, docs/01-tech-plan.md section 8):
// - `load`, once, when the first frame is ready: how long the player waited and on what;
// - `boot_left`, when the page goes away before that: the stage it had reached and how full the
//   bar was, which says whether people leave on a slow line or on a slow renderer;
// - `boot_error`, when boot gives up: the stage and a fixed word for the kind. The word is fixed
//   on purpose — free text does not survive the host's reports, and an error message is where a
//   URL or a file path would leak in.
// Nothing here carries a message, a stack or anything about the player.

import type { Platform, TrackData } from '../platform/types';
import type { BootScreen, BootStage } from '../boot/screen';

/** The kinds of boot failure, kept to these three words. */
export const ERROR_KINDS = ['fetch', 'webgl', 'other'] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];

const FETCH = /fetch|network|load|import|chunk|script|timeout|abort/i;
const WEBGL = /webgl|webgpu|context|gpu|renderer|canvas|adapter/i;

/** Which of ERROR_KINDS `err` is, read off its words and thrown away after. */
export function errorKind(err: unknown): ErrorKind {
  const text = `${(err as { name?: string } | null)?.name ?? ''} ${String((err as { message?: string } | null)?.message ?? err ?? '')}`;
  if (WEBGL.test(text)) return 'webgl';
  if (FETCH.test(text)) return 'fetch';
  return 'other';
}

/** An error's class name, bounded: one of the browser's own, or 'unknown'. */
function errorName(err: unknown): string {
  const n = (err as { name?: unknown } | null)?.name;
  return typeof n === 'string' && /^[A-Za-z]{1,32}$/.test(n) ? n : 'unknown';
}

type Win = Pick<Window, 'addEventListener' | 'removeEventListener' | 'innerWidth' | 'innerHeight'> & { devicePixelRatio?: number };

export class BootTrack {
  private at: BootStage = 'sdk';
  private over = false;
  private readonly leave = () => this.left();
  // a tab merely coming back to the front is not a player leaving
  private readonly hid = () => this.doc.visibilityState === 'hidden' && this.left();

  constructor(
    private readonly platform: Platform,
    private readonly screen: BootScreen,
    private readonly build: string,
    private readonly win: Win,
    private readonly doc: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>,
  ) {
    win.addEventListener('pagehide', this.leave, true);
    doc.addEventListener('visibilitychange', this.hid, true);
  }

  /** Where boot has got to; the next event carries it. */
  stage(s: BootStage): void {
    this.at = s;
  }

  /** The first frame is ready: the one `load` event, with whatever the caller knows besides. */
  loaded(extra: TrackData = {}): void {
    this.stage('ready');
    if (this.done()) return;
    this.platform.track('load', {
      load_ms: Math.min(600_000, Math.max(0, Date.now() - this.screen.t0)),
      platform: this.platform.name,
      build_version: this.build,
      screen_w: Math.round(this.win.innerWidth),
      screen_h: Math.round(this.win.innerHeight),
      dpr: Math.round((this.win.devicePixelRatio ?? 1) * 100) / 100,
      ...this.platform.info?.(),
      ...extra,
    });
  }

  /** Boot gave up: one `boot_error`, and the loading page offers a retry.
   *
   *  The host is told the game is ready here too. `platform.loaded()` is the last line of boot
   *  (src/app.ts), so a throw anywhere before it means `game_ready` never went out, and on a portal
   *  the host's own loading cover stays over the page for good - over the retry button this very
   *  method just put there. The player is left looking at the host's spinner with nothing to tap
   *  and nothing said. Readiness here means only that the page is the player's to see; what it
   *  shows is the failure. */
  failed(err: unknown): void {
    if (this.done()) return;
    this.screen.fail();
    this.platform.track('boot_error', { stage: this.at, kind: errorKind(err), error_name: errorName(err) });
    this.platform.loaded();
  }

  /** The page went away before the game was ready.
   *
   *  `pagehide` is the one event a page going for good is promised, and it fires while the page is
   *  still visible: unloading a document hides it afterwards (and on iOS a page is often frozen
   *  with no visibilitychange at all). Weighing the visibility here threw that event away and left
   *  the player who gave up on the loading page - the very thing this file exists to count, and
   *  the one the host's own numbers cannot see - unreported, on the way out, where nothing is
   *  left to notice it. Only the visibility event asks about visibility now. */
  private left(): void {
    if (this.done()) return;
    this.platform.track('boot_left', {
      stage: this.at,
      seconds: Math.min(600, Math.round((Date.now() - this.screen.t0) / 1000)),
      percent: Math.round(this.screen.at() * 100),
      screen_w: Math.round(this.win.innerWidth),
      screen_h: Math.round(this.win.innerHeight),
    });
  }

  /** True once anything has been sent: boot reports itself once, however it ended. */
  private done(): boolean {
    if (this.over) return true;
    this.over = true;
    this.win.removeEventListener('pagehide', this.leave, true);
    this.doc.removeEventListener('visibilitychange', this.hid, true);
    return false;
  }
}
