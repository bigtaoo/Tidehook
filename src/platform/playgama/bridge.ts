// The Playgama Bridge SDK (v2, https://wiki.playgama.com/playgama/bridge-sdk), wrapped so nothing
// in the game can be broken by it: the script is missing under an adblocker and in tests, so every
// call is a no-op without it, every throw or rejection is swallowed, initialize() is bounded
// (BRIDGE_WAIT_MS), and an ad whose states stop coming is given up (AD_START_MS, AD_PLAY_MS).
// After Potion Siege's platform/playgama/bridge.ts; leaderboards only where the game draws them
// itself (type in_game, Bridge SaaS on Playgama); payments for the one permanent product, the
// remove-ads purchase (game/noAds.ts).

export type BridgeData = Record<string, string | number | boolean>;

type Listener = (...args: unknown[]) => void;

interface Emitter {
  on?: (event: string, cb: Listener) => unknown;
}

/** The SDK as used here; every member optional because it is a remote script. */
export interface BridgeShape {
  initialize?: () => unknown;
  version?: string;
  platform?: Emitter & {
    id?: string;
    language?: string;
    isAudioEnabled?: boolean;
    sendMessage?: (message: string) => unknown;
  };
  storage?: {
    get?: (keys: string[], tryParseJson?: boolean) => unknown;
    set?: (keys: string[], values: string[]) => unknown;
  };
  advertisement?: Emitter & {
    isInterstitialSupported?: boolean;
    isRewardedSupported?: boolean;
    showInterstitial?: (placement?: string) => unknown;
    showRewarded?: (placement?: string) => unknown;
    checkAdBlock?: () => unknown;
  };
  device?: { type?: string };
  leaderboards?: {
    type?: string;
    setScore?: (id: string, score: number) => unknown;
    getEntries?: (id: string) => unknown;
  };
  analytics?: { send?: (event: string, data?: BridgeData) => unknown };
  payments?: {
    isSupported?: boolean;
    purchase?: (id: string) => unknown;
    getPurchases?: () => unknown;
    getCatalog?: () => unknown;
  };
}

/** One leaderboard entry, as much as the game shows. */
export interface BoardRow {
  name: string;
  score: number;
  rank: number;
}

export interface BridgeGlobal {
  bridge?: BridgeShape;
}

/** How long boot waits for initialize(); a blocked platform script never answers. */
export const BRIDGE_WAIT_MS = 5000;
/** An ad that has not opened by then is given up, and one that opened but never closes is given
 *  up after AD_PLAY_MS, as on CrazyGames: a platform that never answers must not freeze the game. */
export const AD_START_MS = 10_000;
export const AD_PLAY_MS = 120_000;
/** How long boot waits for the adblock probe; no answer counts as no adblocker. */
export const ADBLOCK_WAIT_MS = 1500;

export type Wait = (ms: number) => Promise<void>;

/** The string `id`s in a list of objects Bridge gave back. */
function ids(got: unknown): string[] {
  if (!Array.isArray(got)) return [];
  return got.flatMap((e: unknown) => {
    const id = (e as Record<string, unknown> | null)?.id;
    return typeof id === 'string' ? [id] : [];
  });
}

async function settle(fn: () => unknown): Promise<unknown> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

function guard(fn: () => void): void {
  try {
    fn();
  } catch {
    /* the game's problem, never the SDK's */
  }
}

type AdEvent = 'rewarded_state_changed' | 'interstitial_state_changed';

export class PlaygamaBridge {
  private sdk: BridgeShape | null = null;
  private adblock = false;
  /** The ad waiting for its end, if any: states of its kind go to it. */
  private inFlight: { event: AdEvent; listen: (state: unknown) => void } | null = null;
  private readonly subscribed = new Set<AdEvent>();

  constructor(
    private readonly global: BridgeGlobal = globalThis as BridgeGlobal,
    private readonly wait: Wait = (ms) => new Promise((r) => setTimeout(r, ms)),
    private readonly timers: { set: (fn: () => void, ms: number) => unknown; clear: (t: unknown) => void } = {
      set: (fn, ms) => setTimeout(fn, ms),
      clear: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
    },
  ) {}

