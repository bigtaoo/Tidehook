import { SafeStore, type Platform, type TrackData } from './types';

/** A platform for tests and headless runs: memory storage, no ads, and a log of the calls the
 *  game made, so a test can check it told the host about gameplay starting and stopping. */
export class StubPlatform implements Platform {
  readonly name = 'stub';
  storage = new SafeStore(null);
  readonly calls: string[] = [];
  /** The telemetry the game sent. */
  readonly tracked: [string, TrackData][] = [];
  /** Whether rewarded ads answer, and with what. */
  ads: 'none' | 'reward' | 'skip' = 'none';
  private muteListeners: ((muted: boolean) => void)[] = [];

  constructor(private readonly langs: string[] = ['en']) {}

  languages(): string[] {
    return this.langs;
  }

  loaded(): void {
    this.calls.push('loaded');
  }

  gameplayStart(): void {
    this.calls.push('gameplayStart');
  }

  gameplayStop(): void {
    this.calls.push('gameplayStop');
  }

  celebrate(): void {
    this.calls.push('celebrate');
  }

  track(event: string, data: TrackData): void {
    this.tracked.push([event, data]);
  }

  rewardedAvailable(): boolean {
    return this.ads !== 'none';
  }

  async rewarded(onStart: () => void): Promise<boolean> {
    if (this.ads === 'none') return false;
    onStart();
    this.calls.push('rewarded');
    return this.ads === 'reward';
  }

  async midgame(onStart: () => void): Promise<void> {
    if (this.ads === 'none') return;
    onStart();
    this.calls.push('midgame');
  }

  onHostMute(listener: (muted: boolean) => void): void {
    this.muteListeners.push(listener);
    listener(false);
  }

  /** The host mutes or unmutes, as a portal would. */
  mute(muted: boolean): void {
    for (const l of this.muteListeners) l(muted);
  }
}
