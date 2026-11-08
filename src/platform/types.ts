// What the game needs from the page it runs in, after Potion Siege's platform/types.ts, cut to
// what v1 uses (docs/01-tech-plan.md section 6). Each target (web, CrazyGames, Playgama) gets
// its own implementation and entry file.

/** A key/value store that behaves like localStorage. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Platform {
  /** Short id for telemetry, e.g. 'web' or 'crazygames'. */
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
  /** Plays a rewarded ad; true only if the player earned the reward. */
  rewarded(onStart: () => void): Promise<boolean>;
  /** Plays an interstitial at a natural break; resolves when it is over (or skipped). */
  midgame(onStart: () => void): Promise<void>;
  /** Called with the host's mute state now and whenever it changes. */
  onHostMute(listener: (muted: boolean) => void): void;
  /** Called whenever the host pauses the game; absent: never. */
  onHostPause?(listener: () => void): void;
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