  /** Runs initialize() and probes for an adblocker; false without the script, on a rejection
   *  or after BRIDGE_WAIT_MS. */
  async init(): Promise<boolean> {
    const sdk = this.global.bridge;
    if (!sdk || typeof sdk.initialize !== 'function') return false;
    const done = settle(async () => {
      await sdk.initialize?.();
      return true;
    });
    if ((await Promise.race([done, this.wait(BRIDGE_WAIT_MS).then(() => false)])) !== true) return false;
    this.sdk = sdk;
    const probe = settle(() => sdk.advertisement?.checkAdBlock?.());
    this.adblock = (await Promise.race([probe, this.wait(ADBLOCK_WAIT_MS).then(() => false)])) === true;
    return true;
  }

  isReady(): boolean {
    return this.sdk !== null;
  }

  /** The platform Bridge runs on ('playgama', 'playgama_sandbox', 'mock', …); null without it. */
  platformId(): string | null {
    const id = this.sdk?.platform?.id;
    return typeof id === 'string' && id !== '' ? id : null;
  }

  version(): string | null {
    const v = this.sdk?.version;
    return typeof v === 'string' ? v : null;
  }

  /** The player's language as the platform reports it (ISO 639-1), null without it. */
  language(): string | null {
    const v = this.sdk?.platform?.language;
    return typeof v === 'string' && v !== '' ? v : null;
  }

  /** 'mobile', 'tablet', 'desktop' or 'tv'; null without it. */
  deviceType(): string | null {
    const v = this.sdk?.device?.type;
    return typeof v === 'string' && v !== '' ? v : null;
  }

  /** game_ready, gameplay_started, gameplay_stopped, player_got_achievement. */
  send(message: string): void {
    void settle(() => this.sdk?.platform?.sendMessage?.(message));
  }

  /** One custom analytics event (Bridge 2.3.0 and newer; a no-op before). */
  track(event: string, data?: BridgeData): void {
    void settle(() => this.sdk?.analytics?.send?.(event, data));
  }

  /** The platform's pause: true when it asks the game to stop (an overlay, the tab hidden). */
  onPause(cb: (paused: boolean) => void): void {
    void settle(() => this.sdk?.platform?.on?.('pause_state_changed', (p) => guard(() => cb(p === true))));
  }

  /** The platform's sound switch: called now with whether to mute, then on every change. */
  onMute(cb: (muted: boolean) => void): void {
    if (!this.sdk) return;
    guard(() => cb(this.sdk?.platform?.isAudioEnabled === false));
    void settle(() => this.sdk?.platform?.on?.('audio_state_changed', (on) => guard(() => cb(on === false))));
  }

  /** Reads `keys` in one call; values come back as strings (objects are stringified again). */
  async load(keys: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const got = await settle(() => this.sdk?.storage?.get?.(keys, false));
    if (!Array.isArray(got)) return out;
    keys.forEach((key, i) => {
      const v: unknown = got[i];
      if (typeof v === 'string') out.set(key, v);
      else if (v !== null && v !== undefined) out.set(key, JSON.stringify(v));
    });
    return out;
  }

  save(entries: Map<string, string>): void {
    void settle(() => this.sdk?.storage?.set?.([...entries.keys()], [...entries.values()]));
  }

  /** Whether leaderboard `id` can be both written and read here: Bridge's type in_game (on Playgama
   *  that takes a Bridge SaaS leaderboard in the config). Native or popup boards are left alone. */
  boardReady(): boolean {
    const b = this.sdk?.leaderboards;
    return b?.type === 'in_game' && typeof b.setScore === 'function' && typeof b.getEntries === 'function';
  }

  /** Resolves once Bridge has answered (or failed). */
  async setScore(id: string, score: number): Promise<void> {
    if (this.boardReady()) await settle(() => this.sdk?.leaderboards?.setScore?.(id, score));
  }

