// Playgama: the browser host plus the Bridge SDK for saves, ads, the platform's pause and sound
// switches, the lifecycle messages and its telemetry. Built with `create()`, which waits (bounded)
// for Bridge and reads every saved key through it first: Playgama keeps games out of the browser's
// own storage. After Potion Siege's platform/playgama/PlaygamaPlatform.ts, without its leaderboards
// and save copies (docs/01-tech-plan.md section 6).

import { SafeStore, type Platform, type TrackData } from '../types';
import { WebPlatform } from '../web';
import { PlaygamaBridge } from './bridge';
import { BridgeStore } from './bridgeStore';

/** Bridge's stand-ins for a page that is no portal: a developer's own preview and the QA tool. */
const TEST_PLATFORMS = new Set(['mock', 'qa_tool']);

export class PlaygamaPlatform extends WebPlatform implements Platform {
  /** 'web' on a test platform, so a preview never counts as a Playgama player. */
  override readonly name: string;
  private playing = false;
  /** game_ready has gone out; until then a gameplayStart only waits for it. */
  private ready = false;
  private startWaiting = false;
  private paused = false;
  private soundOff = false;
  private muteListener: ((muted: boolean) => void) | null = null;
  private pauseListener: (() => void) | null = null;

  private constructor(
    private readonly bridge: PlaygamaBridge,
    saves: BridgeStore | null,
    doc: Document,
    win: Window,
  ) {
    super();
    const id = bridge.platformId();
    this.name = id && !TEST_PLATFORMS.has(id) ? 'playgama' : 'web';
    if (saves) this.storage = new SafeStore(saves);
    // the platform's pause (an overlay, the tab hidden) silences the game, stops a wave under its
    // pause cover, and the save goes to Bridge at once: a page on its way out may get no next tick
    bridge.onPause((paused) => {
      this.paused = paused;
      this.mute();
      if (!paused) return;
      saves?.flush();
      try {
        this.pauseListener?.();
      } catch {
        /* the game's problem, never Bridge's */
      }
    });
    bridge.onMute((off) => {
      this.soundOff = off;
      this.mute();
    });
    const flush = () => saves?.flush();
    doc.addEventListener('visibilitychange', () => doc.visibilityState === 'hidden' && flush());
    win.addEventListener('pagehide', flush);
  }

  /** `keys`: every key the game keeps, read from Bridge in one call. Without Bridge (blocked, or
   *  it never answered) the save stays in the browser's storage, as on the plain web. */
  static async create(keys: string[], bridge = new PlaygamaBridge(), doc: Document = document, win: Window = window): Promise<PlaygamaPlatform> {
    const ok = await bridge.init();
    const saves = ok ? await BridgeStore.create(bridge, keys) : null;
    console.info(`[tidehook] Playgama Bridge: ${ok ? bridge.platformId() : 'unavailable'}, save: ${saves ? 'bridge' : 'localStorage'}`);
    return new PlaygamaPlatform(bridge, saves, doc, win);
  }

  /** The platform's language first, then the browser's. */
  override languages(): string[] {
    const lang = this.bridge.language();
    return lang ? [lang, ...super.languages()] : super.languages();
  }

  override loaded(): void {
    if (this.ready) return;
    this.ready = true;
    this.bridge.send('game_ready');
    if (this.startWaiting) {
      this.startWaiting = false;
      this.gameplayStart();
    }
  }

  // only real changes reach the platform, and a start never goes out before game_ready
  override gameplayStart(): void {
    if (!this.ready) return void (this.startWaiting = true);
    if (this.playing) return;
    this.playing = true;
    this.bridge.send('gameplay_started');
  }

  override gameplayStop(): void {
    this.startWaiting = false;
    if (!this.playing) return;
    this.playing = false;
    this.bridge.send('gameplay_stopped');
  }

  override celebrate(): void {
    this.bridge.send('player_got_achievement');
  }

  /** Telemetry goes out from the portal only: a local preview and the QA tool stay out of its
   *  numbers. */
  override track(event: string, data: TrackData): void {
    if (this.name === 'playgama') this.bridge.track(event, data);
  }

  /** Hidden under an adblocker and where the platform has no rewarded ads. */
  override rewardedAvailable(): boolean {
    return this.bridge.rewardedSupported() && !this.bridge.hasAdblock();
  }

  adBlocked(): boolean {
    return this.bridge.isReady() && this.bridge.hasAdblock();
  }

  override rewarded(onStart: () => void): Promise<boolean> {
    return this.bridge.rewarded(onStart);
  }

  override midgame(onStart: () => void): Promise<void> {
    return this.bridge.interstitial(onStart);
  }

  /** The platform's sound switch and its pause both silence the game. */
  override onHostMute(listener: (muted: boolean) => void): void {
    this.muteListener = listener;
    this.mute();
  }

  /** The platform's pause opens the game's own: the player comes back to it and taps to resume. */
  override onHostPause(listener: () => void): void {
    this.pauseListener = listener;
  }

  private mute(): void {
    try {
      this.muteListener?.(this.soundOff || this.paused);
    } catch {
      /* the game's problem, never Bridge's */
    }
  }
}
