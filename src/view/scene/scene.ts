// The whole game on screen for one layout: the field, the actors and flashes on it, then the HUD,
// the shop, the covers and the harbour between games, which never turn with the lane. Built again on every resize; each
// frame it reads the Session and draws, and never changes the world itself: the shop's buttons
// call the Session.

import { Container, Graphics } from 'pixi.js';
import { Feel } from './feel';
import type { Offer } from '../../game/ads';
import type { DailyBoard } from '../../game/board';
import { today } from '../../game/meta/daily';
import type { Session } from '../../game/session';
import { SETTING_IDS, type SettingId, type Settings } from '../../game/settings';
import type { SimEvent } from '../../sim/events';
import { seaOf } from '../../sim/seas';
import { frameFor, type Frame } from '../hud/frame';
import { Hud } from '../hud/hud';
import { goalText } from '../hud/lobbyLog';
import { LobbyPanel } from '../hud/lobby';
import type { DailyView } from '../hud/lobbyDaily';
import { NO_SALE } from '../hud/lobbyNoAds';
import type { NoAds } from '../../game/noAds';
import { seaName } from '../hud/lobbySeas';
import { OverAds, type AdActions } from '../hud/overAds';
import { Overlay } from '../hud/overlay';
import { VoyageEnd } from '../hud/voyageEnd';
import { BF } from '../../sim/balanceFun';
import { Pointer } from '../hud/pointer';
import { topCard } from '../../game/guide/shopPick';
import { t } from '../../i18n';
import { ShopPanel } from '../hud/shop';
import { PauseSettings, shownSettings } from '../hud/settingsPanel';
import type { Fit } from '../viewport';
import { Actors } from './actors';
import { drawField, drawWeather } from './field';
import { WeatherTop } from './weather';
import { Fx } from './fx';

/** What the scene's buttons do beyond the Session: the sound and the settings. */
export interface SceneUi {
  /** A shop press: `ok` when it bought something. */
  shop(ok: boolean): void;
  toggleSound(): void;
  soundOn(): boolean;
  /** A switch flipped (a setting): a click, not the shop's coins. */
  click?(): void;
  /** The player's settings (game/settings.ts), null in a test. */
  settings?: Settings | null;
  /** The device can buzz, so the vibration setting shows. */
  canBuzz?: boolean;
}

/** The rewarded ads' side of the screen (game/ads.ts): what to offer and what the buttons do. */
export interface SceneAds extends AdActions {
  offer(): Offer;
  /** The shop's reroll is ad-paid now. */
  freeReroll(): boolean;
  reroll(): void;
}

const NO_UI: SceneUi = { shop: () => {}, toggleSound: () => {}, soundOn: () => true };
/** Stand-ins for the screens that are not up: the game over card's extra lines and the harbour's
 *  day. Both cost real work to build (a handful of t() calls; a new Date), and neither panel reads
 *  them while it is hidden, so a game spent a frame's budget on them 60 times a second. */
const NO_NOTES: readonly string[] = [];
const NO_DAILY: DailyView = { day: '' };

export class Scene extends Container {
  readonly frame: Frame;
  readonly hud: Hud;
  readonly shop: ShopPanel;
  readonly overlay: Overlay;
  readonly overAds: OverAds;
  readonly voyageEnd: VoyageEnd;
  readonly pauseSettings: PauseSettings;
  readonly lobby: LobbyPanel;
  /** The sea's weather over the water, redrawn when the sea changes. */
  private readonly weather = new Graphics();
  private sea = '';
  /** The fog wall and the gust's streaks, over the actors (weather.ts). */
  private readonly weatherTop: WeatherTop;
  readonly pointer: Pointer;
  private readonly actors: Actors;
  private readonly fx: Fx;
  /** The field and all on it, which the shake moves (feel.ts); the HUD and panels stay put. */
  private readonly field = new Container();
  /** Hit-stop, slow motion and shake (feel.ts); app.ts runs the sim on its clock. */
  readonly feel = new Feel();
  private games = -1;

