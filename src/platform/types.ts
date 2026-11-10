// What the game needs from the page it runs in, after Potion Siege's platform/types.ts, cut to
// what v1 uses (docs/01-tech-plan.md section 6). Each target (the plain web, Playgama) gets its
// own implementation and entry file.

/** One telemetry event's fields: bounded values only, never anything about the player. */
export type TrackData = Record<string, string | number | boolean>;

/** A key/value store that behaves like localStorage. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** What a rewarded ad pays for (game/ads.ts). */
export type RewardedPlacement = 'revive' | 'double' | 'reroll';
/** Where an interstitial plays: the shop opening, or on the way back to the harbour. */
export type BreakPlacement = 'shop' | 'harbour';

/** One leaderboard entry: the player's name on the host, a score, a rank (1 the best). */
export interface BoardEntry {
  name: string;
  score: number;
  rank: number;
}

/** The host's leaderboard for the daily voyage (game/board.ts). */
export interface Board {
  /** Resolves once the host has taken it (or failed to). */
  submit(score: number): Promise<void>;
  /** The entries, best first; empty on any trouble. */
  top(): Promise<BoardEntry[]>;
}

/** The host's payments, for the one product the game sells (game/noAds.ts). */
export interface Payments {
  /** The ids of the products the player owns; empty on any trouble. */
  owned(): Promise<string[]>;
  /** Product `id`'s price in the player's currency, worded by the host; '' when it has none. */
  price(id: string): Promise<string>;
  /** Buys product `id` (from a player's press only); true once it is bought. */
  buy(id: string): Promise<boolean>;
}

export interface Platform {
  /** Short id for telemetry, e.g. 'web' or 'playgama'. */
  readonly name: string;
  storage: KeyValueStore;
  /** Preferred languages, most preferred first. */
  languages(): string[];
  /** The game finished loading and can be played. */
  loaded(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  /** Whether a rewarded ad can be offered right now. */
  rewardedAvailable(): boolean;
  /** An adblocker keeps the host's rewarded ads off; absent: never. */
  adBlocked?(): boolean;
  /** Plays a rewarded ad; true only if the player earned the reward. `placement` names the offer
   *  for the host's own ad reports (Bridge's showRewarded), so the game sends no ad events itself. */
  rewarded(onStart: () => void, placement?: RewardedPlacement): Promise<boolean>;
  /** Plays an interstitial at a natural break; resolves when it is over (or skipped). */
  midgame(onStart: () => void, placement?: BreakPlacement): Promise<void>;
  /** The player did something worth a cheer (a new best, a log goal); the host may show it. */
  celebrate(): void;
  /** One telemetry event for the host (game/telemetry.ts). */
  track(event: string, data: TrackData): void;
  /** Called with the host's mute state now and whenever it changes. */
  onHostMute(listener: (muted: boolean) => void): void;
  /** Called whenever the host pauses the game; absent: never. */
  onHostPause?(listener: () => void): void;
  /** The daily voyage's leaderboard, where the host has one the game can draw; absent: none. */
  board?(): Board | null;
  /** The host's payments, where it sells the game's products; absent: none. */
  payments?(): Payments | null;
  /** The element the canvas fills; the window when absent. */
  readonly mount?: HTMLElement;
}

/** Storage that never throws: falls back to memory when the real one does. */
export class SafeStore implements KeyValueStore {
  private readonly memory = new Map<string, string>();

  constructor(private readonly inner: KeyValueStore | null) {}

  getItem(key: string): string | null {
    try {
      const v = this.inner?.getItem(key);
      if (typeof v === 'string') return v;
    } catch {
      /* fall through to memory */
    }
    return this.memory.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.memory.set(key, value);
    try {
      this.inner?.setItem(key, value);
    } catch {
      /* memory keeps it for this session */
    }
  }
}
