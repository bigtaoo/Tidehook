// Boots the game on a platform: language, renderer, the Session (game/session.ts), the Scene
// that draws it, laid out again whenever the screen turns or resizes, and the Sound that hears it.

import { Application } from 'pixi.js';
import { WebAudioOut } from './audio/engine';
import { Sound } from './audio/sound';
import { Ads } from './game/ads';
import { DailyBoard } from './game/board';
import { FIRST_SEED } from './game/guide/firstSeed';
import { Guide } from './game/guide/guide';
import { Haptics, webBuzz } from './game/haptics';
import { bindKeys, eventAge } from './game/input';
import { today } from './game/meta/daily';
import { Harbour } from './game/meta/harbour';
import { startRecording } from './game/rec/wire';
import { SEEN_MS, Session, type SessionOptions } from './game/session';
import { Settings } from './game/settings';
import { urlSwitches } from './game/switches';
import { Telemetry } from './game/telemetry';
import { detectLocale, loadLocale, setLocale } from './i18n';
import { fakeBoard } from './platform/fakeBoard';
import { fakePayments } from './platform/fakePayments';
import { NoAds } from './game/noAds';
import { seaOf } from './sim/seas';
import type { Platform } from './platform/types';
import { SEA } from './view/kit/palette';
import { loadArt } from './view/art';
import { Scene, type SceneUi } from './view/scene/scene';
import { fitDesign } from './view/viewport';
import { waitForSize } from './view/waitForSize';

/** The player's language pick, in the platform's storage. */
export const LANG_KEY = 'tidehook.lang';

/** ?seed, ?speed, ?autoplay, ?lag and ?ease (dev builds only; urlSwitches drops them in a release). */
export function sessionOptions(params: URLSearchParams, now: number): SessionOptions {
  const seed = Number.parseInt(params.get('seed') ?? '', 10);
  const speed = Number.parseFloat(params.get('speed') ?? '');
  const auto = params.get('autoplay');
  const lag = Number.parseFloat(params.get('lag') ?? '');
  const ease = Number.parseInt(params.get('ease') ?? '', 10);
  return {
    seed: Number.isSafeInteger(seed) ? seed : now % 1_000_000,
    speed: speed > 0 && speed <= 20 ? speed : 1,
    autoplay: auto === null ? null : auto || 'good',
    lagMs: lag >= 0 && lag <= 150 ? lag : SEEN_MS,
    ...(ease >= 0 ? { ease } : {}),
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

  const opts = sessionOptions(params, Date.now());
  // the tutorial (docs/02-onboarding.md): a new player's first game starts at once, on the seed
  // picked for it, with no title to tap through
  const guide = opts.autoplay ? null : new Guide(platform.storage);
  if (guide?.fresh && !params.has('seed')) opts.firstSeed = FIRST_SEED;
  // the harbour between games (docs/02-onboarding.md section 7): a returning player boots into it
  const harbour = opts.autoplay ? null : new Harbour(platform.storage);
  const session = new Session(opts, guide, harbour);
  if (guide?.fresh) session.start();
  else session.openLobby();
  // a tap anywhere that no button took casts (or starts, or resumes)
  app.stage.eventMode = 'static';
  app.stage.hitArea = app.screen;
  app.stage.on('pointerdown', (e) => {
    const n = e.nativeEvent;
    session.tap(eventAge('timeStamp' in n ? n.timeStamp : performance.now()));
  });
  const out = new WebAudioOut();
  out.listen(window);
  const sound = new Sound(out, platform.storage);
  // the music, the sounds, the buzz and calm motion apart (game/settings.ts)
  const settings = new Settings(platform.storage);
  const mix = () => sound.setMix(settings.get('music'), settings.get('sfx'));
  settings.onChange = mix;
  mix();
  const haptics = new Haptics(webBuzz(navigator), () => settings.get('buzz'));
  // silent while the host says so or an ad is on screen
  let hostMuted = false;
  const ads = new Ads(platform, session, () => sound.hostMute(hostMuted || ads.on));
  platform.onHostMute((m) => {
    hostMuted = m;
    sound.hostMute(hostMuted || ads.on);
  });
  const telemetry = new Telemetry(platform, session, __TH_BUILD__);
  // the daily voyage's leaderboard, where the host has one (?board=fake in a dev build)
  const board = new DailyBoard(params.get('board') === 'fake' ? fakeBoard() : (platform.board?.() ?? null), today);
  // the remove-ads purchase, where the host sells it (?pay=fake in a dev build): no interstitials once owned
  const noAds = new NoAds(params.get('pay') === 'fake' ? fakePayments() : (platform.payments?.() ?? null));
  ads.adFree = () => noAds.owned;
  void noAds.load();
  const ui: SceneUi = {
    shop: (ok) => sound.cue(ok ? 'buy' : 'deny', performance.now()),
    toggleSound: () => sound.toggle(),
    soundOn: () => sound.on,
    settings,
    canBuzz: haptics.able,
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
    scene = new Scene(fitDesign(app.screen.width, app.screen.height), session, ui, ads, board, noAds);
    app.stage.addChild(scene);
  };
  layout();
  app.renderer.on('resize', layout);

  const record = startRecording(params, session, () => {
    const { width: w, height: h } = app.screen;
    return { w, h, wide: fitDesign(w, h).wide };
  }, __TH_BUILD__, opts.lagMs);
  let playing = false;
  app.ticker.add((tk) => {
    session.update(scene ? scene.feel.clock(tk.deltaMS) : tk.deltaMS);
    const events = scene?.draw(tk.deltaMS) ?? session.drain();
    record?.(tk.deltaMS, events);
    const now = session.mode === 'play' && !session.paused && !session.hold;
    ads.frame(events);
    telemetry.frame(tk.deltaMS, now && !document.hidden, events);
    board.frame(session);
    const ms = performance.now();
    sound.setPaused(session.mode === 'play' && session.paused);
    sound.events(events, ms);
    if (now) haptics.events(events, ms);
    sound.reel(session.world, now, ms);
    sound.music(session.mode === 'lobby' || session.mode === 'title', seaOf(session.world).id);
    if (now !== playing) {
      playing = now;
      if (now) platform.gameplayStart();
      else platform.gameplayStop();
    }
  });

  if (import.meta.env.DEV) Object.assign(window, { __th: { app, session, sound, settings, ads, noAds, build: __TH_BUILD__ } });
  platform.loaded();
  return app;
}