  /** Leaderboard `id`'s entries, best first; empty on any trouble. */
  async entries(id: string): Promise<BoardRow[]> {
    if (!this.boardReady()) return [];
    const got = await settle(() => this.sdk?.leaderboards?.getEntries?.(id));
    if (!Array.isArray(got)) return [];
    return got.flatMap((e: unknown): BoardRow[] => {
      const r = (e ?? {}) as Record<string, unknown>;
      const score = Number(r.score);
      const rank = Number(r.rank);
      if (!Number.isSafeInteger(score) || !Number.isSafeInteger(rank)) return [];
      return [{ name: typeof r.name === 'string' ? r.name.slice(0, 40) : '', score, rank }];
    });
  }

  /** Whether the platform sells the game's products (Bridge payments, ids in the config). */
  paymentsReady(): boolean {
    const p = this.sdk?.payments;
    return p?.isSupported === true && typeof p.purchase === 'function' && typeof p.getPurchases === 'function' && typeof p.getCatalog === 'function';
  }

  /** The ids of the products the player owns; empty on any trouble. Read on every launch: a
   *  permanent product is never consumed, so it stays on this list. */
  async purchases(): Promise<string[]> {
    if (!this.paymentsReady()) return [];
    return ids(await settle(() => this.sdk?.payments?.getPurchases?.()));
  }

  /** Product `id`'s price as the platform words it, in the player's currency; '' when the
   *  catalog has no such product (it is described in the developer console, not in the config). */
  async price(id: string): Promise<string> {
    if (!this.paymentsReady()) return '';
    const got = await settle(() => this.sdk?.payments?.getCatalog?.());
    if (!Array.isArray(got)) return '';
    const item = got.find((e: unknown) => (e as Record<string, unknown> | null)?.id === id) as Record<string, unknown> | undefined;
    return typeof item?.price === 'string' ? item.price.slice(0, 24) : '';
  }

  /** Buys product `id`, from a player's press only; true once the platform says it is bought,
   *  false when the player backs out or anything fails. */
  async purchase(id: string): Promise<boolean> {
    if (!this.paymentsReady()) return false;
    try {
      await this.sdk?.payments?.purchase?.(id);
      return true;
    } catch {
      return false;
    }
  }

  hasAdblock(): boolean {
    return this.adblock;
  }

  rewardedSupported(): boolean {
    return this.sdk?.advertisement?.isRewardedSupported === true;
  }

  /** One rewarded ad: true only once Bridge said 'rewarded' and the ad then closed. */
  rewarded(started?: () => void, placement?: string): Promise<boolean> {
    if (!this.rewardedSupported()) return Promise.resolve(false);
    return this.show('rewarded_state_changed', (ad) => ad.showRewarded?.(placement), started);
  }

  /** One interstitial; resolves when it closed or failed (a cooldown fails at once). */
  async interstitial(started?: () => void, placement?: string): Promise<void> {
    if (this.sdk?.advertisement?.isInterstitialSupported !== true) return;
    await this.show('interstitial_state_changed', (ad) => ad.showInterstitial?.(placement), started);
  }

  private show(event: AdEvent, call: (ad: NonNullable<BridgeShape['advertisement']>) => unknown, started?: () => void): Promise<boolean> {
    const ad = this.sdk?.advertisement;
    if (!ad || typeof ad.on !== 'function') return Promise.resolve(false);
    // one ad at a time: an earlier one still waiting for its end is given up as unpaid
    this.inFlight?.listen('failed');
    return new Promise<boolean>((resolve) => {
      let paid = false;
      let timer: unknown;
      const watch = (ms: number) => {
        this.timers.clear(timer);
        timer = this.timers.set(() => listen('failed'), ms);
      };
      const listen = (state: unknown) => {
        if (this.inFlight?.listen !== listen) return;
        if (state === 'opened') {
          watch(AD_PLAY_MS);
          guard(() => started?.());
        } else if (state === 'rewarded') paid = true;
        else if (state === 'closed' || state === 'failed') {
          this.timers.clear(timer);
          this.inFlight = null;
          resolve(paid && state === 'closed');
        }
      };
      this.inFlight = { event, listen };
      watch(AD_START_MS);
      if (!this.subscribed.has(event)) {
        this.subscribed.add(event);
        void settle(() => ad.on?.(event, (s) => this.inFlight?.event === event && this.inFlight.listen(s)));
      }
      try {
        call(ad);
      } catch {
        listen('failed');
      }
    });
  }
}
