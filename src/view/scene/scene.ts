// The whole game on screen for one layout: the field, the actors and flashes on it, then the HUD,
// the shop and the covers, which never turn with the lane. Built again on every resize; each
// frame it reads the Session and draws, and never changes the world itself: the shop's buttons
// call the Session.

import { Container, Graphics } from 'pixi.js';
import type { Session } from '../../game/session';
import { frameFor, type Frame } from '../hud/frame';
import { Hud } from '../hud/hud';
import { Overlay } from '../hud/overlay';
import { ShopPanel } from '../hud/shop';
import type { Fit } from '../viewport';
import { drawActors } from './actors';
import { drawField } from './field';
import { Fx } from './fx';

export class Scene extends Container {
  readonly frame: Frame;
  readonly hud: Hud;
  readonly shop: ShopPanel;
  readonly overlay: Overlay;
  private readonly actors = new Graphics();
  private readonly fx: Fx;
  private games = -1;

  constructor(
    fit: Fit,
    private readonly session: Session,
  ) {
    super();
    const fr = (this.frame = frameFor(fit));
    this.fx = new Fx(fr.field);
    this.hud = new Hud(fr, () => session.togglePause());
    this.shop = new ShopPanel(fr, {
      buy: (i) => session.buy(i),
      repair: () => session.repair(),
      mine: () => session.mine(),
      reroll: () => session.reroll(),
      next: () => session.nextWave(),
    });
    this.overlay = new Overlay(fr);
    this.addChild(drawField(fr.field), this.actors, this.fx, this.hud, this.shop, this.overlay);
    this.scale.set(fit.scale);
    this.position.set(fit.x, fit.y);
  }

  /** Draws the session as it is now; `frameMs` drives the flashes and the hint banner. */
  draw(frameMs: number): void {
    const s = this.session;
    if (s.games !== this.games) {
      this.games = s.games;
      this.overlay.reset();
    }
    const events = s.drain();
    const w = s.world;
    drawActors(this.actors, s, this.frame.field);
    this.fx.add(events);
    this.fx.update(s.paused ? 0 : frameMs);
    this.hud.update(w);
    const shop = s.mode === 'play' && w.phase === 'shop' && !s.paused;
    this.shop.update(w, shop, s.shopping());
    this.overlay.update(s.mode, s.paused, shop, w.wave, events, frameMs);
  }
}
