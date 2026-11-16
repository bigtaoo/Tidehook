// The loading page's handle (index.html). The page itself is plain HTML and a plain script, so it
// is on screen while the bundle and the art come down; this is the bundle's side of it: the boot
// path moves the bar through the stages below, hides the page when the first frame is ready, and
// shows the retry button when boot gives up. Everything is optional: tests and any page without
// the markup get NONE, and the game boots as it always did.

/** What the loading page offers the game (index.html's window.__thBoot). */
export interface BootScreen {
  /** Date.now() when the page's own script ran: the start of the load the player waited through. */
  readonly t0: number;
  /** How full the bar is, 0 to 1. */
  at(): number;
  /** The bundle is running: the bar stops creeping and takes real numbers. */
  started(): void;
  set(p: number): void;
  /** Gives up: the bar goes, the retry button comes. */
  fail(): void;
  /** The game is ready: the page fades out. */
  done(): void;
}

const NONE: BootScreen = { t0: Date.now(), at: () => 0, started() {}, set() {}, fail() {}, done() {} };

/** Where the boot has got to, for `load`, `boot_left` and `boot_error` (game/bootTrack.ts). */
export const BOOT_STAGES = ['sdk', 'gpu', 'art', 'ready'] as const;
export type BootStage = (typeof BOOT_STAGES)[number];

/** How full the bar is once each stage is behind us; the art fills the gap to ART_TO as it loads. */
export const STAGE_AT: Record<BootStage, number> = { sdk: 0.35, gpu: 0.5, art: 0.95, ready: 1 };
const ART_FROM = STAGE_AT.gpu;
const ART_TO = STAGE_AT.art;

/** The loading page, or a no-op stand-in where the page has none (tests, a stripped host). */
export function bootScreen(win: unknown = globalThis): BootScreen {
  const s = (win as { __thBoot?: Partial<BootScreen> } | null)?.__thBoot;
  if (!s || typeof s.set !== 'function' || typeof s.done !== 'function') return NONE;
  return {
    t0: typeof s.t0 === 'number' ? s.t0 : NONE.t0,
    at: () => (typeof s.at === 'function' ? s.at() : 0),
    started: () => s.started?.(),
    set: (p) => s.set?.(p),
    fail: () => s.fail?.(),
    done: () => s.done?.(),
  };
}

/** The bar's place for `done` of `total` art files loaded. */
export function artAt(done: number, total: number): number {
  if (total <= 0) return ART_TO;
  return ART_FROM + ((ART_TO - ART_FROM) * Math.min(done, total)) / total;
}
