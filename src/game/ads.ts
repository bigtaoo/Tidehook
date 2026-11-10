// Where ads go in a game (docs/01-tech-plan.md section 9). Rewarded, each once a game and only
// where the player asks: revive the fallen dock, double a game's pearls, a free reroll in the
// shop. Interstitials only at natural breaks (the shop opening after a wave, leaving a game over
// for the harbour), never in a new player's first game and never straight after a rewarded ad;
// how often they really show is the host's to pace (Playgama's minimumDelayBetweenInterstitial),
// so there is no timer here. While an ad is on screen the session holds and the sound is off. A
// player who bought the remove-ads product (noAds.ts) sees no interstitial again; the rewarded ads
// stay on offer.

import type { SimEvent } from '../sim/events';
import type { BreakPlacement, Platform, RewardedPlacement } from '../platform/types';
import type { Mode, Session } from './session';

/** What the game-over card offers under it. */
export type Offer = 'revive' | 'double' | null;

export class Ads {
  /** An ad is on screen. */
  on = false;
  /** A rewarded ad played since the last wave began: the next break shows no interstitial. */
  private rewardedLately = false;
  private mode: Mode;
  /** The player owns the remove-ads product: no interstitials (the app points it at NoAds). */
  adFree: () => boolean = () => false;

  /** `onChange` hears `on` flip (the app mutes the sound with it). */
  constructor(
    private readonly platform: Platform,
    private readonly session: Session,
    private readonly onChange: (on: boolean) => void = () => {},
  ) {
    this.mode = session.mode;
    session.canRevive = () => this.rewardedReady();
  }

  /** A rewarded ad can be offered: the host has one, and this is a player's game with a harbour. */
  private rewardedReady(): boolean {
    const s = this.session;
    return !!s.harbour && !s.opts.autoplay && this.platform.rewardedAvailable();
  }

  /** The buttons the game-over card shows now. */
  offer(): Offer {
    const s = this.session;
    if (s.mode !== 'over' || this.on) return null;
    if (s.pending) return 'revive';
    return !s.doubled && s.last.won > 0 && this.rewardedReady() ? 'double' : null;
  }

  /** Whether the shop's reroll button offers its free, ad-paid deal. */
  freeReroll(): boolean {
    return !this.session.freeRerolled && !this.on && this.rewardedReady();
  }

  /** Watches for the revive. A closed ad that never started (none to show) ends the game. */
  async revive(): Promise<boolean> {
    const s = this.session;
    if (!s.pending || this.on) return false;
    const r = await this.rewarded('revive');
    if (r.paid) return s.revive();
    if (!r.started) s.giveUp();
    return false;
  }

  /** Turns the revive down. */
  giveUp(): boolean {
    return !this.on && this.session.giveUp();
  }

  async double(): Promise<boolean> {
    if (this.offer() !== 'double') return false;
    return (await this.rewarded('double')).paid && this.session.double();
  }

  async reroll(): Promise<boolean> {
    if (!this.freeReroll() || !this.session.shopping()) return false;
    return (await this.rewarded('reroll')).paid && this.session.freeReroll();
  }

  /** Each frame's events and the session's mode: finds the breaks an interstitial may fill. */
  frame(events: readonly SimEvent[]): void {
    let shop = false;
    for (const ev of events) {
      if (ev.e === 'waveStart') this.rewardedLately = false;
      else if (ev.e === 'waveClear') shop = true;
    }
    const from = this.mode;
    this.mode = this.session.mode;
    const lobby = from === 'over' && this.mode === 'lobby';
    if (shop && this.session.world.phase === 'shop') void this.interstitial('shop');
    else if (lobby) void this.interstitial('harbour');
  }

  private async interstitial(placement: BreakPlacement): Promise<void> {
    const s = this.session;
    if (this.on || this.rewardedLately || this.adFree() || s.opts.autoplay || (s.guide && s.guide.games <= 1)) return;
    await this.play(() => this.platform.midgame(() => this.hold(true), placement).then(() => true));
  }

  private async rewarded(placement: RewardedPlacement): Promise<{ paid: boolean; started: boolean }> {
    let started = false;
    const paid = await this.play(() =>
      this.platform.rewarded(() => {
        started = true;
        this.hold(true);
      }, placement),
    );
    if (paid) this.rewardedLately = true;
    return { paid, started };
  }

  /** Runs one ad; whatever happens, the game is let go after it. */
  private async play(ad: () => Promise<boolean>): Promise<boolean> {
    this.on = true;
    try {
      return await ad();
    } catch {
      return false;
    } finally {
      this.on = false;
      this.hold(false);
    }
  }

  private hold(on: boolean): void {
    if (this.session.hold === on) return;
    this.session.hold = on;
    this.onChange(on);
  }
}
