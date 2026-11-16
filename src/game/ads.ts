// Where ads go in a game (docs/01-tech-plan.md section 9). Rewarded, each once a game and only
// where the player asks: revive the fallen dock, double a game's pearls, a free reroll in the
// shop. Interstitials only at natural breaks (the shop opening after a wave, leaving a game over
// for the harbour), never in a new player's first game and never straight after a rewarded ad.
// A wave is a small level and the shop opens after every one, so the shop break carries an ad
// only every third time: the host paces interstitials too (Playgama's
// minimumDelayBetweenInterstitial), but its floor is a clock, and a fast player clears waves
// faster than that clock runs. While an ad is on screen the session holds and the sound is off. A
// player who bought the remove-ads product (noAds.ts) sees no interstitial again; the rewarded ads
// stay on offer.

import type { SimEvent } from '../sim/events';
import type { BreakPlacement, Platform, RewardedPlacement } from '../platform/types';
import type { Mode, Session } from './session';

/** What the game-over card offers under it. */
export type Offer = 'revive' | 'double' | null;

/** How many shop breaks one interstitial covers: an ad after every third wave, not every wave. */
export const WAVES_PER_AD = 3;

export class Ads {
  /** An ad is on screen. */
  on = false;
  /** A rewarded ad played since the last wave began: the next break shows no interstitial. */
  private rewardedLately = false;
  /** Shop breaks passed since the last interstitial. A break that showed none - a rewarded ad just
   *  before it, the first game - does not spend one, so the ad lands at the next real break. */
  private breaks = 0;
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
    // the voyage's end clears a wave like any other, but the shop stays shut behind the choice of
    // home or on (game/session.ts): a decision waiting on the player is not a break, and going home
    // from under the ad would then queue the harbour's one seconds later
    if (shop && this.session.world.phase === 'shop' && !this.session.atVoyageEnd()) void this.interstitial('shop');
    else if (lobby) void this.interstitial('harbour');
  }

  private async interstitial(placement: BreakPlacement): Promise<void> {
    const s = this.session;
    if (this.on || this.rewardedLately || this.adFree() || s.opts.autoplay || (s.guide && s.guide.games <= 1)) return;
    // the way back to the harbour comes once a game and is a real stop; the shop comes every wave
    if (placement === 'shop' && ++this.breaks < WAVES_PER_AD) return;
    this.breaks = 0;
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
