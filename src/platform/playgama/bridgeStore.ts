import type { KeyValueStore } from '../types';
import type { PlaygamaBridge } from './bridge';

// Bridge storage is asynchronous while the game's KeyValueStore is synchronous, so every key the
// game keeps is read once at boot into a cache; writes land in the cache at once and go to Bridge
// together on the next tick, one call per batch, as Playgama asks. A hidden page may get no next
// tick, so while it is hidden every write goes at once, and `flush` sends what waits.
//
// A write the host refuses is kept and sent again with the next batch, rather than dropped into
// this visit's cache alone, where it would read back fine and be gone at the next boot.
//
// `leaving` is the last word: a page that is going away (or being frozen into the back/forward
// cache) is not always marked hidden first - Safari fires pagehide on its own - and the tick that
// would send the batch never comes. From then on every write goes at once, so that whatever the
// game writes on its way out (the voyage in progress, game/meta/resume.ts) reaches Bridge even
// though it is written after the page has already said goodbye.

export class BridgeStore implements KeyValueStore {
  private pending = new Map<string, string>();
  private queued = false;
  private gone = false;

  private constructor(
    private readonly bridge: Pick<PlaygamaBridge, 'save'>,
    private readonly cache: Map<string, string>,
    private readonly later: (fn: () => void) => void,
    private readonly hidden: () => boolean,
  ) {}

  static async create(
    bridge: Pick<PlaygamaBridge, 'save' | 'load'>,
    keys: string[],
    later: (fn: () => void) => void = (fn) => void setTimeout(fn, 0),
    hidden: () => boolean = () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  ): Promise<BridgeStore> {
    return new BridgeStore(bridge, await bridge.load(keys), later, hidden);
  }

  getItem(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.cache.set(key, value);
    this.pending.set(key, value);
    if (this.gone || this.hidden()) return this.flush();
    if (this.queued) return;
    this.queued = true;
    this.later(() => this.flush());
  }

  /** The page is on its way out: send what waits, and send every later write at once too. */
  leaving(): void {
    this.gone = true;
    this.flush();
  }

  /** The page came back from the back/forward cache after all, so writes may wait for a tick
   *  again. */
  back(): void {
    this.gone = false;
  }

  /** Sends what waits. A batch the host refused is put back, key by key, so the next write - or
   *  the next flush - carries it again: dropping it would lose a save the player made with nothing
   *  said anywhere, and it would only be missed on the next boot. A key the game has written since
   *  is left alone - the cache holds the newest value, so a batch that comes back late cannot put
   *  an older one back on its way to Bridge. Nothing is retried on a timer, because a host whose
   *  storage is off would then be asked for ever. */
  flush(): void {
    this.queued = false;
    if (this.pending.size === 0) return;
    const batch = this.pending;
    this.pending = new Map();
    void Promise.resolve(this.bridge.save(batch)).then((ok) => {
      if (ok) return;
      for (const [key, value] of batch) if (this.cache.get(key) === value) this.pending.set(key, value);
    });
  }
}