  constructor(
    fit: Fit,
    private readonly session: Session,
    private readonly ui: SceneUi = NO_UI,
    private readonly ads: SceneAds | null = null,
    private readonly board: DailyBoard | null = null,
    private readonly noAds: NoAds | null = null,
  ) {
    super();
    const fr = (this.frame = frameFor(fit));
    this.fx = new Fx(fr.field);
    this.actors = new Actors(fr.field);
    this.weatherTop = new WeatherTop(fr.field);
    this.hud = new Hud(fr, () => session.togglePause(), () => ui.toggleSound());
    this.shop = new ShopPanel(fr, {
      buy: (i) => ui.shop(session.buy(i)),
      repair: () => ui.shop(session.repair()),
      mine: () => ui.shop(session.mine()),
      reroll: () => ui.shop(session.reroll()),
      freeReroll: () => ads?.reroll(),
      next: () => session.nextWave(),
      denied: () => ui.shop(false),
    });
    this.overlay = new Overlay(fr);
    this.overlay.eventHint = { seen: () => !session.guide || session.guide.has('event'), spend: () => void session.guide?.once('event') };
    this.overAds = new OverAds(fr, { revive: () => ads?.revive(), giveUp: () => ads?.giveUp(), double: () => ads?.double() });
    this.voyageEnd = new VoyageEnd(fr, { home: () => ui.shop(session.home()), sailOn: () => session.sailOn() });
    const settingIds = shownSettings(SETTING_IDS, !!ui.canBuzz);
    const toggle = (id: SettingId) => {
      ui.settings?.toggle(id);
      ui.click?.();
    };
    this.pauseSettings = new PauseSettings(fr.boost, ui.settings ?? null, settingIds, toggle);
    this.lobby = new LobbyPanel(fr, {
      buy: (id) => ui.shop(session.buyMeta(id)),
      sail: () => session.sail(),
      daily: () => session.sailDaily(today()),
      chart: (i) => ui.shop(session.buyChart(i)),
      pick: (i) => ui.shop(session.pickSea(i)),
      denied: () => ui.shop(false),
      paint: (id) => {
        const h = session.harbour;
        ui.shop(!!h && (h.hasPaint(id) ? h.wearPaint(id) : h.buyPaint(id)));
      },
      toggle,
      noAds: () => void noAds?.buy().then((ok) => ok && ui.shop(true)),
    }, ui.settings ? { s: ui.settings, ids: settingIds } : null);
    this.pointer = new Pointer(fr, this.shop, () => session.guide?.skip());
    this.field.addChild(drawField(fr.field), this.weather, this.actors, this.weatherTop, this.fx);
    this.addChild(this.field, this.hud, this.shop, this.pointer, this.overlay, this.overAds, this.voyageEnd, this.pauseSettings, this.lobby);
    this.scale.set(fit.scale);
    this.position.set(fit.x, fit.y);
  }

  /** Draws the session as it is now; `frameMs` drives the flashes and the hint banner. Returns the
   *  events it drained, for the sound. */
  draw(frameMs: number): SimEvent[] {
    const s = this.session;
    if (s.games !== this.games) {
      this.games = s.games;
      this.overlay.reset();
      this.feel.reset();
    }
    const events = s.drain();
    this.feel.calm = !!this.ui.settings?.get('calm');
    if (s.mode === 'play' && !s.paused) this.feel.observe(events);
    else this.feel.reset();
    this.feel.apply(this.field, 0, 0, s.paused ? 0 : frameMs);
    const sea = seaOf(s.world).id;
    if (sea !== this.sea) {
      this.sea = sea;
      drawWeather(this.weather, this.frame.field, sea);
    }
    const w = s.world;
    this.actors.draw(s);
    this.weatherTop.draw(s, frameMs);
    this.fx.add(events);
    this.fx.update(s.paused ? 0 : frameMs);
    this.hud.update(w, this.ui.soundOn());
    const atEnd = s.atVoyageEnd();
    const shop = s.mode === 'play' && w.phase === 'shop' && !s.paused && !atEnd;
    const g = s.guide;
    this.shop.update(w, shop, s.shopping(), g?.tagOn && s.shopping() ? topCard(w) : null, !!this.ads?.freeReroll(), !!g?.shopTeach && s.shopping());
    this.pointer.update(s, frameMs);
    // while the tutorial still has the throw to teach, it says so itself, not the banner
    const hints = g && !g.done.has('throw') ? events.filter((e) => e.e !== 'held') : events;
    const lesson = g?.lesson ? t(g.lesson) : null;
    const pearls = s.harbour ? s.last.pearls : null;
    const offer = this.ads?.offer() ?? null;
    const end = atEnd ? 'voyage' : s.mode === 'over' && s.last.home ? 'home' : null;
    const notes = s.mode === 'over' ? overNotes(s) : NO_NOTES;
    this.overlay.update(s.mode, s.paused, shop, w.wave, hints, frameMs, this.pointer.talking, lesson, pearls, notes, offer, end);
    this.overAds.update(atEnd ? null : offer, atEnd ? null : this.overlay.slot);
    this.voyageEnd.update(BF.voyage.home, atEnd && !s.paused ? this.overlay.slot : null);
    this.pauseSettings.update(s.mode === 'play' && s.paused ? this.overlay.slot : null);
    const inLobby = s.mode === 'lobby';
    const daily = inLobby ? { day: today(), rows: this.board?.on ? this.board.rows : undefined } : NO_DAILY;
    this.lobby.update(s.harbour, inLobby, s.last, daily, this.noAds ?? NO_SALE);
    return events;
  }
}

/** The game over's extra lines: a new best on a sea, the captain's log entries written, the codex's
 *  pearls for kinds first sunk and the daily streak's. */
function overNotes(s: Session): string[] {
  const { log, record, sea, codex, streak } = s.last;
  const out: string[] = [];
  if (record) out.push(s.last.daily ? t('overlay.daily', { n: s.last.wave }) : t('overlay.record', { sea: seaName(sea) }));
  if (log.length === 1) out.push(t('overlay.logOne', { goal: goalText(log[0]) }));
  else if (log.length > 1) out.push(t('overlay.logMany', { n: log.length }));
  if (codex) out.push(t('overlay.codex', { n: codex }));
  if (streak?.pearls) out.push(t('overlay.streak', { n: streak.n, p: streak.pearls }));
  return out;
}
