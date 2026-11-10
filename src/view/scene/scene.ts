// The whole game on screen for one layout: the field, the actors and flashes on it, then the HUD,
// the shop, the covers and the harbour between games, which never turn with the lane. Built again on every resize; each
// frame it reads the Session and draws, and never changes the world itself: the shop's buttons
// call the Session.

import { Container, Graphics } from 'pixi.js';
import type { Session } from '../../game/session';
import type { SimEvent } from '../../sim/events';
import { seaOf } from '../../sim/seas';
import { frameFor, type Frame } from '../hud/frame';
import { Hud } from '../hud/hud';
import { goalText } from '../hud/lobbyLog';
import { LobbyPanel } from '../hud/lobby';
import { seaName } from '../hud/lobbySeas';
import { Overlay } from '../hud/overlay';
import { Pointer } from '../hud/pointer';
import { topCard } from '../../game/guide/shopPick';
import { t } from '../../i18n';
import { ShopPanel } from '../hud/shop';
import type { Fit } from '../viewport';
import { Actors } from './actors';
import { drawField, drawWeather } from './field';
import { Fx } from './fx';

/** What the scene's buttons do beyond the Session: the sound. */
export interface SceneUi {
  /** A shop press: `ok` when it bought something. */
  shop(ok: boolean): void;
  toggleSound(): void;
  soundOn(): boolean;
}

const NO_UI: SceneUi = { shop: () => {}, toggleSound: () => {}, soundOn: () => true };

export class Scene extends Container {
  readonly frame: Frame;
  readonly hud: Hud;
  readonly shop: ShopPanel;
  readonly overlay: Overlay;
  readonly lobby: LobbyPanel;
  /** The sea's weather over the water, redrawn when the sea changes. */
  private readonly weather = new Graphics();
  private sea = '';
  readonly pointer: Pointer;
  private readonly actors: Actors;
  private readonly fx: Fx;
  private games = -1;

  constructor(
    fit: Fit,
    private readonly session: Session,
    private readonly ui: SceneUi = NO_UI,
  ) {
    super();
    const fr = (this.frame = frameFor(fit));
    this.fx = new Fx(fr.field);
    this.actors = new Actors(fr.field);
    this.hud = new Hud(fr, () => session.togglePause(), () => ui.toggleSound());
    this.shop = new ShopPanel(fr, {
      buy: (i) => ui.shop(session.buy(i)),
      repair: () => ui.shop(session.repair()),
      mine: () => ui.shop(session.mine()),
      reroll: () => ui.shop(session.reroll()),
      next: () => session.nextWave(),
      denied: () => ui.shop(false),
    });
    this.overlay = new Overlay(fr);
    this.lobby = new LobbyPanel(fr, {
      buy: (id) => ui.shop(session.buyMeta(id)),
      sail: () => session.sail(),
      chart: (i) => ui.shop(session.buyChart(i)),
      pick: (i) => ui.shop(session.pickSea(i)),
      denied: () => ui.shop(false),
    });
    this.pointer = new Pointer(fr, this.shop, () => session.guide?.skip());
    this.addChild(drawField(fr.field), this.weather, this.actors, this.fx, this.hud, this.shop, this.pointer, this.overlay, this.lobby);
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
    }
    const events = s.drain();
    const sea = seaOf(s.world).id;
    if (sea !== this.sea) {
      this.sea = sea;
      drawWeather(this.weather, this.frame.field, sea);
    }
    const w = s.world;
    this.actors.draw(s);
    this.fx.add(events);
    this.fx.update(s.paused ? 0 : frameMs);
    this.hud.update(w, this.ui.soundOn());
    const shop = s.mode === 'play' && w.phase === 'shop' && !s.paused;
    const g = s.guide;
    this.shop.update(w, shop, s.shopping(), g?.tagOn && s.shopping() ? topCard(w) : null);
    this.pointer.update(s, frameMs);
    // while the tutorial still has the throw to teach, it says so itself, not the banner
    const hints = g && !g.done.has('throw') ? events.filter((e) => e.e !== 'held') : events;
    const lesson = g?.lesson ? t(g.lesson) : null;
    const pearls = s.harbour ? s.last.pearls : null;
    this.overlay.update(s.mode, s.paused, shop, w.wave, hints, frameMs, this.pointer.talking, lesson, pearls, overNotes(s));
    this.lobby.update(s.harbour, s.mode === 'lobby', s.last);
    return events;
  }
}

/** The game over's extra lines: a new best on a sea, and the captain's log entries written. */
function overNotes(s: Session): string[] {
  const { log, record, sea } = s.last;
  const out: string[] = [];
  if (record) out.push(t('overlay.record', { sea: seaName(sea) }));
  if (log.length === 1) out.push(t('overlay.logOne', { goal: goalText(log[0]) }));
  else if (log.length > 1) out.push(t('overlay.logMany', { n: log.length }));
  return out;
}
