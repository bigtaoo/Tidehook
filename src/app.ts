// Boots the game on a platform: language, renderer, the Session (game/session.ts), the Scene
// that draws it, laid out again whenever the screen turns or resizes, and the Sound that hears it.

import { Application } from 'pixi.js';
import { WebAudioOut } from './audio/engine';
import { Sound } from './audio/sound';
import { bindKeys } from './game/input';
import { Session, type SessionOptions } from './game/session';
import { urlSwitches } from './game/switches';
import { detectLocale, loadLocale, setLocale } from './i18n';
import type { Platform } from './platform/types';
import { SEA } from './view/kit/palette';
import { loadArt } from './view/art';
import { Scene, type SceneUi } from './view/scene/scene';
import { fitDesign } from './view/viewport';
import { waitForSize } from './view/waitForSize';

/** The player's language pick, in the platform's storage. */
export const LANG_KEY = 'tidehook.lang';

/** ?seed, ?speed and ?autoplay (dev builds only; urlSwitches drops them in a release). */
export function sessionOptions(params: URLSearchParams, now: number): SessionOptions {
  const seed = Number.parseInt(params.get('seed') ?? '', 10);
  const speed = Number.parseFloat(params.get('speed') ?? '');
  const auto = params.get('autoplay');
  return {
    seed: Number.isSafeInteger(seed) ? seed : now % 1_000_000,
    speed: speed > 0 && speed <= 20 ? speed : 1,
    autoplay: auto === null ? null : auto || 'good',
  };
}

export async function boot(platform: Platform): Promise<Application> {
  const params = urlSwitches(location.search);
  const want = detectLocale([params.get('lang'), platform.storage.getItem(LANG_KEY), ...platform.languages()]);
  const table = loadLocale(want);
  await waitForSize(window);

  const app = new Application();
  const resolution = Math.min(window.devicePixelRatio || 1, 2);
  await app.init({
    background: SEA.deep,
    resizeTo: platform.mount ?? window,
    resolution,
    autoDensity: true,
    antialias: resolution < 2,
    preference: 'webgl',
  });
  (platform.mount ?? document.body).appendChild(app.canvas);
  app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  const art = loadArt();
  if (await table) setLocale(want);
  await art;

  const session = new Session(sessionOptions(params, Date.now()));
  // a tap anywhere that no button took casts (or starts, or resumes)
  app.stage.eventMode = 'static';
  app.stage.hitArea = app.screen;
  app.stage.on('pointerdown', () => session.tap());
  const out = new WebAudioOut();
  out.listen(window);
  const sound = new Sound(out, platform.storage);
  platform.onHostMute((m) => sound.hostMute(m));
  const ui: SceneUi = {
    shop: (ok) => sound.cue(ok ? 'buy' : 'deny', performance.now()),
    toggleSound: () => sound.toggle(),
    soundOn: () => sound.on,
  };
  bindKeys(window, session, (key) => key === 'm' && (sound.toggle(), true));
  const pause = () => session.pause();
  platform.onHostPause?.(pause);
  // the ticker stops with the tab, so the sound hears about it here
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    sound.setHidden(document.hidden);
  });

  let scene: Scene | null = null;
  const layout = () => {
    scene?.destroy({ children: true });
    scene = new Scene(fitDesign(app.screen.width, app.screen.height), session, ui);
    app.stage.addChild(scene);
  };
  layout();
  app.renderer.on('resize', layout);

  let playing = false;
  app.ticker.add((tk) => {
    session.update(tk.deltaMS);
    const events = scene?.draw(tk.deltaMS) ?? session.drain();
    const now = session.mode === 'play' && !session.paused;
    const ms = performance.now();
    sound.setPaused(session.mode === 'play' && session.paused);
    sound.events(events, ms);
    sound.reel(session.world, now, ms);
    if (now !== playing) {
      playing = now;
      if (now) platform.gameplayStart();
      else platform.gameplayStop();
    }
  });

  if (import.meta.env.DEV) Object.assign(window, { __th: { app, session, sound, build: __TH_BUILD__ } });
  platform.loaded();
  return app;
}
